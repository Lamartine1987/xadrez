import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Swords, Bot, Trophy, Users, Shield, Zap } from 'lucide-react';
import { Chessboard } from 'react-chessboard';
import CheckersBoard from './components/CheckersBoard';
import { CheckersGame } from './utils/checkersLogic';

const bgStyles = `
@keyframes floatPiece {
  0% { transform: translateY(0) rotate(0deg); opacity: 0.15; }
  50% { transform: translateY(-40px) rotate(15deg); opacity: 0.35; }
  100% { transform: translateY(0) rotate(0deg); opacity: 0.15; }
}

@keyframes blobMotion {
  0% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(40px, -60px) scale(1.1); }
  66% { transform: translate(-30px, 30px) scale(0.9); }
  100% { transform: translate(0, 0) scale(1); }
}

.bg-blob {
  position: absolute;
  filter: blur(80px);
  z-index: 0;
  opacity: 0.4;
  animation: blobMotion 15s infinite alternate ease-in-out;
  pointer-events: none;
}
.floating-piece {
  position: absolute;
  font-size: 4rem;
  color: var(--accent-color);
  z-index: 0;
  animation: floatPiece 8s infinite ease-in-out;
  pointer-events: none;
}
`;

export default function LandingPage() {
  const navigate = useNavigate();
  const [showChess, setShowChess] = useState(true);
  const checkersInitialBoard = new CheckersGame().board;

  useEffect(() => {
    const interval = setInterval(() => {
      setShowChess(prev => !prev);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const features = [
    {
      icon: <Users size={32} color="var(--accent-color)" />,
      title: "Jogue com Amigos",
      desc: "Desafie seus amigos para partidas online em tempo real e mostre quem é o melhor."
    },
    {
      icon: <Bot size={32} color="var(--accent-color)" />,
      title: "Desafie o Robô",
      desc: "Treine contra nossa inteligência artificial com níveis de dificuldade ajustáveis."
    },
    {
      icon: <Trophy size={32} color="var(--accent-color)" />,
      title: "Ranking Global",
      desc: "Acumule pontos ELO, ganhe estrelas e suba no ranking dos melhores jogadores."
    },
    {
      icon: <Shield size={32} color="var(--accent-color)" />,
      title: "Análise de Partidas",
      desc: "Nosso treinador virtual analisa seus erros e te ajuda a melhorar seu jogo."
    }
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-color)', color: 'var(--text-main)', overflowX: 'hidden', position: 'relative' }}>
      <style>{bgStyles}</style>

      {/* Animated Background */}
      <div className="bg-blob" style={{ top: '10%', left: '10%', width: '300px', height: '300px', background: 'rgba(99, 102, 241, 0.3)', borderRadius: '50%' }}></div>
      <div className="bg-blob" style={{ bottom: '20%', right: '10%', width: '400px', height: '400px', background: 'rgba(129, 140, 248, 0.2)', borderRadius: '50%', animationDelay: '-5s' }}></div>
      <div className="bg-blob" style={{ top: '40%', left: '50%', width: '250px', height: '250px', background: 'rgba(251, 191, 36, 0.15)', borderRadius: '50%', animationDelay: '-10s' }}></div>

      {/* Floating Chess Pieces */}
      <div className="floating-piece" style={{ top: '15%', left: '8%', animationDelay: '0s' }}>♞</div>
      <div className="floating-piece" style={{ top: '30%', right: '12%', animationDelay: '-2s', fontSize: '5rem' }}>♛</div>
      <div className="floating-piece" style={{ bottom: '15%', left: '15%', animationDelay: '-4s', fontSize: '3.5rem' }}>♜</div>
      <div className="floating-piece" style={{ bottom: '25%', right: '8%', animationDelay: '-6s' }}>♟</div>
      <div className="floating-piece" style={{ top: '50%', left: '3%', animationDelay: '-3s', fontSize: '3rem' }}>♝</div>
      <div className="floating-piece" style={{ top: '60%', right: '4%', animationDelay: '-7s', fontSize: '4.5rem' }}>♚</div>

      {/* Header */}
      <header style={{ padding: '20px 5%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--glass-border)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Swords size={32} color="var(--accent-color)" />
          <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-color)', textShadow: '0 0 10px var(--accent-glow)' }}>Lama Games</span>
        </div>
        <div>
          <button className="btn" onClick={() => navigate('/login')}>
            Entrar
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', textAlign: 'center', width: '100%' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '60px', maxWidth: '1200px', width: '100%', marginBottom: '80px', animation: 'fadeIn 1s ease-in-out' }}>
          
          <div style={{ flex: '1 1 300px', textAlign: 'center', maxWidth: '600px' }}>
            <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', marginBottom: '20px', background: 'linear-gradient(to right, var(--accent-color), #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: '800' }}>
              O seu novo portal de jogos de tabuleiro
            </h1>
            <p style={{ fontSize: 'clamp(1rem, 2vw, 1.2rem)', color: 'var(--text-muted)', marginBottom: '40px', lineHeight: '1.6' }}>
              Jogue xadrez e damas online, treine contra robôs, suba no ranking global e divirta-se com seus amigos. Tudo isso em uma interface moderna e intuitiva.
            </p>
            <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn" style={{ padding: '12px 20px', fontSize: '1rem', width: '100%', maxWidth: '320px', justifyContent: 'center', boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)' }} onClick={() => navigate('/login')}>
                <Zap size={20} style={{ marginRight: '8px', flexShrink: 0 }} />
                <span>Começar a Jogar Grátis</span>
              </button>
            </div>
          </div>

          <div style={{ flex: '1 1 300px', maxWidth: '450px', width: '100%', perspective: '1000px', pointerEvents: 'none' }}>
            <div style={{ transform: 'rotateX(15deg) rotateY(-15deg)', boxShadow: '20px 30px 60px rgba(0,0,0,0.6)', borderRadius: '8px', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.1)', background: 'var(--bg-color)', position: 'relative', aspectRatio: '1/1' }}>
              
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: showChess ? 1 : 0, transition: 'opacity 1s ease' }}>
                <Chessboard 
                  id="landingBoardChess" 
                  position="r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3" 
                  customDarkSquareStyle={{ backgroundColor: '#475569' }} 
                  customLightSquareStyle={{ backgroundColor: '#cbd5e1' }}
                  arePiecesDraggable={false}
                />
              </div>

              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: !showChess ? 1 : 0, transition: 'opacity 1s ease' }}>
                <CheckersBoard 
                  board={checkersInitialBoard}
                  onMove={() => {}}
                  playerColor="both"
                  themeStyles={{
                    customDarkSquareStyle: { backgroundColor: '#475569' },
                    customLightSquareStyle: { backgroundColor: '#cbd5e1' }
                  }}
                  validMoves={[]}
                />
              </div>

            </div>
          </div>
          
        </div>

        {/* Features Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '30px', width: '100%', maxWidth: '1100px' }}>
          {features.map((feat, i) => (
            <div key={i} className="glass-panel" style={{ padding: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', transition: 'transform 0.3s ease, box-shadow 0.3s ease', cursor: 'default' }} onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-10px)'; e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)'; }} onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
              <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                {feat.icon}
              </div>
              <h3 style={{ fontSize: '1.3rem', marginBottom: '15px', color: 'white', fontWeight: 'bold' }}>{feat.title}</h3>
              <p style={{ color: 'var(--text-muted)', lineHeight: '1.6', fontSize: '0.95rem' }}>{feat.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer style={{ position: 'relative', zIndex: 1, padding: '30px', textAlign: 'center', borderTop: '1px solid var(--glass-border)', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <Swords size={20} color="var(--accent-color)" />
          <span style={{ fontWeight: 'bold', color: 'white' }}>Lama Games</span>
        </div>
        <p style={{ fontSize: '0.9rem' }}>© {new Date().getFullYear()} Desenvolvido para amantes de jogos de tabuleiro.</p>
      </footer>
    </div>
  );
}
