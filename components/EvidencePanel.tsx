import React from 'react';
import { UploadedFile, Finding, AnalysisScore } from '../types';

interface EvidencePanelProps {
  files: UploadedFile[];
  findings: Finding[];
  score: AnalysisScore;
}

export const EvidencePanel: React.FC<EvidencePanelProps> = ({ files, findings, score }) => {
  return (
    <div className="h-full overflow-y-auto p-4 space-y-6">
      
      {/* Score Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h3 className="text-lg font-semibold text-gray-700 mb-2">Score de Risco/Relevância</h3>
        <div className="flex items-center gap-4">
          <div className={`text-4xl font-bold ${score.total > 70 ? 'text-red-500' : score.total > 40 ? 'text-amber-500' : 'text-green-500'}`}>
            {score.total}
            <span className="text-sm text-gray-400 font-normal">/100</span>
          </div>
          <div className="flex-1 space-y-2">
            <div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>Qualidade Dados (Outliers)</span>
                <span>{score.breakdown.dataQuality}</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500" style={{ width: `${Math.min(score.breakdown.dataQuality * 3.3, 100)}%` }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>Força Evidências (PDFs)</span>
                <span>{score.breakdown.evidenceStrength}</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500" style={{ width: `${Math.min(score.breakdown.evidenceStrength * 2.5, 100)}%` }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Files List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-700 mb-3">Arquivos Processados</h3>
        {files.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Nenhum arquivo carregado.</p>
        ) : (
          <ul className="space-y-2">
            {files.map(f => (
              <li key={f.id} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded border border-gray-100">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${f.type === 'csv' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {f.type.toUpperCase()}
                  </span>
                  <span className="truncate max-w-[150px]" title={f.name}>{f.name}</span>
                </div>
                {f.type === 'csv' && f.stats && (
                  <span className="text-xs text-gray-500">{f.stats.rowCount} linhas, {f.stats.outliers} outliers</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Extracted Findings */}
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-700">Achados Extraídos (OCR/Texto)</h3>
        
        {['ACHADO', 'RECOMENDACAO', 'FRAGILIDADE'].map(type => {
          const items = findings.filter(f => f.type === type);
          if (items.length === 0) return null;
          
          let colorClass = 'bg-gray-100 border-gray-200 text-gray-700';
          if (type === 'ACHADO') colorClass = 'bg-red-50 border-red-200 text-red-800';
          if (type === 'RECOMENDACAO') colorClass = 'bg-blue-50 border-blue-200 text-blue-800';
          if (type === 'FRAGILIDADE') colorClass = 'bg-amber-50 border-amber-200 text-amber-800';

          return (
            <div key={type} className="space-y-2">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">{type}</h4>
              {items.map(item => (
                <div key={item.id} className={`p-3 rounded border text-sm ${colorClass}`}>
                  <p className="mb-1">{item.text}</p>
                  <div className="flex justify-between items-center mt-2 opacity-70 text-xs">
                    <span>Fonte: {item.sourceFileName}</span>
                    <span>Confiança: {Math.round(item.confidence * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
        {findings.length === 0 && (
            <div className="text-sm text-gray-400 italic bg-gray-50 p-4 rounded text-center">
                Nenhum achado estruturado identificado ainda. Carregue PDFs de relatórios (CGU/TCU) para extração automática.
            </div>
        )}
      </div>
    </div>
  );
};