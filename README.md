# ChatCGSAU - Auditoria IA

## Mecanismo de Busca Robusta (v2.0)

Este sistema implementa uma busca híbrida e forense sobre arquivos CSV e PDF carregados no navegador.

### 1. Ingestão e Indexação (Full-Text)
Durante o upload (`handleFileUpload` em `App.tsx` e `parseCSV` em `dataService.ts`), o sistema:
- Varre todas as colunas de cada linha do CSV.
- Concatena todos os valores textuais em um campo oculto `full_text`.
- Indexa termos frequentes para sugestões futuras.
- **Benefício**: Permite encontrar registros mesmo que o termo esteja em uma coluna obscura (ex: "Histórico" ou "Observações").

### 2. Normalização (B)
A função `normalizeText`:
- Converte para minúsculas.
- Remove acentos (NFD).
- Remove pontuação excessiva.
- Colapsa espaços em branco.
- Aplicada tanto no `full_text` quanto na consulta do usuário.

### 3. Expansão de Consulta (Query Expansion)
Para evitar "zero resultados", o sistema expande a query do usuário em 3 níveis:
1. **Heurística**: Pluralização simples ("medicamento" -> "medicamentos").
2. **Sinônimos (Dicionário)**: Utiliza `SYNONYMS_DICTIONARY` em `constants.ts` para mapear termos técnicos (ex: "farmacia popular" -> "pnafp", "copagamento").
3. **Data-Driven**: Se não houver resultados, sugere termos que realmente existem nos arquivos carregados (`frequentTerms`).

### 4. Modos de Busca
- **OR (Padrão)**: Busca qualquer um dos termos expandidos.
- **AND**: Se o usuário não usar aspas, mas quiser rigidez (configurável).
- **PHRASE**: Se usar aspas `"termo exato"`.

### 5. Modo Diagnóstico (UI)
Disponível no topo do Painel de Auditoria (`AuditCanvas.tsx`), exibe:
- Query original vs. Normalizada.
- Termos expandidos utilizados.
- Quantidade de linhas varridas.
- Tempo de execução.
- Snippets (trechos) onde os termos foram encontrados.
