const API_KEY = "AIzaSyAXT_4oKwyIfqSDmOIN6NwfFmZ0Es6qSEE"; // <--- Sua chave ...qSEE

async function listarModelos() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

    console.log("🔍 Perguntando ao Google quais modelos estão disponíveis...");

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.models) {
            console.log("\n✅ MODELOS DISPONÍVEIS PARA SUA CHAVE:");
            data.models.forEach(m => {
                // Mostra apenas modelos que servem para gerar texto (chat)
                if (m.supportedGenerationMethods.includes("generateContent")) {
                    console.log(`- ${m.name.replace('models/', '')}`);
                }
            });
        } else {
            console.log("❌ Nenhum modelo encontrado. Resposta:", data);
        }
    } catch (error) {
        console.error(error);
    }
}

listarModelos();