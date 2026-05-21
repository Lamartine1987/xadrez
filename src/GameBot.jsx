import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from './firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { ArrowLeft, Bot, RefreshCw } from 'lucide-react';

export default function GameBot({ user }) {
  const navigate = useNavigate();
  const [game, setGame] = useState(new Chess());
  const [difficulty, setDifficulty] = useState(0); // 0 = not selected
  const [isBotThinking, setIsBotThinking] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [debugMsg, setDebugMsg] = useState('');
  const [boardWidth, setBoardWidth] = useState(300);
  const engineRef = useRef(null);

  useEffect(() => {
    const handleResize = () => {
      setBoardWidth(Math.min(window.innerWidth - 32, 568));
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Initialize Stockfish worker
  useEffect(() => {
    let worker;
    const initEngine = async () => {
      try {
        const response = await fetch('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js');
        if (!response.ok) throw new Error("Network response was not ok");
        const script = await response.text();
        const blob = new Blob([script], { type: 'application/javascript' });
        worker = new Worker(URL.createObjectURL(blob));
        
        worker.onmessage = (event) => {
          const line = event.data;
          if (line.startsWith('bestmove')) {
            const move = line.split(' ')[1];
            if (move) {
              const from = move.substring(0, 2);
              const to = move.substring(2, 4);
              const promotion = move.length > 4 ? move[4] : undefined;
              
              setGame(g => {
                const gameCopy = new Chess(g.fen());
                gameCopy.move({ from, to, promotion });
                return gameCopy;
              });
              setIsBotThinking(false);
            }
          }
        };
        worker.postMessage('uci');
        engineRef.current = worker;
      } catch (err) {
        console.error("Erro ao carregar motor de xadrez. Ativando modo Bot Aleatório.", err);
        engineRef.current = "random"; // Fallback bot
      }
    };
    initEngine();

    return () => {
      if (worker) worker.terminate();
    };
  }, []);

  const getBotLevelParams = (level) => {
    // level 1: depth 1, skill 0
    // level 5: depth 10, skill 20
    const depths = [1, 2, 4, 7, 12];
    const skills = [0, 5, 10, 15, 20];
    return { depth: depths[level - 1], skill: skills[level - 1] };
  };

  const makeBotMove = useCallback(() => {
    if (game.isGameOver() || game.turn() === 'w' || !engineRef.current) return;

    setIsBotThinking(true);
    
    if (engineRef.current === "random") {
      setTimeout(() => {
        setGame(g => {
          const gameCopy = new Chess(g.fen());
          const moves = gameCopy.moves();
          if (moves.length > 0) {
            const randomMove = moves[Math.floor(Math.random() * moves.length)];
            gameCopy.move(randomMove);
          }
          return gameCopy;
        });
        setIsBotThinking(false);
      }, 500);
      return;
    }

    const { depth, skill } = getBotLevelParams(difficulty);
    engineRef.current.postMessage(`setoption name Skill Level value ${skill}`);
    engineRef.current.postMessage(`position fen ${game.fen()}`);
    engineRef.current.postMessage(`go depth ${depth}`);
  }, [game, difficulty]);

  useEffect(() => {
    if (difficulty > 0 && game.turn() === 'b' && !game.isGameOver()) {
      setTimeout(makeBotMove, 500); // slight delay for realism
    }
  }, [game, difficulty, makeBotMove]);

  useEffect(() => {
    if (game.isGameOver() && !gameOver) {
      setGameOver(true);
      handleGameOver();
    }
  }, [game]);

  const handleGameOver = async () => {
    let resultText = "Empate!";
    let pointsChange = 0;
    let starsGained = 0;

    if (game.isCheckmate()) {
      if (game.turn() === 'b') {
        resultText = "Você venceu!";
        pointsChange = 15 * difficulty; // more points for harder bots
        starsGained = difficulty * 2; // stars = difficulty * 2
      } else {
        resultText = "O Robô venceu!";
        pointsChange = -5 * difficulty;
      }
    }

    alert(`Fim de jogo: ${resultText}\nVocê ganhou ${pointsChange} pontos de Elo e ${starsGained} Estrelas!`);

    if ((pointsChange !== 0 || starsGained > 0) && user) {
      try {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const currentElo = snap.data().elo || 1200;
          const currentGames = snap.data().gamesPlayed || 0;
          const currentStars = snap.data().stars || 0;
          await updateDoc(userRef, {
            elo: currentElo + pointsChange,
            stars: currentStars + starsGained,
            gamesPlayed: currentGames + 1
          });
        }
      } catch (err) {
        console.error("Erro ao atualizar pontos", err);
      }
    }
  };

  const onDrop = (sourceSquare, targetSquare) => {
    setDebugMsg(`Tentando mover de ${sourceSquare} para ${targetSquare}...`);
    
    if (game.turn() === 'b') {
      setDebugMsg("Erro: É a vez das pretas (robô).");
      return false;
    }
    if (isBotThinking) {
      setDebugMsg("Erro: O robô ainda está pensando.");
      return false;
    }
    if (game.isGameOver()) {
      setDebugMsg("Erro: O jogo já acabou.");
      return false;
    }

    const gameCopy = new Chess(game.fen());
    try {
      const move = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q',
      });
      if (move === null) {
         setDebugMsg(`Movimento inválido segundo o chess.js! (${sourceSquare}-${targetSquare})`);
         return false;
      }
      setGame(gameCopy);
      setDebugMsg(`Movimento ${sourceSquare}-${targetSquare} aceito!`);
      return true;
    } catch (e) {
      setDebugMsg(`Exceção do chess.js: ${e.message}`);
      return false;
    }
  };

  if (difficulty === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px' }}>
        <button onClick={() => navigate('/lobby')} className="btn" style={{ position: 'absolute', top: 20, left: 20, padding: '8px' }}>
          <ArrowLeft size={20} />
        </button>
        <div className="glass-panel" style={{ textAlign: 'center', maxWidth: '400px', width: '100%' }}>
          <Bot size={48} color="var(--accent-color)" style={{ margin: '0 auto 20px' }} />
          <h2 style={{ marginBottom: '20px' }}>Desafiar o Robô</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '30px' }}>Escolha a dificuldade (1 = Fácil, 5 = Mestre)</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[1, 2, 3, 4, 5].map(level => (
              <button 
                key={level} 
                className="btn" 
                style={{ background: level === 5 ? 'var(--danger-color)' : 'var(--accent-color)' }}
                onClick={() => setDifficulty(level)}
              >
                Nível {level}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', marginTop: '10px' }}>
        <button onClick={() => navigate('/lobby')} className="btn" style={{ padding: '8px' }}>
          <ArrowLeft size={20} />
        </button>
        <button onClick={() => { setGame(new Chess()); setGameOver(false); setIsBotThinking(false); }} className="btn" style={{ padding: '8px 16px', background: 'var(--bg-color-lighter)' }}>
          <RefreshCw size={16} /> Reiniciar
        </button>
      </div>

      <div className="glass-panel" style={{ padding: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-color-lighter)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bot size={24} color="var(--danger-color)" />
          </div>
          <div>
            <div style={{ fontWeight: 'bold' }}>Robô Nível {difficulty}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--accent-color)', height: '15px' }}>
              {isBotThinking ? 'Pensando...' : ''}
            </div>
          </div>
        </div>
        
        <div style={{ padding: '4px 12px', borderRadius: '20px', background: game.turn() === 'w' ? 'white' : 'black', color: game.turn() === 'w' ? 'black' : 'white', fontWeight: 'bold', border: '2px solid var(--accent-color)' }}>
           Vez das {game.turn() === 'w' ? 'Brancas' : 'Pretas'}
        </div>
      </div>

      <div style={{ textAlign: 'center', color: '#fbbf24', fontSize: '12px', marginBottom: '8px', minHeight: '18px' }}>
        {debugMsg}
      </div>

      <div style={{ width: '100%', aspectRatio: '1 / 1', marginBottom: '16px', boxShadow: 'var(--glass-shadow)', borderRadius: '4px', overflow: 'hidden' }}>
        <Chessboard 
          position={game.fen()} 
          boardWidth={boardWidth}
          onPieceDrop={onDrop}
          boardOrientation="white"
          customDarkSquareStyle={{ backgroundColor: '#475569' }}
          customLightSquareStyle={{ backgroundColor: '#cbd5e1' }}
          animationDuration={300}
        />
      </div>

      <div className="glass-panel" style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
          V
        </div>
        <div>
          <div style={{ fontWeight: 'bold' }}>{user.displayName || user.email.split('@')[0]} (Você)</div>
        </div>
      </div>
    </div>
  );
}
