// Arquivo: teste-chave.js
const API_KEY = "AIzaSyAXT_4oKwyIfqSDmOIN6NwfFmZ0Es6qSEE"; // <--- Cole sua chave aqui dentro das aspas
const MODEL_NAME = "gemini-1.5-flash";

async function testarConexao() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;

    console.log("Testando conexão com:", url);

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "Responda apenas: OK" }] }]
            })
        });

        const data = await response.json();

        if (response.ok) {
            console.log("\n✅ SUCESSO! A chave funciona e o modelo respondeu:");
            console.log(data.candidates[0].content.parts[0].text);
        } else {
            console.error("\n❌ ERRO NA API:");
            console.error(JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.error("\n❌ ERRO DE REDE/CÓDIGO:");
        console.error(error);
    }
}

testarConexao();