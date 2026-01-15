import Papa from 'papaparse';
import { expandQuery } from './synonyms';
import { STOPWORDS } from '../constants';

interface CsvRow {
    [key: string]: string;
}

interface IndexedRow {
    row: CsvRow;
    normalizedString: string;
}

let cachedContext = '';
let saudeRows: IndexedRow[] = [];
let tcuRows: IndexedRow[] = [];

// Helper Constants and Functions for Search & Ranking
const KEYS = {
    DATA: ['DataPublicacao', 'Data', 'DATA', 'Ano', 'ANO', 'DtaPublicacao', 'DT_PUBLICACAO'],
    UF: ['UFs', 'UF', 'SiglaUF', 'uf', 'SG_UF', 'Estado', 'ESTADO'],
    UNIDADE: ['UnidadesAuditadas', 'Unidade Auditada', 'Unidade', 'SiglasUnidadesAuditadas', 'NO_UNIDADE'],
    TIPO: ['TipoServico', 'Tipo de Serviço', 'Origem', 'DS_TIPO_SERVICO'],
    TITULO: ['Titulo', 'Título', 'TITULO', 'Assunto', 'ASSUNTO', 'DS_TITULO'],
    LINK: ['link', 'Link', 'LINK', 'Endereço', 'ENDERECO', 'url', 'URL'],
    RESUMO: ['texto_resumo', 'Resumo', 'RESUMO', 'SUMARIO', 'RESUMO_EXTRATIVO', 'DS_RESUMO']
};

const getValue = (row: CsvRow, possibleKeys: string[]): string | undefined => {
    for (const key of possibleKeys) {
        if (row[key] !== undefined && row[key] !== null && row[key].trim() !== '') {
            return row[key];
        }
        // Case-insensitive fallback
        const foundKey = Object.keys(row).find(k => k.toLowerCase() === key.toLowerCase());
        if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && row[foundKey].trim() !== '') {
            return row[foundKey];
        }
    }
    return undefined;
};

const parseRowDate = (row: CsvRow): number => {
    let dateStr = getValue(row, KEYS.DATA);

    // Fallback: Try extracting year from Title (Common in TCU: "Acórdão 1234/2022")
    if (!dateStr) {
        const titulo = getValue(row, KEYS.TITULO) || '';
        const yearMatch = titulo.match(/\/(\d{4})/);
        if (yearMatch) return new Date(`${yearMatch[1]}-01-01`).getTime();
        return 0;
    }

    dateStr = dateStr.trim();

    // Format: DD/MM/YYYY
    const ddmmyyyy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (ddmmyyyy) {
        return new Date(parseInt(ddmmyyyy[3]), parseInt(ddmmyyyy[2]) - 1, parseInt(ddmmyyyy[1])).getTime();
    }

    // Format: YYYY-MM-DD or YYYY/MM/DD
    const yyyymmdd = dateStr.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if (yyyymmdd) {
        return new Date(parseInt(yyyymmdd[1]), parseInt(yyyymmdd[2]) - 1, parseInt(yyyymmdd[3])).getTime();
    }

    // Format: YYYY
    if (/^\d{4}$/.test(dateStr)) {
        return new Date(`${dateStr}-01-01`).getTime();
    }

    return 0; // Unknown or invalid date
};

const sanitizeLink = (url: string | undefined): string => {
    if (!url || url.trim() === '') {
        return 'https://www.gov.br/cgu/pt-br';
    }
    let cleanUrl = url.trim();
    if (!/^https?:\/\//i.test(cleanUrl)) {
        cleanUrl = 'https://' + cleanUrl;
    }
    return cleanUrl;
};

export const loadData = async (): Promise<void> => {
    if (cachedContext) return;

    try {
        // [LINUX FIX] Enforcing strict lowercase paths for Vercel/Linux deployment compatibility
        const [saudeResponse, tcuResponse] = await Promise.all([
            fetch('/dados/auditorias-saude.csv'),
            fetch('/dados/tcu-resumido-v2.csv')
        ]);

        if (!saudeResponse.ok || !tcuResponse.ok) {
            throw new Error('Erro ao carregar arquivos CSV (Verifique caminho /dados/ no deploy).');
        }

        const saudeText = await saudeResponse.text();
        const tcuText = await tcuResponse.text();

        // AÇÃO CORRETIVA: Forçar delimitador ';' e encoding (se necessário, o browser costuma lidar bem com UTF-8).
        // Se houver problemas de acentuação, pode ser necessário passar { encoding: 'ISO-8859-1' } no fetch ou decoder, 
        // mas o PapaParse no browser recebe string. Vamos assumir UTF-8 por enquanto, mas GARANTIR o delimitador.
        // AÇÃO CORRETIVA: Forçar delimitador ';' e encoding
        const rawSaude = Papa.parse(saudeText, { header: true, delimiter: ';' }).data as CsvRow[];
        const rawTcu = Papa.parse(tcuText, { header: true, delimiter: ';' }).data as CsvRow[];

        // PRE-COMPUTE: Normalize strings once at startup
        const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        saudeRows = rawSaude.map(r => ({
            row: r,
            normalizedString: normalize(JSON.stringify(r))
        }));

        tcuRows = rawTcu.map(r => ({
            row: r,
            normalizedString: normalize(JSON.stringify(r))
        }));

        // DEBUG OBRIGATÓRIO
        if (saudeRows.length > 0) {
            console.log('DEBUG - Colunas Saúde (delimiter ;):', Object.keys(saudeRows[0].row));
        }

        const saudeString = saudeRows.map(item => JSON.stringify(item.row)).join('\n');
        const tcuString = tcuRows.map(item => JSON.stringify(item.row)).join('\n');

        // Mantemos o cachedContext original para fallback ou uso geral se necessário
        cachedContext = `
=== DADOS CGU (AUDITORIAS SAÚDE) ===
${saudeString}

=== DADOS TCU (ACÓRDÃOS) ===
${tcuString}
`;
        console.log("Contexto carregado com sucesso. Total Linhas Saúde:", saudeRows.length, "Total Linhas TCU:", tcuRows.length);

    } catch (error) {
        console.error("Erro no loadData:", error);
        cachedContext = "ERRO AO CARREGAR DADOS. RESPONDA APENAS QUE HOUVE UM ERRO TÉCNICO.";
    }
};

export const getContextString = (): string => {
    return cachedContext;
};

interface ScoredRow {
    row: CsvRow;
    score: number;
    timestamp: number;
    source: 'CGU' | 'TCU';
}

const findRelevantRows = (query: string): ScoredRow[] => {
    if (!query) return [];

    const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const rawQuery = normalize(query);
    const queryWords = rawQuery.split(/\s+/);
    const keywords = queryWords.filter(k => k.length >= 2 && !STOPWORDS.has(k));

    // Expand Synonyms (Global Query Expansion)
    // We expand based on the FULL query to capture multi-word terms like "saude indigena"
    const globalSynonyms = expandQuery(rawQuery).map(normalize);

    // Also map specific keywords to their synonyms for the "All Keywords" check
    const keywordSynonymsMap: Record<string, string[]> = {};
    keywords.forEach(k => {
        // We can still try to expand individual keywords if they match single keys
        const wordSynonyms = expandQuery(k).map(normalize).filter(s => s !== k);
        keywordSynonymsMap[k] = wordSynonyms;
    });

    // Combine all expansion terms for the "Synonym Match" score
    const allExpandedTerms = [...new Set([...globalSynonyms, ...Object.values(keywordSynonymsMap).flat()])];

    const scoreIndexedRow = (indexed: IndexedRow, source: 'CGU' | 'TCU'): ScoredRow | null => {
        let score = 0;
        // USE PRE-COMPUTED STRING
        const rowString = indexed.normalizedString;

        // 1. Exact Phrase Match (+100)
        if (rowString.includes(rawQuery)) score += 100;

        // 2. All Keywords Matches (+50)
        if (keywords.length > 0) {
            const allKeywordsPresent = keywords.every(k => {
                return rowString.includes(k) || (keywordSynonymsMap[k] && keywordSynonymsMap[k].some(syn => rowString.includes(syn)));
            });
            if (allKeywordsPresent) score += 50;
        }

        // 3. Synonyms (+10)
        if (allExpandedTerms.length > 0) {
            if (allExpandedTerms.some(term => rowString.includes(term))) score += 10;
        }

        // 4. Partial Matches (+1 per word)
        keywords.forEach(k => { if (rowString.includes(k)) score += 1; });

        if (score < 2) return null;

        return {
            row: indexed.row, // Return original row
            score,
            timestamp: parseRowDate(indexed.row),
            source
        };
    };

    let allScored: ScoredRow[] = [];
    // Efficient Loop
    for (let i = 0; i < saudeRows.length; i++) {
        const result = scoreIndexedRow(saudeRows[i], 'CGU');
        if (result) allScored.push(result);
    }
    for (let i = 0; i < tcuRows.length; i++) {
        const result = scoreIndexedRow(tcuRows[i], 'TCU');
        if (result) allScored.push(result);
    }

    return allScored;
};

const checkMatch = (rowValue: string | undefined, filterValue: string) => {
    if (!rowValue) return false;
    const values = rowValue.split(';').map(v => v.trim().toLowerCase());
    return values.includes(filterValue.toLowerCase());
};

export const getSearchFacets = (query: string, currentFilters?: { uf?: string, ano?: string }): { ufs: string[], anos: string[] } => {
    if (!query || query.trim().length < 3) {
        return { ufs: [], anos: [] };
    }

    const rows = findRelevantRows(query);

    // Calculate UFs: Filter by Year if present (ignore UF filter)
    const yearFiltered = currentFilters?.ano ? rows.filter(item => {
        const year = new Date(item.timestamp).getFullYear().toString();
        return year === currentFilters.ano;
    }) : rows;

    const ufs = new Set<string>();
    yearFiltered.forEach(item => {
        const ufRaw = getValue(item.row, KEYS.UF);
        if (ufRaw) {
            ufRaw.split(';').forEach(u => {
                const clean = u.trim().toUpperCase();
                if (clean.length === 2) ufs.add(clean);
            });
        }
    });

    // Calculate Years: Filter by UF if present (ignore Year filter)
    const ufFiltered = currentFilters?.uf ? rows.filter(item => {
        const rowUF = getValue(item.row, KEYS.UF);
        return checkMatch(rowUF, currentFilters.uf!);
    }) : rows;

    const anos = new Set<string>();
    ufFiltered.forEach(item => {
        if (item.timestamp > 0) {
            const year = new Date(item.timestamp).getFullYear();
            if (year > 1990 && year <= new Date().getFullYear() + 1) {
                anos.add(year.toString());
            }
        }
    });

    return {
        ufs: Array.from(ufs).sort(),
        anos: Array.from(anos).sort((a, b) => b.localeCompare(a))
    };
};

export const searchInContext = (query: string, filters?: { uf?: string, ano?: string, source?: string }): string => {
    if (!query) return "";

    let allScored = findRelevantRows(query);

    if (allScored.length === 0) {
        let msg = "Nenhum registro relevante encontrado para o termo: " + query;
        if (filters && (filters.uf || filters.ano)) {
            msg += ` (Filtros: UF=${filters.uf || 'Todos'}, Ano=${filters.ano || 'Todos'})`;
        }
        return msg;
    }

    // Filter by strict filters if present
    // Filter by strict filters if present
    if (filters) {
        if (filters.uf) {
            allScored = allScored.filter(item => {
                const rowUF = getValue(item.row, KEYS.UF);
                return checkMatch(rowUF, filters.uf!);
            });
        }
        if (filters.ano && filters.ano !== 'Todos') {
            allScored = allScored.filter(item => {
                const year = new Date(item.timestamp).getFullYear().toString();
                return year === filters.ano;
            });
        }
        // Source Filter
        if (filters.source && filters.source !== 'ALL' && filters.source !== 'FINDINGS') {
            allScored = allScored.filter(item => item.source === filters.source);
        }
    }

    // === IMPLICIT UF FILTERING (State Detection) ===
    // If no explicit UF filter is set, check if the user mentioned a state in the query.
    // e.g. "relatórios do Acre" -> Filter for AC
    if (!filters?.uf) {
        import('./synonyms').then(({ SYNONYMS }) => {
            // This is async inside a sync function, so we must rely on the sync SYNONYMS if we can,
            // or just iterate the logic. Since we can't do async await here easily without refactoring everything,
            // let's grab the keys from our own memory or use a direct check if the SYNONYMS object is imported.
            // Actually, we can just use the expanded query terms to check against known state codes.
        });

        // Hardcoded workaround since we can't import asynchronously in this sync function easily
        // We will infer from the normalized query tokens.
        const STATE_MAP: Record<string, string> = {
            'acre': 'AC', 'alagoas': 'AL', 'amapa': 'AP', 'amazonas': 'AM', 'bahia': 'BA', 'ceara': 'CE',
            'distrito federal': 'DF', 'brasilia': 'DF', 'espirito santo': 'ES', 'goias': 'GO', 'maranhao': 'MA',
            'mato grosso': 'MT', 'mato grosso do sul': 'MS', 'minas gerais': 'MG', 'para': 'PA', 'paraiba': 'PB',
            'parana': 'PR', 'pernambuco': 'PE', 'piaui': 'PI', 'rio de janeiro': 'RJ', 'rio grande do norte': 'RN',
            'rio grande do sul': 'RS', 'rondonia': 'RO', 'roraima': 'RR', 'santa catarina': 'SC',
            'sao paulo': 'SP', 'sergipe': 'SE', 'tocantins': 'TO',
            // Also map abbreviations themselves if used explicitly like "em SP"
            'ac': 'AC', 'al': 'AL', 'ap': 'AP', 'am': 'AM', 'ba': 'BA', 'ce': 'CE', 'df': 'DF', 'es': 'ES',
            'go': 'GO', 'ma': 'MA', 'mt': 'MT', 'ms': 'MS', 'mg': 'MG', 'pa': 'PA', 'pb': 'PB', 'pr': 'PR',
            'pe': 'PE', 'pi': 'PI', 'rj': 'RJ', 'rn': 'RN', 'rs': 'RS', 'ro': 'RO', 'rr': 'RR', 'sc': 'SC',
            'sp': 'SP', 'se': 'SE', 'to': 'TO'
        };

        const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const cleanQuery = normalize(query);

        let detectedUF = '';

        // Check for full state names first (longer matches)
        const entries = Object.entries(STATE_MAP).sort((a, b) => b[0].length - a[0].length);

        for (const [name, sigla] of entries) {
            // Check for exact word matches to avoid "para" matching "parana" incorrectly if not careful
            // We use regex boundary \b
            const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b${escapedName}\\b`, 'i');
            if (regex.test(cleanQuery)) {
                detectedUF = sigla;
                // Avoid capturing "para" as PA if it's just a preposition, unless "estado do para"
                // This is a simple heuristic. For "para", it's risky.
                if (name === 'para' && !cleanQuery.includes('estado do para') && !cleanQuery.includes('no para')) {
                    // Skip generic prepositions if ambiguous, but here we assume users are specific.
                    // Let's assume if they type "para" it CAN be a preposition. 
                    // Safest is to IGNORE 'para' unless it is clearly a state context.
                    // But "Acre", "Bahia", "Roraima" are safe.
                    if (cleanQuery.split(' ').includes('para')) continue;
                }
                console.log(`[Smart Search] Implicit UF Detected: ${name.toUpperCase()} -> ${detectedUF}`);
                break;
            }
        }

        if (detectedUF) {
            allScored = allScored.filter(item => {
                const rowUF = getValue(item.row, KEYS.UF);
                // Allow matches if row has the detected UF (handling multi-value fields like "AP;BA")
                return checkMatch(rowUF, detectedUF);
            });
        }
    }

    // === IMPLICIT YEAR FILTERING ===
    // If no explicit Year filter is set, check if the query contains a year (e.g. "2023", "2024")
    if (!filters?.ano || filters.ano === 'Todos') {
        const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const cleanQuery = normalize(query);

        // Regex for 4 digits (word boundary to avoid partial numbers)
        const yearMatch = cleanQuery.match(/\b(20\d{2})\b/);

        if (yearMatch) {
            const detectedYear = yearMatch[1];
            const yearNum = parseInt(detectedYear);
            const currentYear = new Date().getFullYear();

            // Sanity check: reasonable range (e.g., 2000 to Current + 1)
            if (yearNum >= 2000 && yearNum <= currentYear + 1) {
                console.log(`[Smart Search] Implicit YEAR Detected: ${detectedYear}`);

                allScored = allScored.filter(item => {
                    const itemYear = new Date(item.timestamp).getFullYear().toString();
                    return itemYear === detectedYear;
                });
            }
        }
    }

    // Dynamic Search Relevancy Filter
    if (allScored.length === 0) {
        return `Nenhum registro encontrado com os filtros selecionados (Termo: ${query}).`;
    }

    const maxScore = Math.max(...allScored.map(s => s.score));
    const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const rawQuery = normalize(query);
    const keywords = rawQuery.split(/\s+/).filter(k => k.length >= 2 && !STOPWORDS.has(k));
    const isSpecificSearch = keywords.length > 1;

    let relevantResults = allScored;
    if (isSpecificSearch) {
        if (maxScore >= 50) {
            relevantResults = allScored.filter(item => item.score >= 40);
        } else {
            relevantResults = allScored.filter(item => item.score >= 10);
        }
    }

    // Sort: 
    // 1. Score (Relevance) DESC
    // 2. Date (Timestamp) DESC (Newest first)
    relevantResults.sort((a, b) => {
        if (b.score !== a.score) {
            return b.score - a.score;
        }
        return b.timestamp - a.timestamp;
    });

    // Take top 20 results (combined sources)
    const topResults = relevantResults.slice(0, 20);

    // Formatação Output
    const formattedRows = topResults.map((item, index) => {
        const r = item.row;
        const id = index + 1; // 1-based ID for the LLM

        const titulo = getValue(r, KEYS.TITULO) || 'Título não disponível';
        const link = sanitizeLink(getValue(r, KEYS.LINK));
        const resumo = getValue(r, KEYS.RESUMO) || 'Resumo indisponível';
        let dataStr = getValue(r, KEYS.DATA); // Display formatted string from CSV if available

        // If dataStr is missing/ugly, maybe use the parsed date? 
        // Let's stick to CSV value if present, else fallback.
        if (!dataStr) {
            const d = new Date(item.timestamp);
            if (!isNaN(d.getTime()) && item.timestamp > 0) {
                dataStr = d.toLocaleDateString('pt-BR');
            } else {
                dataStr = 'Data n/d';
            }
        }

        if (item.source === 'CGU') {
            const uf = getValue(r, KEYS.UF) || 'UF n/d';
            const unidade = getValue(r, KEYS.UNIDADE) || 'Unidade n/d';
            const tipo = getValue(r, KEYS.TIPO) || 'Tipo n/d';
            return `[ID: #${id}] [FONTE: CGU | Data: ${dataStr} | UF: ${uf} | Unidade: ${unidade} | Tipo: ${tipo} | Título: ${titulo} | Link: ${link} | Resumo: ${resumo}]`;
        } else {
            // TCU
            return `[ID: #${id}] [FONTE: TCU | Data: ${dataStr} | Título: ${titulo} | Link: ${link} | Resumo: ${resumo}]`;
        }
    }).join('\n');

    const finalContext = `
=== RESULTADO DA BUSCA INTELIGENTE (RANKED: RELEVANCE > DATE) ===
Termo: "${query}"
Filtros: UF=${filters?.uf || 'Todos'}, Ano=${filters?.ano || 'Todos'}
Status: ${isSpecificSearch ? "Busca Específica (Sinônimos Desativados)" : "Busca Ampliada (Sinônimos Ativos)"}
Encontrados: ${relevantResults.length} | Exibindo: ${topResults.length}

=== CONTEXTO RELEVANTE ===
${formattedRows}
`;

    // console.log(`Smart Search: "${query}" -> ${relevantResults.length} matches. Top score: ${topResults[0]?.score}`);
    console.log(`Smart Search: "${query}" | Filters: ${JSON.stringify(filters)} | Matches: ${relevantResults.length} | Top: Score ${topResults[0]?.score} Date ${topResults[0]?.timestamp}`);

    return finalContext;
};
