import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from './firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ArrowLeft, Brain, Sparkles, BookOpen, ChevronRight, Activity } from 'lucide-react';

export default function Coach({ user }) {
  const navigate = useNavigate();
  const [mistakes, setMistakes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const fetchMistakes = async () => {
      if (!user) return;
      try {
        const q = query(
          collection(db, 'mistakes'),
          where('userId', '==', user.uid)
        );
        const snapshot = await getDocs(q);
        const data = snapshot.docs
           .map(doc => doc.data())
           .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))
           .slice(0, 20); // Analisar apenas os últimos 20 erros mais recentes
        setMistakes(data);
      } catch (err) {
        console.error("Erro ao buscar erros:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMistakes();
  }, [user]);

  const generateAnalysis = async () => {
    if (mistakes.length === 0) {
      setErrorMsg("Você ainda não tem erros suficientes registrados. Jogue algumas partidas primeiro!");
      return;
    }
    
    setAnalyzing(true);
    setErrorMsg('');
    
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Chave da API Gemini não encontrada.");
      }
      
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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
      
      const parsedData = JSON.parse(text.trim());
      setAnalysisResult(parsedData);
      
    } catch (error) {
      console.error("Erro ao processar análise da IA no frontend:", error);
      setErrorMsg("Erro ao processar análise. Tente novamente mais tarde.");
    } finally {
      setAnalyzing(false);
    }
  };

  const goToCategory = (categoryName) => {
    // Passar estado via navegação para abrir a categoria certa no Tutorial
    navigate('/tutorial', { state: { activeCategory: categoryName } });
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Carregando estatísticas...</div>;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '30px' }}>
        <button onClick={() => navigate('/lobby')} className="btn" style={{ padding: '8px' }}>
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Brain color="var(--accent-color)" /> Meu Treinador IA
        </h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
        <div className="glass-panel" style={{ padding: '20px', textAlign: 'center' }}>
          <Activity size={32} color="#fbbf24" style={{ margin: '0 auto 10px' }} />
          <h3>Erros Mapeados</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: '10px 0', color: 'var(--text-main)' }}>
            {mistakes.length}
          </p>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Nos seus últimos jogos</p>
        </div>

        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h3>Consultoria de Mestre</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '15px' }}>
            A IA analisará seus movimentos recentes para descobrir onde você precisa melhorar.
          </p>
          <button 
            onClick={generateAnalysis} 
            disabled={analyzing || mistakes.length === 0}
            className="btn" 
            style={{ 
               background: analyzing ? 'var(--bg-color-lighter)' : 'linear-gradient(45deg, #8b5cf6, #3b82f6)',
               border: 'none',
               display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' 
            }}
          >
            {analyzing ? <RefreshSpinner /> : <Sparkles size={18} />}
            {analyzing ? 'Analisando...' : 'Gerar Plano de Estudo'}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div style={{ padding: '15px', background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', borderRadius: '8px', marginBottom: '20px', textAlign: 'center' }}>
          {errorMsg}
        </div>
      )}

      {analysisResult && (
        <div className="glass-panel" style={{ padding: '30px', border: '2px solid rgba(139, 92, 246, 0.5)', background: 'linear-gradient(to bottom right, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9))' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#a78bfa', marginBottom: '20px' }}>
            <Sparkles size={24} /> Relatório da IA
          </h2>
          
          <p style={{ lineHeight: '1.8', fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '30px', whiteSpace: 'pre-line' }}>
            {analysisResult.analysis}
          </p>

          {analysisResult.recommendedCategories && analysisResult.recommendedCategories.length > 0 && (
            <>
              <h3 style={{ marginBottom: '15px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                Módulos Sugeridos para Você:
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {analysisResult.recommendedCategories.map((cat, idx) => (
                  <button 
                    key={idx}
                    onClick={() => goToCategory(cat)}
                    className="btn"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '16px 20px', textAlign: 'left', width: '100%'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <BookOpen size={20} color="var(--accent-color)" />
                      <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{cat}</span>
                    </div>
                    <ChevronRight size={20} color="var(--text-muted)" />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Simple spinner component
const RefreshSpinner = () => (
  <svg style={{ animation: 'spin 1s linear infinite', width: '18px', height: '18px' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25"></circle>
    <path fill="currentColor" opacity="0.75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
  </svg>
);
