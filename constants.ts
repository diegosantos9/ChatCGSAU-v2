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

// === D2: Dicionário de Sinônimos Editável (Expansão de Consulta) ===
export const SYNONYMS_DICTIONARY: Record<string, string[]> = {
  // Saúde Indígena
  "saude indigena": ["sesai", "dsei", "povos indigenas", "sasisus", "atencao a saude dos povos indigenas", "aldeia", "distrito sanitario especial", "casai"],
  "sesai": ["saude indigena", "secretaria especial de saude indigena"],
  
  // Farmácia
  "farmacia popular": ["pnafp", "pafp", "aqui tem farmacia popular", "copagamento", "medicamento gratuito", "farmacia basica"],
  "medicamentos": ["farmacos", "remedios", "insumos farmaceuticos", "assistencia farmaceutica", "daf"],
  
  // Infraestrutura/Serviços
  "obras": ["reforma", "construcao", "ampliacao", "engenharia", "edificacao", "infraestrutura"],
  "transporte": ["ambulancia", "samu", "unidade movel", "transporte sanitario", "veiculo", "locacao de veiculos", "aereo"],
  "limpeza": ["higiene", "asseio", "conservacao", "zeladoria"],
  
  // Gestão/Controle
  "atencao basica": ["pab", "esf", "saude da familia", "ubs", "unidade basica", "posto de saude"],
  "covid": ["coronavirus", "pandemia", "sars-cov-2", "emergencia de saude", "respiradores"],
  "dengue": ["arbovirose", "aedes", "fumace", "vetores", "chikungunya", "zika"],
  "opme": ["orteses", "proteses", "materiais especiais", "implantes", "alto custo"]
};

// Stopwords para limpeza
export const STOPWORDS = new Set([
  "de", "da", "do", "das", "dos", "em", "no", "na", "nos", "nas", "para", "por", 
  "com", "sem", "que", "o", "a", "os", "as", "um", "uma", "uns", "umas", "e", "ou",
  "sobre", "entre", "ate", "ante", "apos", "desde", "contra"
]);