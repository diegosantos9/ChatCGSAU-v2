import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { loadData, getSearchFacets } from './services/dataLoader';
import { sendMessage } from './services/aiService';
import { SmartResponse } from './components/SmartResponse';
import { DashboardFilters } from './components/DashboardFilters';
import './index.css';

interface Message {
  role: 'user' | 'model';
  text: string;
}

const UF_LIST = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

const YEAR_LIST = Array.from({ length: 12 }, (_, i) => (new Date().getFullYear() + 1 - i).toString());

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  // Filter States
  // Filter States
  const [availableUFs, setAvailableUFs] = useState<string[]>(UF_LIST);
  const [availableYears, setAvailableYears] = useState<string[]>(YEAR_LIST);
  const [lastFacets, setLastFacets] = useState<{ ufs: string[], anos: string[] } | null>(null);
  const [selectedUF, setSelectedUF] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [searchSource, setSearchSource] = useState<'ALL' | 'CGU' | 'TCU' | 'FINDINGS'>('ALL');

  const searchTimeoutRef = useRef<any>(null);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!input || input.length < 3) {
      if (lastFacets) {
        // Restore facets from the last successful search
        setAvailableUFs(lastFacets.ufs.length > 0 ? lastFacets.ufs : []);
        setAvailableYears(lastFacets.anos.length > 0 ? lastFacets.anos : []);
      } else {
        // Default to all if no search happened yet
        setAvailableUFs(UF_LIST);
        setAvailableYears(YEAR_LIST);
      }
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      // Pass current filters for cross-filtering
      const facets = getSearchFacets(input, { uf: selectedUF || undefined, ano: selectedYear || undefined });

      // Update Facet Lists based on Search Results
      if (facets.ufs.length > 0) setAvailableUFs(facets.ufs);
      else setAvailableUFs([]);

      if (facets.anos.length > 0) setAvailableYears(facets.anos);
      else setAvailableYears([]);
    }, 400);

    return () => clearTimeout(searchTimeoutRef.current);
  }, [input, selectedUF, selectedYear]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const initData = async () => {
      await loadData();
      setIsLoading(false);
    };
    initData();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isSending) return;

    const userMsg: Message = { role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsSending(true);

    try {
      // Converte o histórico para o formato esperado pelo Gemini SDK
      const historyForApi = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const filters = {
        uf: selectedUF || undefined,
        ano: selectedYear || undefined,
        source: searchSource
      };

      // Calculate facets for this search to persist them (using current filters)
      const searchFacets = getSearchFacets(input, filters);
      setLastFacets(searchFacets);
      // Also update current view immediately to match what was sent
      if (searchFacets.ufs.length > 0) setAvailableUFs(searchFacets.ufs);
      else setAvailableUFs([]);

      if (searchFacets.anos.length > 0) setAvailableYears(searchFacets.anos);
      else setAvailableYears([]);

      const responseText = await sendMessage(historyForApi, input, filters);

      const aiMsg: Message = { role: 'model', text: responseText };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      setMessages(prev => [...prev, { role: 'model', text: "Erro ao comunicar com a IA." }]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-xl font-semibold text-gray-700 animate-pulse">
          Carregando bases de dados...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-slate-800 text-white p-4 shadow-md">
        <h1 className="text-xl font-bold">ChatCGSAU Beta</h1>
        <p className="text-sm opacity-80">Auditor IA conectado às bases CGU e TCU</p>
      </header>

      <div className="bg-gray-50 pt-4 px-4 pb-2 shrink-0 z-10 border-b border-gray-100">
        <DashboardFilters selectedSource={searchSource} onSelect={setSearchSource} />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-10">
            <p className="text-lg">Olá! Sou o ChatCGSAU.</p>
            <p>Pergunte sobre auditorias na saúde ou acórdãos do TCU.</p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] p-3 rounded-lg shadow ${msg.role === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-800 border border-gray-200'
                }`}
            >
              {msg.role === 'model' ? (
                <SmartResponse text={msg.text} displayFilter={searchSource} />
              ) : (
                <div className={`markdown-body ${msg.role === 'user' ? 'text-white' : ''}`}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      table: ({ node, ...props }) => <div className="overflow-x-auto my-2"><table className="min-w-full divide-y divide-gray-300 border" {...props} /></div>,
                      thead: ({ node, ...props }) => <thead className="bg-gray-50" {...props} />,
                      th: ({ node, ...props }) => <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b" {...props} />,
                      td: ({ node, ...props }) => <td className="px-3 py-2 whitespace-normal text-sm border-b" {...props} />,
                      a: ({ node, ...props }) => <a className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
                      ul: ({ node, ...props }) => <ul className="list-disc list-inside ml-4" {...props} />,
                      ol: ({ node, ...props }) => <ol className="list-decimal list-inside ml-4" {...props} />,
                      h1: ({ node, ...props }) => <h1 className="text-xl font-bold my-2" {...props} />,
                      h2: ({ node, ...props }) => <h2 className="text-lg font-bold my-2" {...props} />,
                      h3: ({ node, ...props }) => <h3 className="text-md font-bold my-1" {...props} />,
                    }}
                  >
                    {msg.text}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}
        {isSending && (
          <div className="flex justify-start">
            <div className="bg-gray-200 p-3 rounded-lg text-gray-500 italic">
              Digitando...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        <div className="max-w-4xl mx-auto space-y-3">

          {/* Barra de Filtros */}
          <div className="flex gap-4 items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
            <span className="text-xs font-semibold text-gray-500 uppercase ml-2">Filtros de Contexto:</span>

            <div className="flex items-center gap-2">
              <label htmlFor="uf-select" className="text-sm text-gray-600">UF:</label>
              <select
                id="uf-select"
                value={selectedUF}
                onChange={(e) => setSelectedUF(e.target.value)}
                className="text-sm p-1.5 border border-gray-300 rounded focus:outline-none focus:border-blue-500 bg-white"
              >
                <option value="">Todas</option>
                {availableUFs.map(uf => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="year-select" className="text-sm text-gray-600">Ano:</label>
              <select
                id="year-select"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="text-sm p-1.5 border border-gray-300 rounded focus:outline-none focus:border-blue-500 bg-white"
              >
                <option value="">Todos</option>
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              placeholder="Digite sua pergunta..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSending}
            />
            <button
              onClick={handleSend}
              disabled={isSending || !input.trim()}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium shadow-sm"
            >
              Enviar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;