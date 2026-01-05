import { GoogleGenAI } from "@google/genai";
import { UploadedFile, Finding, StructuredFinding } from "../types";

const MODEL_NAME = "gemini-3-flash-preview";

interface GeminiResponse {
  sintese: string;
  achados: StructuredFinding[];
}

export const generateAuditResponse = async (
  query: string,
  files: UploadedFile[],
  context: string,
  findings: Finding[]
): Promise<{ text: string, structuredFindings: StructuredFinding[], groundingMetadata: any }> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key não configurada. Por favor, configure a variável de ambiente.");
  }

  const ai = new GoogleGenAI({ apiKey });

  // 1. Prioritize Files Logic (Matches n8n "Filter Lines" priority)
  const cguFiles = files.filter(f => f.metadata?.orgao === 'CGU');
  const tcuFiles = files.filter(f => f.metadata?.orgao === 'TCU');
  const otherFiles = files.filter(f => f.metadata?.orgao === 'OUTROS');

  const buildFileContext = (fileList: UploadedFile[]) => {
    return fileList.map(f => {
      let content = `\n--- Arquivo: ${f.name} (Ano: ${f.metadata?.ano}, UF: ${f.metadata?.uf}) ---\n`;
      if (f.content) content += `${f.content.substring(0, 15000)}...\n`;
      if (f.type === 'csv' && f.stats) {
        content += `\n[DADOS TABULARES]: Linhas: ${f.stats.rowCount}, Outliers: ${f.stats.outliers}. Amostra: ${JSON.stringify(f.processedData?.slice(0, 5))}\n`;
      }
      return content;
    }).join('\n');
  };

  const prioritizedContext = `
    === PRIORIDADE 1: RELATÓRIOS CGU (Máxima Relevância) ===
    ${buildFileContext(cguFiles)}

    === PRIORIDADE 2: RELATÓRIOS TCU (Alta Relevância) ===
    ${buildFileContext(tcuFiles)}

    === OUTROS DOCUMENTOS E DADOS (Apoio) ===
    ${buildFileContext(otherFiles)}
  `;

  // Nova System Instruction baseada na Persona Auditor Sênior
  const systemInstruction = `
    **ROLE (PERSONA):**
    Você é o **ChatCGSAU**, um Auditor Sênior da CGU e do TCU.
    Sua função é realizar uma auditoria forense nos arquivos anexados (CSV, Excel, PDF) baseada no **TEMA** informado pelo usuário.

    **GATILHO:**
    O usuário informará apenas o TEMA. Ignore conversas fiadas e inicie a análise imediatamente.

    **REGRAS DE EXTRAÇÃO E LINKS (CRÍTICO):**
    Ao identificar um achado em uma linha da planilha, você DEVE rastrear o link correspondente no mesmo registro:
    1. **Mapeamento CGU:** Procure irregularidades em texto/resumo. O Link oficial está na coluna **"link"** (ou Q).
    2. **Mapeamento TCU:** Procure irregularidades em ASSUNTO/RESUMO. O Link oficial está na coluna **"ENDERECO"** (ou F).
    3. Se encontrar o link, coloque-o no campo 'link' do JSON.

    **DEFINIÇÕES DE CLASSIFICAÇÃO:**
    - 🔴 **Achado:** Irregularidade, dano ao erário, fraude, pagamento sem contrato.
    - 🟠 **Fragilidade:** Falha de controle, risco, ineficiência.
    - 🟢 **Recomendação:** Determinação ou sugestão corretiva.

    **SAÍDA ESPERADA (JSON):**
    Para alimentar o Painel Gráfico, responda ESTRITAMENTE um JSON com esta estrutura:
    {
      "sintese": "String Markdown contendo: 1. Resumo Executivo (parágrafo denso sintetizando a situação); 2. Estatísticas da Análise.",
      "achados": [
         {
           "tipo": "Achado" | "Fragilidade" | "Recomendação",
           "descricao": "Descrição concisa do fato.",
           "palavras_chave": ["Tag1", "Tag2"],
           "fonte": "CGU" | "TCU" | "DADOS",
           "link": "https://..." 
         }
      ]
    }
    *(Nota: Se não houver link no CSV, deixe o campo 'link' vazio ou null).*
    
    **Instrução de Falha:** Se não encontrar nada, a "sintese" deve ser: "Não foram encontradas evidências sobre [TEMA] nos arquivos anexados." e o array "achados" deve ser vazio.
  `;

  const prompt = `
    CONTEXTO DOCUMENTAL (Arquivos e Dados Extraídos):
    ${prioritizedContext}

    CONTEXTO DO USUÁRIO (Dados Auxiliares):
    ${context}

    TEMA/PERGUNTA SOLICITADA PELO USUÁRIO:
    ${query}
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [
        { role: 'user', parts: [{ text: prompt }] }
      ],
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.1, // Temperatura baixa para ser factual e rigoroso
        responseMimeType: "application/json",
        tools: [{ googleSearch: {} }]
      }
    });

    // Parse the JSON response
    const jsonResponse = JSON.parse(response.text || '{}') as GeminiResponse;
    
    return {
        text: jsonResponse.sintese || "Sem síntese gerada.",
        structuredFindings: jsonResponse.achados || [],
        groundingMetadata: response.candidates?.[0]?.groundingMetadata
    };
  } catch (error) {
    console.error("Gemini API Error:", error);
    // Fallback if JSON parsing fails
    return {
        text: "Erro ao processar auditoria. Verifique os arquivos carregados.",
        structuredFindings: [],
        groundingMetadata: null
    };
  }
};