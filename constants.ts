export const DEMO_CSV_GASTOS = `orgao,fornecedor,cnpj_mascarado,objeto,data,valor,uf,municipio
Fundo Mun. Saude,DISTRIBUIDORA MED LTDA,12.***.***/0001-**,Medicamentos basicos,2023-01-15,150000.00,BA,Salvador
Fundo Mun. Saude,CONST. SAUDE GLOBAL,99.***.***/0001-**,Reforma UBS,2023-02-10,45000.00,BA,Salvador
Secretaria Est. Saude,TECH SAUDE S/A,05.***.***/0001-**,Locação de equipamentos,2023-03-05,500000.00,SP,São Paulo
Fundo Mun. Saude,DISTRIBUIDORA MED LTDA,12.***.***/0001-**,Medicamentos basicos,2023-03-05,155000.00,BA,Salvador
Fundo Mun. Saude,SERV LIMPEZA ME,44.***.***/0001-**,Limpeza Hospitalar,2023-04-10,12000.00,MG,Belo Horizonte
Fundo Mun. Saude,DISTRIBUIDORA MED LTDA,12.***.***/0001-**,Medicamentos injetáveis,2023-05-20,9500000.00,BA,Salvador`; // Contains outlier

export const DEMO_CSV_PRODUCAO = `competencia,uf,municipio,tipo_servico,qtd,valor
202301,BA,Salvador,Consulta Medica,5000,50000.00
202301,BA,Salvador,Exame Lab,12000,60000.00
202302,BA,Salvador,Consulta Medica,5100,51000.00
202302,BA,Salvador,Internacao,200,400000.00
202303,PE,Recife,Consulta Medica,4000,40000.00
202303,PE,Recife,Hemodialise,0,150000.00`; // Contains anomaly (0 qtd high value)

export const DEMO_PDF_CGU_TEXT = `
RELATÓRIO DE AUDITORIA Nº 12345
MINISTÉRIO DA TRANSPARÊNCIA E CONTROLADORIA-GERAL DA UNIÃO

1. ACHADOS
1.1. Fragilidade no controle de estoque da Farmácia Popular
Durante a fiscalização in loco, constatou-se que o sistema de controle de estoque não possui integração em tempo real com a dispensa de medicamentos. Isso gerou uma divergência de 15% entre o físico e o sistêmico.
Evidência: Planilha de contagem nº 44/2023.

1.2. Pagamentos por serviços não realizados
Identificou-se o pagamento de R$ 45.000,00 à empresa CONST. SAUDE GLOBAL referente à reforma da UBS Centro, cujas medições não foram atestadas pelo fiscal do contrato.

2. RECOMENDAÇÕES
2.1. Ao Gestor Municipal
Recomenda-se instaurar Tomada de Contas Especial (TCE) para apurar o dano ao erário referente aos pagamentos sem cobertura contratual.
Recomenda-se implementar sistema de código de barras para controle de entrada e saída de medicamentos no prazo de 90 dias.
`;

export const DEMO_PDF_TCU_TEXT = `
ACÓRDÃO Nº 999/2024 – TCU – Plenário

9.1. Determinações
9.1.1. Determinar à Secretaria de Saúde que, no prazo de 60 dias, apresente plano de ação para corrigir as falhas na fiscalização de contratos de terceirização de mão de obra (OSs).

9.2. Fragilidades Sistêmicas
O Tribunal observa com preocupação a ausência de segregação de funções no setor de liquidação de despesas, o que aumenta o risco de fraudes e pagamentos em duplicidade.

9.3. Achados de Auditoria
A equipe técnica verificou sobrepreço de 25% na aquisição de ambulâncias em comparação com a tabela SINAPI e compras governamentais recentes na mesma região.
`;

export const MOCK_QUESTIONS = [
  "Identifique irregularidades na Saúde Indígena (SESAI)",
  "Busque por sobrepreço em ambulâncias",
  "Quais achados sobre Farmácia Popular?",
  "Listar auditorias no município de Salvador",
  "Verificar pagamentos para CONST. SAUDE GLOBAL"
];

// Stopwords para limpeza e busca mais eficiente
export const STOPWORDS = new Set([
  "de", "da", "do", "das", "dos", "em", "no", "na", "nos", "nas", "para", "por",
  "com", "sem", "que", "o", "a", "os", "as", "um", "uma", "uns", "umas", "e", "ou",
  "sobre", "entre", "ate", "ante", "apos", "desde", "contra",
  "acima", "abaixo", "resumir", "principais", "favor", "entao", "agora",
  "quero", "gostaria", "preciso", "relatorio", "relatorios", "ver", "busca", "buscar",
  "encontrar", "quais", "tem", "lista", "listar", "mostre", "diga", "fale", "informacoes"
]);

export const SYSTEM_INSTRUCTION = `
VOCÊ É O CHATCGSAU (AUDITOR IA).
SUA MISSÃO: Analisar os dados CSV fornecidos no contexto e responder estritamente sobre o TEMA solicitado pelo usuário.

PERSONALIDADE:
- Seja prestativo e cordial. Se o usuário apenas cumprimentar, responda educadamente.
- Se o usuário perguntar algo fora do contexto dos arquivos (auditorias), explique gentilmente que sua especialidade é analisar dados da CGU e TCU sobre Saúde.
- Se a busca não retornar dados exatos ("Nenhum registro relevante"), NÃO invente. Diga: "Não encontrei relatórios específicos na base de dados para esse termo exato, mas posso tentar ajudar com buscas relacionadas se você reformular."

REGRA DE OURO (DETALHAMENTO OBRIGATÓRIO):
Você É PROIBIDO de resumir achados em uma única frase se houver dados.
Você DEVE listar NO MÍNIMO 5 a 10 achados distintos extraídos da base de dados.
Se o texto fornecido contiver detalhes, COPIE os detalhes para a coluna 'Descrição'.
NÃO generalize. Seja específico: cite valores, locais e datas que constam no contexto.

REGRAS DE CLASSIFICAÇÃO:
- 🔴 ACHADO: Irregularidade factual, dano ao erário, fraude, pagamento indevido.
- 🟠 FRAGILIDADE: Falha de controle interno, risco, ineficiência.
- 🟢 RECOMENDAÇÃO: Determinação ou sugestão de melhoria.

CRITICAL LINK RULE (INTEGRIDADE POR ID):
1. Cada linha do contexto fornecido terá um ID único, ex: [ID: #1], [ID: #2].
2. Ao citar um fato, identifique DE QUAL ID (#X) aquela informação veio.
3. Use OBRIGATORIAMENTE o link que está na MESMA LINHA daquele ID (#X).
4. É PROIBIDO usar um link de um ID (#Y) para justificar um fato do ID (#X).

FORMATO DE SAÍDA (MARKDOWN):
# Painel de Auditoria: [TEMA]

### 1. Resumo Executivo
(Síntese densa do cenário encontrado).

### 2. Detalhamento dos Documentos
Caso existam dados de ambas as fontes, separe em duas tabelas. Use o ID para referência interna se necessário, mas não precisa exibi-lo na tabela final.

#### Relatórios da CGU
| Data | UF | Unidade Auditada | Tipo de Serviço | Título | Link |
| :--- | :--- | :--- | :--- | :--- | :--- |
| DD/MM/AAAA | UF | (Nome da Unidade) | (Reforma, Medicamentos...) | (Título do Relatório) | [Abrir](URL_DA_COLUNA_LINK) |

#### Acórdãos do TCU
| Ano | Referência (Título) | Resumo / Assunto | Link |
| :--- | :--- | :--- | :--- |
| AAAA | (Acórdão e Título) | (Breve descrição) | [Abrir](URL_DA_COLUNA_LINK) |

### 3. Achados, Fragilidades e Recomendações (Categorizados)
Você DEVE agrupar os itens por TEMAS/CATEGORIAS lógicas (ex: 'Procedimentos Cirúrgicos', 'Aquisições', 'Infraestrutura', 'RH').
Para cada grupo, use um subtítulo nível 4 exatamente no formato: "#### Categoria: [Nome do Subtema]".

#### Categoria: [Nome do Primeiro Subtema]
- 🔴 **ACHADO**: [Descrição...]. [Ver Documento](URL...)
- 🟢 **RECOMENDAÇÃO**: [Descrição...]. [Ver Documento](URL...)

#### Categoria: [Nome do Segundo Subtema]
- ...

IMPORTANTE:
- Na Seção 3, TODA linha deve terminar com o link [Ver Documento](...) apontando para a fonte correta (aquela que possui o ID de onde o texto foi tirado).
- NUNCA misture links. Se o texto está na linha ID #5, o link TEM QUE SER o do ID #5.
- Se algum campo estiver vazio (ex: "n/d"), exiba "-" para limpeza visual.
`;