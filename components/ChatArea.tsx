import React, { useRef, useEffect } from 'react';
import { ChatMessage } from '../types';

interface ChatAreaProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (text: string) => void;
  onClear: () => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void; // New prop
}

export const ChatArea: React.FC<ChatAreaProps> = ({ messages, isLoading, onSendMessage, onClear, onFileUpload }) => {
  const [input, setInput] = React.useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSendMessage(input);
    setInput('');
  };

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 p-4 border-b border-gray-200 flex justify-between items-center">
        <h2 className="font-semibold text-gray-700 flex items-center gap-2">
          <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
          Chat Auditoria
        </h2>
        <button onClick={onClear} className="text-xs text-red-500 hover:text-red-700 font-medium">
          Limpar Sessão
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-10">
            <p>Olá! Sou o ChatCGSAU.</p>
            <p className="text-sm">Carregue seus arquivos ou faça uma pergunta sobre auditoria em saúde.</p>
          </div>
        )}
        
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-lg p-4 shadow-sm ${
              msg.role === 'user' 
                ? 'bg-teal-600 text-white' 
                : 'bg-white text-gray-800 border border-gray-100'
            }`}>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                 {/* Simple markdown rendering for MVP */}
                 <div dangerouslySetInnerHTML={{ __html: msg.content.replace(/\n/g, '<br/>').replace(/## (.*)/g, '<strong>$1</strong>') }} />
              </div>
              
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 pt-2 border-t border-gray-100/20 text-xs opacity-90">
                  <p className="font-semibold mb-1">Fontes:</p>
                  <ul className="list-disc pl-4">
                    {msg.sources.map((s, idx) => (
                      <li key={idx}><a href={s.uri} target="_blank" rel="noreferrer" className="underline hover:text-teal-200">{s.title}</a></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-teal-600"></div>
              <span className="text-sm text-gray-500">Analisando evidências e pesquisando...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 bg-white border-t border-gray-200">
        <div className="flex gap-2 items-center">
          {/* Hidden File Input */}
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={onFileUpload}
            multiple
            accept=".csv,.xlsx,.pdf,.txt"
            className="hidden"
          />
          
          {/* Attachment Button */}
          <button 
            type="button"
            onClick={handleAttachmentClick}
            className="text-gray-400 hover:text-teal-600 transition-colors p-2 rounded-full hover:bg-gray-100"
            title="Anexar arquivos"
            disabled={isLoading}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ex: Identifique irregularidades nos contratos de OS..."
            className="flex-1 border border-gray-300 rounded-md px-4 py-2 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
            disabled={isLoading}
          />
          <button 
            type="submit" 
            disabled={isLoading || !input.trim()}
            className="bg-teal-600 text-white px-6 py-2 rounded-md hover:bg-teal-700 disabled:opacity-50 font-medium transition-colors"
          >
            Enviar
          </button>
        </div>
      </form>
    </div>
  );
};