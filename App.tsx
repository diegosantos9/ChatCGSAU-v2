import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ChatArea } from './components/ChatArea';
import { EvidencePanel } from './components/EvidencePanel';
import { DataPanel } from './components/DataPanel';
import { AuditCanvas } from './components/AuditCanvas';
import { redactPII, parseCSV, extractFindings, mockExtractText, calculateScore, extractMetadata, searchAuditDatabase } from './services/dataService';
import { generateAuditResponse } from './services/geminiService';
import { ChatMessage, UploadedFile, Finding, AnalysisScore, AuditContext, StructuredFinding, Source, DatabaseResult, SearchDiagnostics } from './types';
import { DEMO_CSV_GASTOS, DEMO_CSV_PRODUCAO, MOCK_QUESTIONS } from './constants';

function App() {
  const [activeTab, setActiveTab] = useState<'CANVAS' | 'EVIDENCIAS' | 'DADOS'>('CANVAS');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // State for Canvas Content
  const [lastAuditSummary, setLastAuditSummary] = useState<string>('');
  const [lastStructuredFindings, setLastStructuredFindings] = useState<StructuredFinding[]>([]);
  const [lastWebSources, setLastWebSources] = useState<Source[]>([]);
  
  // State for Database Search Results & Diagnostics
  const [lastDbResults, setLastDbResults] = useState<{ cgu: DatabaseResult[], tcu: DatabaseResult[] }>({ cgu: [], tcu: [] });
  const [lastDiagnostics, setLastDiagnostics] = useState<SearchDiagnostics | null>(null);
  const [suggestedTerms, setSuggestedTerms] = useState<string[]>([]);

  const [context, setContext] = useState<AuditContext>({
    uf: '',
    municipio: '',
    periodoInicio: '',
    periodoFim: '',
    tema: ''
  });
  const [score, setScore] = useState<AnalysisScore>({ total: 0, breakdown: { dataQuality: 0, evidenceStrength: 0, webCorroboration: 0 } });
  
  useEffect(() => {
    setMessages([{
      id: 'init',
      role: 'system',
      content: 'Bem-vindo ao ChatCGSAU. Como Administrador, carregue as planilhas de relatórios (CGU) e acórdãos (TCU) para habilitar a auditoria.',
      timestamp: new Date()
    }]);
  }, []);

  useEffect(() => {
    const newScore = calculateScore(files, findings, lastWebSources.length);
    setScore(newScore);
  }, [files, findings, lastWebSources]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList) return;

    const newFiles: UploadedFile[] = [];
    const newFindings: Finding[] = [];

    const processingMsgId = uuidv4();
    setMessages(prev => [...prev, {
        id: processingMsgId,
        role: 'system',
        content: `Processando ${fileList.length} arquivo(s) (Ingestão + Full Text Indexing)...`,
        timestamp: new Date()
    }]);

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const id = uuidv4();
      let type: 'csv' | 'pdf' | 'excel' = 'pdf';
      
      if (file.name.endsWith('.csv')) type = 'csv';
      else if (file.name.endsWith('.xlsx')) type = 'excel';

      const textContent = await mockExtractText(file);
      const redactedContent = redactPII(textContent);
      
      const metadata = extractMetadata(file, textContent);

      let processedData = null;
      let stats = undefined;
      let frequentTerms: string[] = [];
      let detectedSource: 'CGU' | 'TCU' | 'OUTROS' = 'OUTROS';

      if (type === 'csv') {
        // A & D3: Ingestão gera full_text e termos frequentes
        const result = parseCSV(redactedContent, file.name);
        processedData = result.data;
        stats = result.stats;
        frequentTerms = result.frequentTerms;
        detectedSource = result.detectedSource;
      }

      if (type !== 'csv') {
        const extracted = extractFindings(redactedContent, file.name);
        newFindings.push(...extracted);
      }

      newFiles.push({
        id,
        name: file.name,
        type,
        size: file.size,
        content: redactedContent,
        processedData,
        stats,
        metadata,
        frequentTerms,
        detectedSource
      });
    }

    setFiles(prev => [...prev, ...newFiles]);
    setFindings(prev => [...prev, ...newFindings]);

    setMessages(prev => prev.map(msg => 
        msg.id === processingMsgId 
        ? { ...msg, content: `✅ ${fileList.length} arquivo(s) indexados. Modo Diagnóstico disponível.` }
        : msg
    ));
    
    setActiveTab('EVIDENCIAS');
  };

  const loadDemoData = async () => {
    const gastosFile = new File([DEMO_CSV_GASTOS], "gastos_contratos.csv", { type: "text/csv" });
    const prodFile = new File([DEMO_CSV_PRODUCAO], "producao_servicos.csv", { type: "text/csv" });
    const cguContent = `IdTarefa;Titulo;DataPublicacao;UF;UnidadesAuditadas;link
12345;Relatório de Auditoria SESAI 2023;2023-01-10;DF;SESAI;https://ecgu.cgu.gov.br/relatorio/12345
67890;Auditoria em Saúde Indígena Yanomami;2023-05-20;RR;DSEI-Y;
11223;Fiscalização de Contratos de Táxi Aéreo;2022-11-15;AM;DSEI-AM;https://ecgu.cgu.gov.br/relatorio/11223`;
    const tcuContent = `ACORDAO;TITULO;ASSUNTO;ANO;ENDERECO
1234/2023;Acórdão 1234/2023 - Plenário;Irregularidades em transporte aéreo na saúde indígena;2023;https://contas.tcu.gov.br/sagas/SvlVisualizarRelVotoAc?codFiltro=SAGAS-SESSAO-ENCERRADA&seOcultaPagina=S&item0=878164
5678/2022;Acórdão 5678/2022 - Câmara;Auditoria Operacional na SESAI;2022;`;

    const cguFile = new File([cguContent], "base_relatorios_cgu.csv", { type: "text/csv" });
    const tcuFile = new File([tcuContent], "base_acordaos_tcu.csv", { type: "text/csv" });

    const event = { target: { files: [gastosFile, prodFile, cguFile, tcuFile] } } as unknown as React.ChangeEvent<HTMLInputElement>;
    await handleFileUpload(event);
    setContext(prev => ({ ...prev, tema: 'Saúde Indígena', uf: 'DF', municipio: '' }));
  };

  const handleSendMessage = async (text: string) => {
    const userMsg: ChatMessage = { id: uuidv4(), role: 'user', content: text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // 1. Run Enhanced Search (Supports Any Topic + Synonyms)
      const searchResult = searchAuditDatabase(files, text);
      
      setLastDbResults({ cgu: searchResult.cgu, tcu: searchResult.tcu });
      setLastDiagnostics(searchResult.diagnostics);
      setSuggestedTerms(searchResult.suggestions);

      // 2. Generate AI Response
      const dbContextStr = `
        [RELATÓRIOS CGU ENCONTRADOS]: ${JSON.stringify(searchResult.cgu.slice(0, 5))}
        [ACÓRDÃOS TCU ENCONTRADOS]: ${JSON.stringify(searchResult.tcu.slice(0, 5))}
        [DIAGNÓSTICO DA BUSCA]: ${JSON.stringify(searchResult.diagnostics)}
      `;

      const result = await generateAuditResponse(text, files, JSON.stringify(context) + dbContextStr, findings);
      
      const webSources = result.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
            title: chunk.web?.title || 'Fonte Web',
            uri: chunk.web?.uri || '#',
            type: 'web'
      })) || [];

      const botMsg: ChatMessage = {
        id: uuidv4(),
        role: 'model',
        content: result.text || 'Não consegui gerar uma resposta.',
        timestamp: new Date(),
        sources: webSources
      };

      setMessages(prev => [...prev, botMsg]);
      
      setLastAuditSummary(result.text || '');
      setLastStructuredFindings(result.structuredFindings || []);
      setLastWebSources(webSources);
      
      setActiveTab('CANVAS');
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: uuidv4(),
        role: 'model',
        content: 'Erro ao conectar com o serviço de IA.',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearSession = () => {
    setMessages([]);
    setFiles([]);
    setFindings([]);
    setLastAuditSummary('');
    setLastStructuredFindings([]);
    setLastWebSources([]);
    setLastDbResults({ cgu: [], tcu: [] });
    setLastDiagnostics(null);
    setSuggestedTerms([]);
    setScore({ total: 0, breakdown: { dataQuality: 0, evidenceStrength: 0, webCorroboration: 0 } });
  };

  const handleRetrySearch = (term: string) => {
      setContext(prev => ({ ...prev, tema: term }));
      handleSendMessage(term);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-100">
      
      {/* Header */}
      <header className="bg-slate-800 text-white border-b border-gray-700 p-3 shadow-md z-20">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="bg-teal-500 text-white p-1.5 rounded font-bold text-sm tracking-widest">CGSAU</div>
             <div>
                <h1 className="text-lg font-bold leading-none">Auditor IA</h1>
                <span className="text-[10px] text-gray-400 uppercase tracking-wide">Acesso Administrativo</span>
             </div>
          </div>

          <div className="flex-1 flex gap-2 mx-4 items-center bg-slate-700/50 p-1.5 rounded-lg border border-slate-600 overflow-x-auto">
             <span className="text-xs font-semibold text-gray-400 px-2">FILTROS:</span>
             <input 
                type="text" 
                placeholder="Tema" 
                className="bg-slate-800 border border-slate-600 p-1 rounded text-xs w-32 text-white placeholder-gray-500"
                value={context.tema}
                onChange={e => setContext({...context, tema: e.target.value})}
              />
             <input 
                type="text" 
                placeholder="UF" 
                className="bg-slate-800 border border-slate-600 p-1 rounded text-xs w-12 text-white placeholder-gray-500"
                value={context.uf}
                onChange={e => setContext({...context, uf: e.target.value})}
              />
          </div>

          <div className="flex items-center gap-3">
             <div className="flex gap-2">
                <button onClick={loadDemoData} className="bg-slate-600 hover:bg-slate-500 text-white px-3 py-1.5 rounded text-xs transition-colors border border-slate-500 hidden md:block">
                  Simular Carga
                </button>
             </div>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* Left Side: Chat */}
        <div className="w-full md:w-[350px] lg:w-[400px] flex-shrink-0 flex flex-col border-r border-gray-200 bg-white z-10 shadow-lg">
           <div className="p-3 bg-gray-50 border-b border-gray-200">
              <h2 className="text-xs font-bold text-gray-500 uppercase">Interação Auditor</h2>
           </div>
           <ChatArea 
              messages={messages} 
              isLoading={isLoading} 
              onSendMessage={handleSendMessage}
              onClear={clearSession}
              onFileUpload={handleFileUpload}
            />
        </div>

        {/* Right Side: The Canvas (Main View) */}
        <div className="flex-1 flex flex-col bg-slate-100 min-w-0">
          <div className="flex border-b border-gray-200 bg-white px-4">
            <button
              onClick={() => setActiveTab('CANVAS')}
              className={`py-3 px-6 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'CANVAS' 
                  ? 'border-indigo-600 text-indigo-700' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Painel de Auditoria
            </button>
            <button
              onClick={() => setActiveTab('EVIDENCIAS')}
              className={`py-3 px-6 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'EVIDENCIAS' 
                  ? 'border-teal-600 text-teal-700' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Arquivos ({files.length})
            </button>
          </div>

          <div className="flex-1 overflow-hidden relative">
            {activeTab === 'CANVAS' && (
              <AuditCanvas 
                sintese={lastAuditSummary} 
                structuredFindings={lastStructuredFindings} 
                files={files} 
                dbResults={lastDbResults}
                webSources={lastWebSources}
                isLoading={isLoading}
                diagnostics={lastDiagnostics}
                suggestedTerms={suggestedTerms}
                onRetrySearch={handleRetrySearch}
              />
            )}
            
            {activeTab === 'EVIDENCIAS' && (
              <EvidencePanel files={files} findings={findings} score={score} />
            )}
            
            {activeTab === 'DADOS' && (
              <DataPanel files={files} />
            )}
          </div>
        </div>
      </main>
      
      <footer className="bg-slate-900 border-t border-slate-800 p-1 text-center text-[10px] text-gray-500">
        ChatCGSAU - Ambiente Seguro. Dados mascarados. Busca Full-Text Habilitada.
      </footer>
    </div>
  );
}

export default App;