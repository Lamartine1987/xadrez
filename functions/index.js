const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.generateCoachAnalysis = onCall({ region: "us-central1", cors: [/vercel\\.app$/, /localhost/] }, async (request) => {
  // Verifica se o usuário está logado (Segurança)
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'O usuário precisa estar logado para acessar a IA.');
  }

  const { mistakes } = request.data;
  
  if (!mistakes || mistakes.length === 0) {
    return { 
      analysis: "Você não tem erros recentes registrados! Continue jogando para que eu possa analisar o seu estilo e sugerir melhorias.",
      recommendedCategories: []
    };
  }

  try {
    // Usando a chave que definiremos como secret ou config no Firebase
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Chave da API não configurada no servidor.");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    const prompt = `
Você é o "Treinador IA", um mestre de xadrez amigável e encorajador focado em ajudar iniciantes.
Aqui está a lista de erros recentes que o jogador cometeu em nosso aplicativo de xadrez:
${JSON.stringify(mistakes)}

Sua tarefa:
1. Escreva uma análise curta e amigável (2 a 3 parágrafos curtos) em português do Brasil.
2. Seja encorajador, não seja muito técnico.
3. Identifique o padrão principal de erro (ex: problema com movimento do cavalo, esquecer de tirar o rei do xeque, etc).
4. No final, retorne um objeto JSON exatamente com esta estrutura:
{
  "analysis": "Seu texto amigável aqui...",
  "recommendedCategories": ["nome da categoria 1", "nome da categoria 2"]
}

Categorias disponíveis no simulador para você recomendar (escolha no máximo 2 que façam sentido para os erros):
- "O Tabuleiro"
- "Treinamento Base"
- "Padrões de Xeque-Mate"
- "Táticas Essenciais"
- "Finais Básicos"
- "Aberturas com 1.e4"
- "Aberturas com 1.d4"
- "Conceitos avançados"
- "Elementos Psicológicos e avançados"
- "As 10 coisas para se aprender primeiro"

Lembre-se: A saída deve ser ÚNICA E EXCLUSIVAMENTE o objeto JSON válido, sem \`\`\`json ou marcações markdown, para que eu possa fazer parse.
`;

    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();
    
    // Limpar marcações markdown caso a IA as inclua acidentalmente
    if (text.startsWith('\`\`\`json')) text = text.substring(7);
    if (text.startsWith('\`\`\`')) text = text.substring(3);
    if (text.endsWith('\`\`\`')) text = text.substring(0, text.length - 3);
    
    return JSON.parse(text.trim());

  } catch (error) {
    console.error("Erro na Cloud Function:", error);
    throw new HttpsError('internal', 'Erro ao processar análise da IA no Firebase.');
  }
});
