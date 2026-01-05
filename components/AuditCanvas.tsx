import React, { useState } from 'react';
import { StructuredFinding, UploadedFile, Source, DatabaseResult, SearchDiagnostics } from '../types';
import { generateHtmlReport } from '../services/dataService';

interface AuditCanvasProps {
  sintese: string;
  structuredFindings: StructuredFinding[];
  files: UploadedFile[];
  dbResults: { cgu: DatabaseResult[], tcu: DatabaseResult[] };
  webSources: Source[];
  isLoading: boolean;
  diagnostics: SearchDiagnostics | null;
  suggestedTerms: string[];
  onRetrySearch: (term: string) => void;
}

export const AuditCanvas: React.FC<AuditCanvasProps> = ({ 
  sintese, structuredFindings, dbResults, webSources, isLoading, 
  diagnostics, suggestedTerms, onRetrySearch 
}) => {
  
  const { cgu: cguResults, tcu: tcuResults } = dbResults;
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const handleExport = () => {
      const htmlContent = generateHtmlReport(
          diagnostics?.originalQuery || 'Relatório',
          { cgu: cguResults, tcu: tcuResults, findings: structuredFindings },
          sintese
      );
      
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Painel_Auditoria_${diagnostics?.originalQuery || 'CGSAU'}.html`;
      a.click();
      URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gray-50 text-gray-500 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
        <p className="font-medium animate-pulse">Examinando bases de dados...</p>
        <p className="text-xs text-gray-400">Aplicando expansão de consulta e busca fuzzy...</p>
      </div>
    );
  }

  // Zero State
  if (!sintese && structuredFindings.length === 0 && cguResults.length === 0 && tcuResults.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 text-gray-400">
        <div className="text-center p-8 max-w-md">
           <h3 className="text-lg font-medium text-gray-600">Painel de Auditoria Vazio</h3>
           <p className="text-sm mt-2">Carregue arquivos e pesquise por QUALQUER tema (ex: "Sesai", "Medicamentos").</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-100 p-6 space-y-8">
      
      {/* Header & Actions */}
      <div className="flex justify-between items-end border-b border-gray-300 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Painel de Auditoria: {diagnostics?.originalQuery}</h2>
          <div className="flex gap-2 mt-1">
             <span className="text-xs bg-teal-100 text-teal-800 px-2 py-0.5 rounded font-medium">CGU: {cguResults.length}</span>
             <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-medium">TCU: {tcuResults.length}</span>
          </div>
        </div>
        <div className="flex gap-2">
             <button 
                onClick={handleExport}
                className="text-xs px-3 py-1 rounded bg-teal-600 text-white hover:bg-teal-700 transition-colors flex items-center gap-1 shadow-sm"
            >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Exportar HTML
            </button>
            <button 
                onClick={() => setShowDiagnostics(!showDiagnostics)}
                className={`text-xs px-3 py-1 rounded border transition-colors ${showDiagnostics ? 'bg-amber-100 border-amber-300 text-amber-800' : 'bg-white border-gray-300 text-gray-600'}`}
            >
                {showDiagnostics ? 'Ocultar Diagnóstico' : 'Modo Diagnóstico'}
            </button>
        </div>
      </div>

      {/* E: MODO DIAGNÓSTICO */}
      {showDiagnostics && diagnostics && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs font-mono text-amber-900 shadow-inner overflow-hidden space-y-4">
              <h4 className="font-bold mb-2 uppercase border-b border-amber-200 pb-1">Diagnóstico do Motor de Busca</h4>
              
              <div className="grid grid-cols-2 gap-4">
                  <div>
                      <p><strong>Query:</strong> "{diagnostics.originalQuery}"</p>
                      <p><strong>Matches:</strong> CGU({diagnostics.sourcesBreakdown.cguCount}), TCU({diagnostics.sourcesBreakdown.tcuCount})</p>
                      <p><strong>Top Scores (Sim.):</strong> {cguResults.slice(0,3).map(r => r.relevancia.toFixed(0)).join(', ')}</p>
                  </div>
                  <div>
                      <p><strong>Termos Expandidos:</strong></p>
                      <div className="flex flex-wrap gap-1 mt-1">
                          {diagnostics.expandedTerms.map(t => (
                              <span key={t} className="bg-amber-100 px-1 rounded border border-amber-200">{t}</span>
                          ))}
                      </div>
                  </div>
              </div>

              {diagnostics.parsingDebug.filesInfo && (
                <div className="border-t border-amber-200 pt-2">
                  <p className="font-bold mb-1">Status da Ingestão de Arquivos:</p>
                  <div className="space-y-2">
                    {diagnostics.parsingDebug.filesInfo.map((f, idx) => (
                      <div key={idx} className="bg-white/50 p-2 rounded border border-amber-100">
                        <div className="flex justify-between font-bold">
                          <span>{f.name}</span>
                          <span>{f.rows} linhas</span>
                        </div>
                        <div className="text-[10px] text-amber-700 mt-1">
                           <strong>Delimitador:</strong> '{f.delimiter}' | <strong>Headers Detectados (Norm):</strong> {f.headers.join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>
      )}

      {/* 1. AI Synthesis */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 border-l-4 border-l-teal-500">
             <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-3">1. Resumo Executivo Consolidado</h3>
             <div className="prose prose-sm max-w-none text-gray-700">
                <div dangerouslySetInnerHTML={{ __html: sintese.replace(/\n/g, '<br/>').replace(/## (.*)/g, '<h4 class="font-bold mt-2">$1</h4>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
             </div>
      </div>

      {/* 2. Matriz de Achados */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
                <h3 className="text-sm font-bold text-gray-700">2. Matriz de Achados e Recomendações</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-4 py-3 w-32">Classificação</th>
                            <th className="px-4 py-3">Descrição do Fato / Evidência</th>
                            <th className="px-4 py-3 w-32">Fonte</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {structuredFindings.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">Nenhum achado estruturado identificado para "{diagnostics?.originalQuery}".</td></tr>}
                        {structuredFindings.map((finding, idx) => {
                            let typeColor = "text-gray-700";
                            if (finding.tipo === 'Achado') typeColor = "text-red-700 font-bold";
                            if (finding.tipo === 'Fragilidade') typeColor = "text-amber-700 font-medium";
                            if (finding.tipo === 'Recomendação') typeColor = "text-green-700 font-medium";
                            return (
                                <tr key={idx} className="hover:bg-gray-50/50">
                                    <td className={`px-4 py-3 align-top ${typeColor}`}>{finding.tipo}</td>
                                    <td className="px-4 py-3 align-top text-gray-800">{finding.descricao}</td>
                                    <td className="px-4 py-3 align-top">
                                        <div className="flex flex-col items-start gap-1">
                                            <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded text-gray-600 font-medium">{finding.fonte}</span>
                                            {finding.link && (
                                                <a 
                                                    href={finding.link} 
                                                    target="_blank" 
                                                    rel="noreferrer" 
                                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-600 hover:text-teal-800 hover:underline bg-teal-50 px-2 py-1 rounded border border-teal-100 mt-1"
                                                >
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                                    Ver Fonte
                                                </a>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 3. CGU Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-teal-700 px-4 py-2 border-b border-teal-800">
                <h3 className="text-sm font-bold text-white flex justify-between">
                    <span>3. Relatórios da CGU</span>
                    <span className="bg-white/20 px-2 rounded text-xs">{cguResults.length}</span>
                </h3>
            </div>
            <div className="overflow-x-auto max-h-[400px]">
                <table className="min-w-full text-left text-xs">
                    <thead className="bg-gray-50 text-gray-500">
                        <tr>
                            <th className="px-4 py-2">Título / Objeto</th>
                            <th className="px-4 py-2 w-20">Data</th>
                            <th className="px-4 py-2 w-12">UF</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {cguResults.length === 0 && <tr><td colSpan={3} className="px-4 py-4 text-center text-gray-400">Nenhum registro.</td></tr>}
                        {cguResults.map((item, i) => (
                            <tr key={i} className="hover:bg-gray-50 group">
                                <td className="px-4 py-3">
                                    <div className="font-bold text-gray-800 mb-1">{item.titulo}</div>
                                    <div className="text-gray-500 italic mb-1">"{item.snippet}"</div>
                                    <a href={item.link} target="_blank" rel="noreferrer" className="text-teal-600 hover:underline font-bold text-[10px]">Abrir Link</a>
                                </td>
                                <td className="px-4 py-3">{item.data}</td>
                                <td className="px-4 py-3">{item.uf}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>

        {/* 4. TCU Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-indigo-700 px-4 py-2 border-b border-indigo-800">
                <h3 className="text-sm font-bold text-white flex justify-between">
                    <span>4. Acórdãos do TCU</span>
                    <span className="bg-white/20 px-2 rounded text-xs">{tcuResults.length}</span>
                </h3>
            </div>
            <div className="overflow-x-auto max-h-[400px]">
                <table className="min-w-full text-left text-xs">
                    <thead className="bg-gray-50 text-gray-500">
                        <tr>
                            <th className="px-4 py-2">Título / Assunto</th>
                            <th className="px-4 py-2 w-20">Ano</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                         {tcuResults.length === 0 && <tr><td colSpan={2} className="px-4 py-4 text-center text-gray-400">Nenhum registro.</td></tr>}
                        {tcuResults.map((item, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                                <td className="px-4 py-3">
                                    <div className="font-bold text-gray-800 mb-1">{item.titulo}</div>
                                    <div className="text-gray-500 italic mb-1">"{item.snippet}"</div>
                                    <a href={item.link} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline font-bold text-[10px]">Ver Inteiro Teor</a>
                                </td>
                                <td className="px-4 py-3">{item.data}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      </div>

    </div>
  );
};