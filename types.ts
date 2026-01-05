export interface ChatMessage {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string; // Used for the executive summary text
  timestamp: Date;
  structuredFindings?: StructuredFinding[]; // Array for the table
  sources?: Source[];
}

export interface Source {
  title: string;
  uri: string;
  snippet?: string;
  type: 'web' | 'file';
}

export interface UploadedFile {
  id: string;
  name: string;
  type: 'csv' | 'pdf' | 'excel';
  size: number;
  content: string | null;
  processedData?: any[]; // Array of rows
  fullTextIndex?: string[]; // For PDFs: Array of text chunks/pages normalized
  stats?: FileStats;
  metadata?: ReportMetadata; // New metadata for links/years
  frequentTerms?: string[]; // Top terms for data-driven suggestions
  detectedSource?: 'CGU' | 'TCU' | 'OUTROS'; // Fonte detectada na ingestão
}

export interface ReportMetadata {
  id_relatorio?: string;
  ano: string;
  uf?: string;
  titulo: string;
  orgao: 'CGU' | 'TCU' | 'OUTROS';
  link_oficial: string;
}

export interface FileStats {
  rowCount?: number;
  columnCount?: number;
  columns?: string[]; // Headers originais
  normalizedHeaders?: string[]; // Headers normalizados para debug
  columnsIncludedInSearch?: string[];
  outliers?: number;
  nullValues?: number;
  textCoverage?: number; // % of rows with valid text
  delimiterDetected?: string; // Para debug do parser
  sampleRow?: any; // Para debug
}

export interface Finding {
  id: string;
  type: 'ACHADO' | 'RECOMENDACAO' | 'FRAGILIDADE';
  text: string;
  sourceFileId?: string;
  sourceFileName?: string;
  page?: number;
  confidence: number;
}

export interface StructuredFinding {
  tipo: 'Achado' | 'Fragilidade' | 'Recomendação';
  descricao: string;
  palavras_chave: string[];
  fonte: 'CGU' | 'TCU' | 'DADOS';
  link?: string; // Campo novo para URL clicável
}

export interface AuditContext {
  uf: string;
  municipio: string;
  periodoInicio: string;
  periodoFim: string;
  tema: string;
}

export interface AnalysisScore {
  total: number;
  breakdown: {
    dataQuality: number;
    evidenceStrength: number;
    webCorroboration: number;
  };
}

// Interface para resultados de busca nos CSVs (Database Mode)
export interface DatabaseResult {
  id: string; // unique ID for key
  titulo: string;
  data: string;
  uf: string;
  municipio?: string;
  orgao: 'CGU' | 'TCU' | 'OUTROS';
  link: string;
  relevancia: number; // Score para ordenação
  resumo?: string;
  snippet?: string; // Trecho onde o termo foi encontrado
  sourceFile: string;
  __source: 'CGU' | 'TCU' | 'OUTROS'; // Campo interno de roteamento
}

// Interface de Diagnóstico de Busca
export interface SearchDiagnostics {
  originalQuery: string;
  normalizedQuery: string;
  searchMode: 'OR' | 'AND' | 'PHRASE';
  expandedTerms: string[];
  totalFilesSearched: number;
  totalRowsScanned: number;
  executionTimeMs: number;
  zeroResultsParams?: {
    searchedFields: string[];
    suggestionReason: string;
  };
  sourcesBreakdown: {
    cguCount: number;
    tcuCount: number;
    outrosCount: number;
  };
  parsingDebug: {
    filesInfo?: { name: string, rows: number, delimiter: string, headers: string[] }[];
  };
}