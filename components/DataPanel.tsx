import React from 'react';
import { UploadedFile } from '../types';

interface DataPanelProps {
  files: UploadedFile[];
}

export const DataPanel: React.FC<DataPanelProps> = ({ files }) => {
  const csvFiles = files.filter(f => f.type === 'csv');

  if (csvFiles.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 p-8 text-center">
        <p>Carregue arquivos CSV para visualizar a análise de dados, perfilamento e detecção de outliers.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-8">
      {csvFiles.map(file => (
        <div key={file.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              {file.name}
            </h3>
          </div>
          
          {/* Stats Summary */}
          <div className="grid grid-cols-4 gap-4 p-4 border-b border-gray-100">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-700">{file.stats?.rowCount}</div>
              <div className="text-xs text-gray-500 uppercase">Linhas</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-700">{file.stats?.columnCount}</div>
              <div className="text-xs text-gray-500 uppercase">Colunas</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${file.stats?.outliers ? 'text-red-500' : 'text-gray-700'}`}>
                {file.stats?.outliers || 0}
              </div>
              <div className="text-xs text-gray-500 uppercase">Outliers Potenciais</div>
            </div>
             <div className="text-center">
              <div className="text-2xl font-bold text-gray-700">{file.stats?.nullValues || 0}</div>
              <div className="text-xs text-gray-500 uppercase">Valores Nulos</div>
            </div>
          </div>

          {/* Table Preview (First 5 rows) */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {file.stats?.columns?.map(col => (
                    <th key={col} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {file.processedData?.slice(0, 5).map((row: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50">
                    {file.stats?.columns?.map(col => (
                      <td key={col} className="px-3 py-2 whitespace-nowrap text-xs text-gray-600">
                        {row[col]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 bg-gray-50 text-xs text-center text-gray-500 italic">
            Visualizando as primeiras 5 linhas. Use o chat para análise profunda.
          </div>
        </div>
      ))}
    </div>
  );
};