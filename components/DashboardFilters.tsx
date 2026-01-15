import React from 'react';

type SourceType = 'ALL' | 'CGU' | 'TCU' | 'FINDINGS';

interface DashboardFiltersProps {
    selectedSource: SourceType;
    onSelect: (source: SourceType) => void;
}

export const DashboardFilters: React.FC<DashboardFiltersProps> = ({ selectedSource, onSelect }) => {

    const getCardClass = (type: SourceType) => {
        const baseClass = "flex flex-col items-center justify-center p-4 rounded-xl border cursor-pointer transition-all duration-300 w-full sm:w-1/3 shadow-sm hover:shadow-md";
        if (selectedSource === type) {
            return `${baseClass} bg-blue-600 border-blue-600 text-white transform scale-[1.02] ring-2 ring-blue-300`;
        }
        return `${baseClass} bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-blue-300`;
    };

    return (
        <div className="flex flex-col sm:flex-row gap-4 mb-6 w-full max-w-4xl mx-auto px-2">

            {/* Relatórios da CGU */}
            <div onClick={() => onSelect('CGU')} className={getCardClass('CGU')}>
                <div className="mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                </div>
                <span className="font-semibold text-sm text-center">Relatórios da CGU</span>
                <span className={`text-xs mt-1 ${selectedSource === 'CGU' ? 'text-blue-100' : 'text-gray-400'}`}>Auditorias em Saúde</span>
            </div>

            {/* Acórdãos do TCU */}
            <div onClick={() => onSelect('TCU')} className={getCardClass('TCU')}>
                <div className="mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                    </svg>
                </div>
                <span className="font-semibold text-sm text-center">Acórdãos do TCU</span>
                <span className={`text-xs mt-1 ${selectedSource === 'TCU' ? 'text-blue-100' : 'text-gray-400'}`}>Decisões e Julgados</span>
            </div>

            {/* Achados e Recomendações */}
            <div onClick={() => onSelect('FINDINGS')} className={getCardClass('FINDINGS')}>
                <div className="mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                </div>
                <span className="font-semibold text-sm text-center">Achados e Fragilidades</span>
                <span className={`text-xs mt-1 ${selectedSource === 'FINDINGS' ? 'text-blue-100' : 'text-gray-400'}`}>Foco em Irregularidades</span>
            </div>

        </div>
    );
};
