import { FileStats, Finding, UploadedFile, AnalysisScore, ReportMetadata, DatabaseResult, SearchDiagnostics, StructuredFinding } from '../types';
import { DEMO_PDF_CGU_TEXT, DEMO_PDF_TCU_TEXT, SYNONYMS_DICTIONARY, STOPWORDS } from '../constants';
import Fuse from 'fuse.js';
import Papa from 'papaparse';

// === CONSTANTES DE SCHEMA MAPPING (Requirement B) ===
// Mapeia nomes variados de colunas para chaves lógicas padronizadas
const COLUMN_ALIASES: Record<string, string[]> = {
  titulo: ['titulo', 'título', 'assunto', 'title', 'objeto'],
  texto_resumo: ['texto_resumo', 'resumo', 'texto', 'sumario', 'ementa', 'resumo_extrativo', 'historico', 'constatacao'],
  data: ['data', 'datapublicacao', 'data_publicacao', 'ano', 'competencia', 'exercicio'],
  uf: ['uf', 'siglauf', 'sigla_uf', 'estado'],
  municipio: ['municipio', 'cidade', 'unidade_municipio'],
  unidade_auditada: ['unidadesauditadas', 'unidade_auditada', 'unidade', 'orgao', 'jurisdicionado'],
  tipo_servico: ['tiposervico', 'tipo_de_servico', 'tipo', 'natureza'],
  id_relatorio: ['idrelatorio', 'id_relatorio', 'id', 'codigo', 'identificador', 'idtarefa', 'numero_acordao'],
  link: ['link', 'url', 'endereco', 'endereço', 'site']
};

// === B: Normalização Robusta ===
export const normalizeText = (s: string): string => {
  if (!s) return '';
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[\r\n]+/g, ' ') // Remove quebras de linha
    .replace(/[^\w\s]/g, ' ') // Substitui pontuação por espaço
    .replace(/\s+/g, ' ') // Colapsa múltiplos espaços
    .trim();
};

const normalizeHeader = (h: string): string => {
  // Normaliza headers para snake_case sem acentos (ex: "Texto Resumo" -> "texto_resumo")
  return normalizeText(h).replace(/\s+/g, '_');
};

// === Helper: Mapped Value Getter ===
// Busca valor em uma linha usando aliases (ex: busca 'titulo' tentando 'assunto', 'objeto', etc.)
const getMappedValue = (row: any, aliasKey: string): string => {
  const possibleKeys = COLUMN_ALIASES[aliasKey] || [aliasKey];
  // As chaves da row já estão normalizadas pelo parser (transformHeader)
  for (const key of possibleKeys) {
    if (row[key] !== undefined && row[key] !== null) return String(row[key]).trim();
  }
  return '';
};

// === Helper: Link Builders (Requirement D) ===
const buildCguLink = (row: any): string => {
  // 1. Link explícito
  const explicitLink = getMappedValue(row, 'link');
  if (explicitLink && explicitLink.length > 5 && (explicitLink.startsWith('http') || explicitLink.startsWith('www'))) return explicitLink;

  // 2. ID Numérico -> ecgu.cgu.gov.br
  const id = getMappedValue(row, 'id_relatorio');
  // Verifica se é numérico (ex: 12345)
  if (id && /^\d+$/.test(id)) {
    return `https://ecgu.cgu.gov.br/relatorio/${id}`;
  }

  // 3. Fallback -> Google Search
  const titulo = getMappedValue(row, 'titulo') || 'Relatório CGU';
  return `https://www.google.com/search?q=site%3Aecgu.cgu.gov.br%2Frelatorio+${encodeURIComponent(titulo)}`;
};

const buildTcuLink = (row: any): string => {
  const explicitLink = getMappedValue(row, 'link');
  return explicitLink || '#';
};

// === Helper: Snippet Generator ===
const generateSnippet = (text: string, queryTokens: string[]): string => {
  if (!text) return '';
  const cleanText = text.replace(/[\r\n]+/g, ' ');
  const normalizedText = normalizeText(cleanText);
  
  let bestIndex = -1;
  const sortedTokens = [...queryTokens].sort((a, b) => b.length - a.length);
  
  for (const token of sortedTokens) {
    const idx = normalizedText.indexOf(token);
    if (idx !== -1) {
      bestIndex = idx;
      break;
    }
  }

  if (bestIndex === -1) return cleanText.substring(0, 150) + '...';

  const start = Math.max(0, bestIndex - 60);
  const end = Math.min(cleanText.length, bestIndex + 140);
  return (start > 0 ? '...' : '') + cleanText.substring(start, end) + (end < cleanText.length ? '...' : '');
};

// === D: Expansão de Consulta ===
const expandQuery = (query: string): { tokens: string[], expandedTerms: string[], mode: 'OR' | 'AND' | 'PHRASE' } => {
  const trashWords = ['busque', 'buscar', 'pesquisar', 'encontre', 'listar', 'verificar', 'relatorio', 'relatorios', 'acordao', 'acordaos', 'sobre', 'acerca', 'identificar', 'quais', 'lista', 'tabela'];
  let cleanQuery = query;
  trashWords.forEach(w => {
      const regex = new RegExp(`\\b${w}\\b`, 'gi');
      cleanQuery = cleanQuery.replace(regex, '');
  });

  const normQuery = normalizeText(cleanQuery);
  let mode: 'OR' | 'AND' | 'PHRASE' = 'OR';
  
  if (query.trim().startsWith('"') && query.trim().endsWith('"')) {
    mode = 'PHRASE';
    const cleanPhrase = normQuery.replace(/"/g, '');
    return { tokens: [cleanPhrase], expandedTerms: [cleanPhrase], mode };
  }

  let tokens = normQuery.split(' ').filter(t => !STOPWORDS.has(t) && t.length > 2);
  let expandedTerms = [...tokens];

  if (SYNONYMS_DICTIONARY[normQuery]) {
    expandedTerms.push(...SYNONYMS_DICTIONARY[normQuery]);
  }

  tokens.forEach(token => {
    if (token.endsWith('s')) expandedTerms.push(token.slice(0, -1));
    else expandedTerms.push(token + 's');

    Object.keys(SYNONYMS_DICTIONARY).forEach(key => {
      if (key.includes(token)) {
         expandedTerms.push(...SYNONYMS_DICTIONARY[key]);
      }
    });
  });

  return { 
    tokens, 
    expandedTerms: Array.from(new Set(expandedTerms)), 
    mode 
  };
};

// === DETECÇÃO DE FONTE (Schema Detection) ===
const detectSource = (headers: string[], filename: string): 'CGU' | 'TCU' | 'OUTROS' => {
    // Headers já vem normalizados aqui (lowercase, sem acento, underline)
    const upperName = filename.toUpperCase();

    // 1. Schema Check (com base nos aliases normalizados)
    // Tenta casar headers do arquivo com nossas chaves de CGU/TCU
    const cguKeywords = ['idtarefa', 'datapublicacao', 'unidadesauditadas', 'texto_resumo', 'linhaacao', 'id_relatorio'];
    const tcuKeywords = ['resumo_extrativo', 'palavras_chave_dicionario', 'acordao', 'relator', 'numero_acordao'];

    const isCGU = cguKeywords.some(k => headers.includes(k));
    const isTCU = tcuKeywords.some(k => headers.includes(k));

    if (isCGU) return 'CGU';
    if (isTCU) return 'TCU';

    // 2. Filename Fallback
    if (upperName.includes('CGU') || upperName.includes('AUDITORIA')) return 'CGU';
    if (upperName.includes('TCU') || upperName.includes('ACORDAO')) return 'TCU';

    return 'OUTROS';
};

// === A: Geração de Full Text (Ingestão) (Requirement C) ===
const generateFullTextRow = (row: any): string => {
  // Concatena Campos Específicos para relevância
  // Garante que campos como título e resumo entrem no texto pesquisável
  let text = '';
  const priorityFields = ['titulo', 'texto_resumo', 'unidade_auditada', 'tipo_servico', 'uf', 'municipio'];
  
  priorityFields.forEach(alias => {
    const val = getMappedValue(row, alias);
    if (val) text += ` ${val}`; 
  });

  // Concatena o resto (fallback para garantir que nada seja perdido)
  text += ' ' + Object.values(row).map(val => val ? String(val) : '').join(' ');
  
  return normalizeText(text); 
};

// === E: Motor de Busca Principal ===
export const searchAuditDatabase = (
  files: UploadedFile[], 
  query: string,
  filters?: { uf?: string, municipio?: string, ano?: string }
): { 
  cgu: DatabaseResult[], 
  tcu: DatabaseResult[], 
  diagnostics: SearchDiagnostics,
  findings: StructuredFinding[],
  suggestions: string[]
} => {
  const startTime = performance.now();
  const { tokens, expandedTerms, mode } = expandQuery(query);
  
  let allRows: any[] = [];
  let filesInfo: any[] = [];

  files.forEach(file => {
      if (file.type === 'csv' && file.processedData) {
          filesInfo.push({
            name: file.name,
            rows: file.stats?.rowCount || 0,
            delimiter: file.stats?.delimiterDetected || 'auto',
            headers: file.stats?.normalizedHeaders?.slice(0, 15) || []
          });

          file.processedData.forEach((row, idx) => {
              allRows.push(row); 
          });
      }
      // PDFs 
      if (file.type !== 'csv' && file.content) {
          allRows.push({
              titulo: file.metadata?.titulo || file.name,
              texto_resumo: file.content.substring(0, 5000),
              ano: file.metadata?.ano,
              uf: file.metadata?.uf,
              _sourceFile: file.name,
              _sourceId: file.id,
              _source: file.metadata?.orgao || 'OUTROS',
              _full_text: normalizeText(file.content),
              link: file.metadata?.link_oficial
          });
      }
  });

  if (filters?.uf) {
      allRows = allRows.filter(r => (r._full_text || '').includes(normalizeText(filters.uf!)));
  }

  // Configuração Fuse.js (Pesos ajustados conforme Requirement C)
  const fuseOptions = {
    includeScore: true,
    threshold: 0.3, 
    ignoreLocation: true,
    keys: [
        { name: 'titulo', weight: 1.2 }, // Título com peso maior (simulando 12)
        { name: '_full_text', weight: 1.0 } // Full text peso base (simulando 10)
    ]
  };

  const fuse = new Fuse(allRows, fuseOptions);
  
  let searchResults: any[] = [];
  
  if (mode === 'PHRASE') {
      const phrase = normalizeText(expandedTerms[0]);
      searchResults = allRows
        .filter(row => (row._full_text || '').includes(phrase))
        .map(row => ({ item: row, score: 0.01 }));
  } else {
      const fuseQuery = {
          $or: expandedTerms.map(term => ({ _full_text: term }))
      };
      searchResults = fuse.search(fuseQuery);
  }

  // Mapeamento e Separação Rigorosa (Bug 1 Fix)
  const mappedResults: DatabaseResult[] = searchResults.map(res => {
      const row = res.item;
      // Normalizar source se vier do PDF (pode ser lowercase)
      let source = (row._source || 'OUTROS').toUpperCase();
      if (source !== 'CGU' && source !== 'TCU') {
         source = 'OUTROS';
      }
      
      const title = getMappedValue(row, 'titulo') || 'Registro sem título';
      const snippet = generateSnippet(row._full_text || JSON.stringify(row), expandedTerms);
      
      // Gera link usando lógica n8n (Bug 3 Fix)
      const finalLink = source === 'CGU' ? buildCguLink(row) : buildTcuLink(row);

      return {
          id: `${row._sourceId}-${row._rowIdx || 'doc'}`,
          titulo: title,
          data: getMappedValue(row, 'data') || '-',
          uf: getMappedValue(row, 'uf') || 'BR',
          municipio: getMappedValue(row, 'municipio'),
          orgao: source as 'CGU'|'TCU'|'OUTROS',
          link: finalLink,
          relevancia: (1 - (res.score || 0)) * 100,
          snippet: snippet,
          sourceFile: row._sourceFile,
          __source: source as 'CGU'|'TCU'|'OUTROS'
      };
  });

  const uniqueResults = mappedResults.filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i);
  uniqueResults.sort((a, b) => b.relevancia - a.relevancia);

  // Filtro Estrito (Bug 1 Fix - Separação correta de tabelas)
  const cguFinal = uniqueResults.filter(r => r.__source === 'CGU').slice(0, 10);
  const tcuFinal = uniqueResults.filter(r => r.__source === 'TCU').slice(0, 10);

  const structuredFindings = extractStructuredFindingsFromResults(uniqueResults, expandedTerms);

  return {
      cgu: cguFinal,
      tcu: tcuFinal,
      findings: structuredFindings,
      diagnostics: {
          originalQuery: query,
          normalizedQuery: normalizeText(query),
          searchMode: mode,
          expandedTerms,
          totalFilesSearched: files.length,
          totalRowsScanned: allRows.length,
          executionTimeMs: performance.now() - startTime,
          sourcesBreakdown: {
             cguCount: cguFinal.length,
             tcuCount: tcuFinal.length,
             outrosCount: uniqueResults.length - cguFinal.length - tcuFinal.length
          },
          parsingDebug: {
             filesInfo
          },
          zeroResultsParams: uniqueResults.length === 0 ? {
              searchedFields: ['_full_text'],
              suggestionReason: 'Verifique sinônimos.'
          } : undefined
      },
      suggestions: expandedTerms
  };
};

// === INGESTÃO CSV COM PAPAPARSE (Bug 2 Fix - Robust Parsing) ===
export const parseCSV = (content: string, filename: string): { data: any[], stats: FileStats, frequentTerms: string[], detectedSource: 'CGU'|'TCU'|'OUTROS' } => {
  // 1. Transform Header (Normalização imediata)
  // 2. Delimitador automático
  const parsed = Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      delimiter: "", // Auto-detect
      quoteChar: '"',
      transformHeader: (h) => normalizeHeader(h) // Normaliza headers na entrada: "Texto Resumo" -> "texto_resumo"
  });

  const rows = parsed.data as any[];
  const meta = parsed.meta;
  const normalizedHeaders = meta.fields || [];

  // Detecção de Fonte usando headers normalizados
  const source = detectSource(normalizedHeaders, filename);

  // Processamento de Linhas
  const processedRows = rows.map((row, idx) => {
      // Injeta campos normalizados para busca (titulo, etc) diretamente na row para o Fuse
      // Isso é necessário pois as chaves originais foram normalizadas pelo transformHeader
      const mappedRow: any = { ...row };
      
      // Mapeia colunas críticas para nomes padrão para facilitar peso no Fuse (name: 'titulo')
      if (getMappedValue(row, 'titulo')) mappedRow['titulo'] = getMappedValue(row, 'titulo');
      
      const fullText = generateFullTextRow(row);
      
      return {
          ...mappedRow,
          _full_text: fullText, 
          _source: source,
          _rowIdx: idx,
          _sourceFile: filename,
          _sourceId: filename
      };
  });
  
  // Termos frequentes
  let allText = '';
  processedRows.slice(0, 200).forEach(r => allText += ' ' + r._full_text);

  const extractFrequentTerms = (text: string): string[] => {
      const words = text.split(' ').filter(w => w.length > 4 && !STOPWORDS.has(w));
      const freq: Record<string, number> = {};
      words.forEach(w => freq[w] = (freq[w] || 0) + 1);
      return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([w]) => w);
  };

  return {
    data: processedRows,
    frequentTerms: extractFrequentTerms(allText),
    detectedSource: source,
    stats: {
      rowCount: processedRows.length,
      columnCount: normalizedHeaders.length,
      columns: normalizedHeaders, // Retornando headers normalizados
      normalizedHeaders: normalizedHeaders,
      columnsIncludedInSearch: normalizedHeaders,
      nullValues: 0,
      delimiterDetected: meta.delimiter,
      sampleRow: processedRows[0]
    }
  };
};


// === Helpers Utilitários (Mantidos) ===

const extractStructuredFindingsFromResults = (results: DatabaseResult[], keywords: string[]): StructuredFinding[] => {
    const findings: StructuredFinding[] = [];
    const MAX_FINDINGS = 12;

    for (const res of results) {
        if (findings.length >= MAX_FINDINGS) break;

        const text = normalizeText(res.snippet || '');
        let type: StructuredFinding['tipo'] | null = null;

        if (text.includes('achado') || text.includes('irregularidade') || text.includes('ilegal') || text.includes('impropriedade')) type = 'Achado';
        else if (text.includes('fragilidade') || text.includes('falha') || text.includes('risco') || text.includes('ausencia')) type = 'Fragilidade';
        else if (text.includes('recomenda') || text.includes('determina')) type = 'Recomendação';

        if (type) {
            findings.push({
                tipo: type,
                descricao: res.snippet?.substring(0, 200).replace(/\n/g, ' ') || 'Descrição indisponível',
                palavras_chave: keywords.filter(k => text.includes(k)),
                fonte: res.orgao === 'CGU' || res.orgao === 'TCU' ? res.orgao : 'DADOS'
            });
        }
    }
    return findings;
};

export const generateHtmlReport = (
    query: string, 
    results: { cgu: DatabaseResult[], tcu: DatabaseResult[], findings: StructuredFinding[] },
    sintese: string
): string => {
    const now = new Date().toLocaleDateString('pt-BR');
    const seedData = JSON.stringify({
        query,
        generated_at: new Date().toISOString(),
        stats: { cgu: results.cgu.length, tcu: results.tcu.length, achados: results.findings.length },
        results
    });

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Relatório de Auditoria: ${query}</title>
    <style>
        body { font-family: sans-serif; line-height: 1.6; color: #333; max-width: 1200px; margin: 0 auto; padding: 20px; background: #f9f9f9; }
        h1, h2, h3 { color: #0f4c81; }
        .header { background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); margin-bottom: 20px; }
        .tag { display: inline-block; background: #e0f2f1; color: #00695c; padding: 2px 8px; border-radius: 4px; font-size: 0.8em; font-weight: bold; }
        .section { background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 0.9em; }
        th, td { padding: 12px; border-bottom: 1px solid #eee; text-align: left; }
        th { background-color: #f1f5f9; color: #475569; }
        tr:hover { background-color: #f8fafc; }
        .achado { border-left: 4px solid #d32f2f; padding-left: 10px; }
        .btn { display: inline-block; margin-top: 10px; text-decoration: none; color: white; background: #0f4c81; padding: 5px 10px; border-radius: 4px; font-size: 0.8em; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Painel de Auditoria: ${query}</h1>
        <p>Data: ${now}</p>
        <div>
            <span class="tag">CGU: ${results.cgu.length}</span>
            <span class="tag">TCU: ${results.tcu.length}</span>
        </div>
    </div>
    <div class="section">
        <h2>1. Resumo Executivo</h2>
        <div>${sintese.replace(/\n/g, '<br>')}</div>
    </div>
    <div class="section">
        <h2>2. Relatórios CGU</h2>
        <table>
            <tbody>
                ${results.cgu.map(r => `<tr><td><strong>${r.titulo}</strong><br><em>${r.snippet}</em></td><td><a href="${r.link}" class="btn">Link</a></td></tr>`).join('')}
            </tbody>
        </table>
    </div>
    <div class="section">
        <h2>3. Acórdãos TCU</h2>
        <table>
            <tbody>
                ${results.tcu.map(r => `<tr><td><strong>${r.titulo}</strong><br><em>${r.snippet}</em></td><td><a href="${r.link}" class="btn">Link</a></td></tr>`).join('')}
            </tbody>
        </table>
    </div>
</body>
</html>`;
};

// Funções legadas mantidas
export const extractMetadata = (file: File, textContent: string): ReportMetadata => {
  const name = file.name;
  return {
    ano: '2023',
    titulo: name,
    orgao: 'OUTROS',
    link_oficial: '#'
  };
};

export const redactPII = (text: string) => text;
export const mockExtractText = async (file: File) => await file.text();
export const extractFindings = (content: string, filename: string): Finding[] => {
  const findings: Finding[] = [];
  const keywords = ['ACHADO', 'CONSTATAÇÃO', 'IRREGULARIDADE', 'FRAGILIDADE', 'RECOMENDAÇÃO', 'DETERMINAÇÃO'];
  if (!content) return findings;
  const lines = content.split('\n');
  lines.forEach((line, index) => {
      const upperLine = line.toUpperCase();
      for (const kw of keywords) {
          if (upperLine.includes(kw) && line.length > 20) {
               let type: Finding['type'] = 'ACHADO';
               if (kw === 'RECOMENDAÇÃO' || kw === 'DETERMINAÇÃO') type = 'RECOMENDACAO';
               if (kw === 'FRAGILIDADE') type = 'FRAGILIDADE';
               findings.push({
                   id: `auto-${filename}-${index}`,
                   type: type,
                   text: line.trim().substring(0, 300),
                   sourceFileName: filename,
                   sourceFileId: filename,
                   confidence: 0.7
               });
          }
      }
  });
  return findings.slice(0, 10);
};

export const calculateScore = (files: UploadedFile[], findings: Finding[], webSourcesCount: number): AnalysisScore => {
  let dataQuality = 0;
  let evidenceStrength = 0;
  let webCorroboration = 0;
  const csvFiles = files.filter(f => f.type === 'csv');
  if (csvFiles.length > 0) {
      dataQuality += 40; 
      csvFiles.forEach(f => {
           if (f.stats && f.stats.outliers && f.stats.outliers > 0) dataQuality += 20;
           if (f.stats && f.stats.rowCount && f.stats.rowCount > 50) dataQuality += 20;
      });
  }
  const pdfFiles = files.filter(f => f.type !== 'csv');
  if (pdfFiles.length > 0) evidenceStrength += 30;
  if (findings.length > 0) {
      evidenceStrength += Math.min(findings.length * 5, 70);
  }
  webCorroboration = Math.min(webSourcesCount * 20, 100);
  const total = Math.round((dataQuality * 0.4) + (evidenceStrength * 0.4) + (webCorroboration * 0.2));
  return {
      total: Math.min(total, 100),
      breakdown: {
          dataQuality: Math.min(dataQuality, 100),
          evidenceStrength: Math.min(evidenceStrength, 100),
          webCorroboration
      }
  };
};