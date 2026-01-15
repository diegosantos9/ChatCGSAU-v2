export const SYNONYMS: Record<string, string[]> = {
    // === [MERGED] Saúde Indígena (Was missing) ===
    "saude indigena": ["sesai", "dsei", "povos indigenas", "sasisus", "atencao a saude dos povos indigenas", "aldeia", "distrito sanitario especial", "casai"],
    "sesai": ["saude indigena", "secretaria especial de saude indigena", "dsei", "aldeia"],
    "dsei": ["saude indigena", "sesai", "distrito sanitario"],

    // === Saúde Básica ===
    'aps': ['atenção primária', 'esf', 'estratégia saúde da família', 'ubs', 'unidade básica', 'equipe de saúde'],
    'esf': ['estratégia saúde da família', 'aps', 'atenção primária', 'saúde da família'],
    'ubs': ['unidade básica de saúde', 'posto de saúde', 'centro de saúde', 'aps', 'atencao basica'],
    'atencao basica': ['pab', 'esf', 'saude da familia', 'ubs', 'unidade basica'],

    // === Programas / Farmácia ===
    'farmacia popular': ['pfpb', 'programa farmácia popular', 'medicamentos', 'copagamento', 'gratuidade', 'aqui tem farmacia popular'],
    'pfpb': ['farmácia popular', 'programa farmácia popular', 'medicamentos'],
    'medicamentos': ["farmacos", "remedios", "insumos farmaceuticos", "assistencia farmaceutica", "daf"],
    'opme': ["orteses", "proteses", "materiais especiais", "implantes", "alto custo"],

    // === Urgência / Emergência ===
    'samu': ['serviço de atendimento móvel', 'urgência', 'emergência', 'ambulância', '192', 'transporte sanitario'],
    'upa': ['unidade de pronto atendimento', 'urgência', 'emergência', 'pronto socorro'],
    'transporte': ["ambulancia", "samu", "unidade movel", "transporte sanitario", "veiculo", "locacao de veiculos", "aereo"],

    // === Doenças e Condições ===
    'diabetes': ['insulinodependente', 'diabético', 'glicemia', 'insulina', 'hiperglicemia'],
    'hipertensao': ['pressão alta', 'hipertenso', 'cardiovascular', 'pressão arterial'],
    'dengue': ['aedes', 'zika', 'chikungunya', 'arbovirose', 'vetor', 'fumace', 'vetores'],
    'covid': ["coronavirus", "pandemia", "sars-cov-2", "emergencia de saude", "respiradores"],

    // === Infraestrutura / Obras ===
    "obras": ["reforma", "construcao", "ampliacao", "engenharia", "edificacao", "infraestrutura"],
    "limpeza": ["higiene", "asseio", "conservacao", "zeladoria"],

    // === Gestão e Finanças ===
    'fundo a fundo': ['bloco de financiamento', 'recurso federal', 'transferência'],
    'emenda': ['parlamentar', 'recurso extra', 'investimento', 'custeio'],
    'licitacao': ['pregão', 'concorrência', 'contrato', 'aquisição', 'dispensa', 'inexigibilidade'],
    'fraude': ['irregularidade', 'desvio', 'superfaturamento', 'corrupção', 'ilegalidade'],

    // === Termos Técnicos ===
    'cnes': ['cadastro nacional', 'estabelecimento de saúde'],
    'sus': ['sistema único de saúde', 'rede pública'],
    'tcu': ['tribunal de contas', 'acórdão', 'auditoria', 'fiscalização'],
    'cgu': ['controladoria geral', 'auditoria', 'fiscalização'],

    // === Estados (UF) - Normalização ===
    'acre': ['ac'], 'alagoas': ['al'], 'amapa': ['ap'], 'amazonas': ['am'],
    'bahia': ['ba'], 'ceara': ['ce'], 'distrito federal': ['df', 'brasilia'],
    'espirito santo': ['es'], 'goias': ['go'], 'maranhao': ['ma'],
    'mato grosso': ['mt'], 'mato grosso do sul': ['ms'], 'minas gerais': ['mg'],
    'para': ['pa'], 'paraiba': ['pb'], 'parana': ['pr'], 'pernambuco': ['pe'],
    'piaui': ['pi'], 'rio de janeiro': ['rj'], 'rio grande do norte': ['rn'],
    'rio grande do sul': ['rs'], 'rondonia': ['ro'], 'roraima': ['rr'],
    'santa catarina': ['sc'], 'sao paulo': ['sp'], 'sergipe': ['se'], 'tocantins': ['to']
};

export const expandQuery = (query: string): string[] => {
    if (!query) return [];

    const lowerQuery = query.toLowerCase().trim();
    const words = lowerQuery.split(/\s+/);

    const expansions = new Set<string>();

    // Adiciona a query original
    expansions.add(lowerQuery);

    // Verifica palavras individuais
    words.forEach(word => {
        if (SYNONYMS[word]) {
            SYNONYMS[word].forEach(syn => expansions.add(syn));
        }
    });

    // Verificação Robusta: Checa se qualquer chave do dicionário (mesmo composta) existe na query
    // Isso permite encontrar 'sao paulo' ou 'rio de janeiro' dentro de uma frase maior
    const allKeys = Object.keys(SYNONYMS);
    for (const key of allKeys) {
        // Verifica se a chave está contida na query (busca exata da frase chave)
        // Adicionamos espaços para evitar falso positivo (ex: 'acre' em 'massacre'), 
        // mas relaxamos para início/fim de string.
        // Regex boundaries \b são ideais.
        const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedKey}\\b`, 'i');

        if (regex.test(lowerQuery)) {
            SYNONYMS[key].forEach(syn => expansions.add(syn));
        }
    }

    return Array.from(expansions);
};
