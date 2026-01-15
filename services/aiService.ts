import { GoogleGenerativeAI } from "@google/generative-ai";
import { searchInContext } from "./dataLoader";
import { SYSTEM_INSTRUCTION } from "../constants";

// LAZY INITIALIZATION PATTERN
// Avoids global side-effects during import/deploy
const getModel = () => {
    const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!API_KEY) {
        throw new Error("API Key (VITE_GOOGLE_API_KEY) not found in environment variables.");
    }
    const genAI = new GoogleGenerativeAI(API_KEY);
    return genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" }, { dangerouslyAllowBrowser: true });
};

export const sendMessage = async (history: { role: "user" | "model"; parts: { text: string }[] }[], userMessage: string, filters?: { uf?: string, ano?: string, source?: string }) => {
    try {
        const model = getModel();

        // LÓGICA DE CONTINUAÇÃO DE CONVERSA (MEMÓRIA)
        // Se a pergunta for curta (ex: "Resuma") ou de continuação, usamos o contexto da pergunta anterior.
        let queryForSearch = userMessage;

        // Remove a mensagem atual do histórico para buscar a anterior
        const previousHistory = history.slice(0, -1);
        const lastUserMsg = previousHistory.slice().reverse().find(h => h.role === 'user');

        // Palavras-gatilho para continuação
        const continuationTriggers = ['resuma', 'resumir', 'continuar', 'continue', 'explique', 'detalhe', 'listar', 'quais', 'e o', 'sobre o que', 'disso', 'analise', 'analisar', 'descreva', 'comente', 'fale sobre'];
        const isShortQuery = userMessage.split(' ').length < 5;
        const hasTrigger = continuationTriggers.some(t => userMessage.toLowerCase().includes(t));

        if ((isShortQuery || hasTrigger) && lastUserMsg) {
            const lastText = lastUserMsg.parts[0].text;
            console.log(`[RAG Smart] Detectado contexto de continuação. Expandindo busca: "${userMessage}" + Contexto anterior: "${lastText.substring(0, 50)}..."`);
            // Combina a pergunta atual com a anterior para garimpar os mesmos dados (ou relacionados)
            queryForSearch = `${lastText} ${userMessage}`;
        }

        // RAG LOCAL: Filtra o contexto baseado na pergunta (expandida ou original)
        const context = searchInContext(queryForSearch, filters);

        console.log('Tamanho do Contexto Filtrado (RAG):', context.length);
        if (context.length < 500) {
            console.log('Contexto filtrado (preview):', context);
        }

        // Injeta o contexto e a instrução do sistema no início da sessão ou na mensagem
        // Estratégia: Adicionar o contexto na mensagem atual para garantir que o modelo "veja" os dados.
        let filterInstruction = "";
        if (filters && (filters.uf || filters.ano)) {
            filterInstruction = `
ATENÇÃO: O usuário ativou filtros rigorosos (${filters.uf ? 'UF=' + filters.uf : ''} ${filters.ano ? 'Ano=' + filters.ano : ''}).
1. IGNORE qualquer dado do histórico de conversa que não corresponda a estes filtros.
2. Utilize APENAS os registros listados abaixo em "CONTEXTO DE DADOS".
3. Se o contexto estiver vazio, informe que não há registros para esses filtros.
`;
        }

        const prompt = `
${SYSTEM_INSTRUCTION}
${filterInstruction}

CONTEXTO DE DADOS (CSVs):
${context}

PERGUNTA DO USUÁRIO:
${userMessage}
`;

        // Se quisermos manter o histórico, usamos startChat.
        let chatHistory = history;

        // SANITIZAÇÃO DO HISTÓRICO PARA FILTROS:
        // Se houver filtros, ocultamos as respostas anteriores do modelo para forçar o uso do Novo Contexto.
        // Isso evita que o modelo "lembre" de tabelas antigas (sem filtro) e as repita.
        if (filters && (filters.uf || filters.ano || filters.source)) {
            console.log("[RAG Smart] Filtros ativos: Sanitizando histórico para evitar alucinação com dados antigos.");
            chatHistory = history.map(h => {
                if (h.role === 'model') {
                    // Mantemos a estrutura, mas removemos o conteúdo que pode confundir
                    return {
                        role: 'model',
                        parts: [{ text: "[Conteúdo anterior oculto. Use APENAS o novo Contexto de Dados fornecido no prompt para responder.]" }]
                    };
                }
                return h;
            });
        }

        const chat = model.startChat({
            history: chatHistory,
        });

        const result = await chat.sendMessage(prompt);
        const response = await result.response;
        return response.text();

    } catch (error) {
        console.error('ERRO DETALHADO:', error);
        console.error("Erro no sendMessage:", error);
        return "Desculpe, ocorreu um erro ao processar sua solicitação. Verifique se a chave de API está configurada e se os dados foram carregados.";
    }
};
