const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentUpdated, onDocumentWritten } = require("firebase-functions/v2/firestore");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// API da Nuvem de WhatsApp
const WHATSAPP_API_URL = 'https://apiz.com.br';
// A chave idealmente deve estar no process.env.WHATSAPP_API_KEY
const WHATSAPP_API_KEY = process.env.WHATSAPP_API_KEY || 'minha_chave_super_secreta_123';
const INSTANCE_NAME = 'xadrez';

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
    
    if (text.startsWith('\`\`\`json')) text = text.substring(7);
    if (text.startsWith('\`\`\`')) text = text.substring(3);
    if (text.endsWith('\`\`\`')) text = text.substring(0, text.length - 3);
    
    return JSON.parse(text.trim());

  } catch (error) {
    console.error("Erro na Cloud Function:", error);
    throw new HttpsError('internal', 'Erro ao processar análise da IA no Firebase.');
  }
});

// ==========================================
// INTEGRAÇÃO API WHATSAPP
// ==========================================

// Função para solicitar a criação da instância do WhatsApp via API
exports.createWhatsappInstance = onCall({ region: "us-central1", cors: [/vercel\\.app$/, /localhost/] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Acesso negado.');

  try {
      const response = await axios.post(`${WHATSAPP_API_URL}/instance/create`, {
          instanceName: INSTANCE_NAME
      }, {
          headers: { 'x-api-key': WHATSAPP_API_KEY }
      });
      return { success: true, data: response.data };
  } catch (error) {
      console.error('Erro ao criar instância:', error.response ? error.response.data : error.message);
      throw new HttpsError('internal', 'Erro ao conectar com API WhatsApp');
  }
});

// Função para buscar o status atual (e QR Code se estiver desconectado)
exports.getWhatsappStatus = onCall({ region: "us-central1", cors: [/vercel\\.app$/, /localhost/] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Acesso negado.');

  try {
      const response = await axios.get(`${WHATSAPP_API_URL}/instance/status/${INSTANCE_NAME}`, {
          headers: { 'x-api-key': WHATSAPP_API_KEY }
      });
      return { success: true, data: response.data };
  } catch (error) {
      // A API retorna 403 ou 404 se a instância não existe
      if (error.response && (error.response.status === 404 || error.response.status === 403)) {
          return { success: false, status: 'NOT_FOUND' };
      }
      console.error('Erro ao buscar status:', error.response ? error.response.data : error.message);
      throw new HttpsError('internal', 'Erro ao consultar API WhatsApp');
  }
});

// Trigger que escuta modificações e criações em jogos
exports.notifyTournamentPlayers = onDocumentWritten("games/{gameId}", async (event) => {
    // Se o documento foi deletado, ignora
    if (!event.data.after.exists) return;

    const newData = event.data.after.data();
    const oldData = event.data.before ? event.data.before.data() : null;
    const gameId = event.params.gameId;

    // Se não pertencer a um torneio, ignora
    if (!newData.tournamentId) return;
    
    // Se a mensagem já foi enviada, ignora
    if (newData.whatsappSent) return;

    // Se o status da partida for "playing" e antes não era "playing" (ou acabou de ser criada como "playing")
    const wasPlaying = oldData ? oldData.status === 'playing' : false;
    
    if (newData.status === 'playing' && !wasPlaying) {
       
       const { white, black, whiteName, blackName, gameType } = newData.players || {};
       if (!white || !black) return;

       const gameTypeLabel = newData.gameType === 'checkers' ? 'Damas' : 'Xadrez';
       const SITE_URL = 'https://xadrez-bot-two.vercel.app'; // Substituir pelo domínio final

       try {
           // Busca o template da mensagem
           let template = "🏆 Olá {{name}}! A sua partida de {{gameType}} do torneio já está pronta. Clique no link para jogar: {{link}}";
           try {
               const settingsDoc = await db.collection('settings').doc('whatsapp').get();
               if (settingsDoc.exists && settingsDoc.data().template) {
                   template = settingsDoc.data().template;
               }
           } catch(e) {
               console.error("Erro ao buscar template", e);
           }

           // Busca o telefone dos jogadores no Firestore
           const whiteDoc = await db.collection('users').doc(white).get();
           const blackDoc = await db.collection('users').doc(black).get();

           let sentCount = 0;

           const sendMensagem = async (phoneStr, name) => {
               if (!phoneStr) return;
               // Formatar telefone: remover não-dígitos e garantir 55 (Brasil) no começo
               let phone = phoneStr.replace(/\D/g, '');
               if (!phone.startsWith('55') && phone.length === 11) phone = '55' + phone;
               else if (!phone.startsWith('55') && phone.length === 10) phone = '55' + phone;

               const text = template
                   .replace(/{{name}}/g, name)
                   .replace(/{{gameType}}/g, gameTypeLabel)
                   .replace(/{{link}}/g, `${SITE_URL}/game/${gameId}`);

               await axios.post(`${WHATSAPP_API_URL}/${INSTANCE_NAME}/send-text`, {
                   number: phone,
                   text: text
               }, {
                   headers: { 'x-api-key': WHATSAPP_API_KEY }
               });
               sentCount++;
           };

           if (whiteDoc.exists) await sendMensagem(whiteDoc.data().phone, whiteName);
           if (blackDoc.exists) await sendMensagem(blackDoc.data().phone, blackName);

           if (sentCount > 0) {
               await event.data.after.ref.update({ whatsappSent: true });
               console.log(`WhatsApp enviado para partida de torneio ${gameId}`);
           }

       } catch (error) {
           console.error("Erro ao notificar via WhatsApp API:", error.response ? error.response.data : error.message);
       }
    }
});
