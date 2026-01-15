import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface SmartResponseProps {
    text: string;
    displayFilter?: 'ALL' | 'CGU' | 'TCU' | 'FINDINGS';
}

const MarkdownComponents = {
    table: ({ node, ...props }: any) => <div className="overflow-x-auto my-2"><table className="min-w-full divide-y divide-gray-300 border" {...props} /></div>,
    thead: ({ node, ...props }: any) => <thead className="bg-gray-50" {...props} />,
    th: ({ node, ...props }: any) => <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b" {...props} />,
    td: ({ node, ...props }: any) => <td className="px-3 py-2 whitespace-normal text-sm border-b" {...props} />,
    a: ({ node, ...props }: any) => <a className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
    ul: ({ node, ...props }: any) => <ul className="list-disc list-inside ml-4" {...props} />,
    ol: ({ node, ...props }: any) => <ol className="list-decimal list-inside ml-4" {...props} />,
    h1: ({ node, ...props }: any) => <h1 className="text-xl font-bold my-2" {...props} />,
    h2: ({ node, ...props }: any) => <h2 className="text-lg font-bold my-2" {...props} />,
    h3: ({ node, ...props }: any) => <h3 className="text-md font-bold my-1" {...props} />,
    h4: ({ node, ...props }: any) => <h4 className="text-sm font-bold my-1 text-slate-700" {...props} />,
};

export const SmartResponse: React.FC<SmartResponseProps> = ({ text, displayFilter = 'ALL' }) => {
    const [activeTab, setActiveTab] = useState<string>('Todos');

    // Parse logic
    const parsedContent = useMemo(() => {
        // Check if we have the "Achados" section
        const splitIndex = text.search(/### 3\. Achados/);

        if (splitIndex === -1) {
            return { isStructured: false, content: text };
        }

        const introAndTables = text.substring(0, splitIndex);
        const findingsSection = text.substring(splitIndex);

        // Parsing Intro and Tables (Section 1 and 2)
        // Check for "### 2. Detalhamento"
        const splitDetalhamento = introAndTables.search(/### 2\. Detalhamento/);
        let resumo = introAndTables;
        let cguTable = '';
        let tcuTable = '';

        if (splitDetalhamento !== -1) {
            resumo = introAndTables.substring(0, splitDetalhamento);
            const tablesSection = introAndTables.substring(splitDetalhamento);

            // Extract CGU Table
            const cguMatch = tablesSection.match(/#### Relatórios da CGU([\s\S]*?)(?=#### Acórdãos do TCU|### 3|$)/);
            if (cguMatch) cguTable = "#### Relatórios da CGU" + cguMatch[1];

            // Extract TCU Table
            const tcuMatch = tablesSection.match(/#### Acórdãos do TCU([\s\S]*?)(?=#### Relatórios da CGU|### 3|$)/);
            if (tcuMatch) tcuTable = "#### Acórdãos do TCU" + tcuMatch[1];
        }

        // Parsing Findings (Section 3) - Categories
        const categorySplit = findingsSection.split(/#### Categoria:/);

        // If split didn't find specific categories, handle gracefully
        const findingsHeader = categorySplit[0]; // Title of section 3
        const categories = categorySplit.length > 1 ? categorySplit.slice(1).map(chunk => {
            const firstLineBreak = chunk.indexOf('\n');
            const nameEnd = firstLineBreak === -1 ? chunk.length : firstLineBreak;
            const name = chunk.substring(0, nameEnd).trim();
            const content = chunk.substring(nameEnd).trim();
            return { name, content };
        }) : [];

        return {
            isStructured: true,
            resumo,
            cguTable,
            tcuTable,
            findingsHeader,
            categories
        };
    }, [text]);

    if (!parsedContent.isStructured) {
        return (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
                {text}
            </ReactMarkdown>
        );
    }

    const showCGU = displayFilter === 'ALL' || displayFilter === 'CGU' || displayFilter === 'FINDINGS';
    const showTCU = displayFilter === 'ALL' || displayFilter === 'TCU' || displayFilter === 'FINDINGS';

    // Strict Source Filtering for Tables
    // If strict CGU, hide TCU table. If strict TCU, hide CGU table.
    // 'FINDINGS' usually implies we want to see the findings, but user feedback suggests
    // they use the buttons to filter content. Let's treat FINDINGS as ALL for tables visibility? 
    // Or maybe hide tables if FINDINGS? 
    // User request: "selecione o filtro... e filtre as respostas. somente acordão, somente relatórios".
    // This implies toggle. So:
    const shouldRenderCGU = parsedContent.cguTable && (displayFilter === 'ALL' || displayFilter === 'CGU');
    const shouldRenderTCU = parsedContent.tcuTable && (displayFilter === 'ALL' || displayFilter === 'TCU');
    const shouldRenderFindings = true; // Always show findings section, maybe filtered later if needed

    return (
        <div className="flex flex-col gap-4">
            {/* Resumo (Section 1) */}
            <div className="markdown-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
                    {parsedContent.resumo}
                </ReactMarkdown>
            </div>

            {/* Tables (Section 2) - Filtered */}
            {(shouldRenderCGU || shouldRenderTCU) && (
                <div className="markdown-body">
                    {/* Header for Section 2 if needed, or just the tables */}
                    {/* We need to re-add the "### 2. Detalhamento" header if we want it, but it was stripped. 
                        Actually usually it's better to just show the tables directly if they have their H4 headers. 
                        Let's check if 'resumo' ends clean. Resumo includes up to the start of "### 2.". 
                        So we might need to render the "### 2. Detalhamento..." header manually if we show any table.
                    */}
                    {(shouldRenderCGU || shouldRenderTCU) && (
                        <h3 className="text-md font-bold my-1">2. Detalhamento dos Documentos</h3>
                    )}

                    {shouldRenderCGU && (
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
                            {parsedContent.cguTable}
                        </ReactMarkdown>
                    )}
                    {shouldRenderTCU && (
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
                            {parsedContent.tcuTable}
                        </ReactMarkdown>
                    )}
                </div>
            )}

            {/* Findings Section (Section 3) */}
            {shouldRenderFindings && (
                <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                    <div className="mb-2">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
                            {parsedContent.findingsHeader}
                        </ReactMarkdown>
                    </div>

                    {parsedContent.categories && parsedContent.categories.length > 0 && (
                        <>
                            <div className="flex flex-wrap gap-2 mb-4 border-b border-gray-100 pb-2">
                                <button
                                    onClick={() => setActiveTab('Todos')}
                                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${activeTab === 'Todos'
                                        ? 'bg-blue-600 text-white border-blue-600'
                                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                        }`}
                                >
                                    Todos
                                </button>
                                {parsedContent.categories.map(cat => (
                                    <button
                                        key={cat.name}
                                        onClick={() => setActiveTab(cat.name)}
                                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${activeTab === cat.name
                                            ? 'bg-blue-600 text-white border-blue-600'
                                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                            }`}
                                    >
                                        {cat.name}
                                    </button>
                                ))}
                            </div>

                            <div className="markdown-body min-h-[100px]">
                                {activeTab === 'Todos' ? (
                                    parsedContent.categories.map((cat, idx) => (
                                        <div key={idx} className="mb-6 last:mb-0">
                                            <h4 className="text-sm font-bold text-slate-700 mb-2 border-l-4 border-blue-500 pl-2">
                                                {cat.name}
                                            </h4>
                                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
                                                {cat.content}
                                            </ReactMarkdown>
                                        </div>
                                    ))
                                ) : (
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-700 mb-2 border-l-4 border-blue-500 pl-2">
                                            {activeTab}
                                        </h4>
                                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
                                            {parsedContent.categories.find(c => c.name === activeTab)?.content || ''}
                                        </ReactMarkdown>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                    {/* Fallback if no categories found but header exists (should barely happen with current prompt) */}
                    {(!parsedContent.categories || parsedContent.categories.length === 0) && (
                        <div className="text-sm text-gray-500 italic">Sem categorização detectada.</div>
                    )}
                </div>
            )}
        </div>
    );
};
