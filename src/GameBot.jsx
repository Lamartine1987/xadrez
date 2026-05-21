import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from './firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { ArrowLeft, Bot, RefreshCw, X, Brain } from 'lucide-react';

export default function GameBot({ user }) {
  const navigate = useNavigate();
  const [game, setGame] = useState(new Chess());
  const [difficulty, setDifficulty] = useState(0); // 0 = not selected
  const [isBotThinking, setIsBotThinking] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [optionSquares, setOptionSquares] = useState({});
  const [coachMessage, setCoachMessage] = useState("Vamos começar! O Robô está pronto para a batalha.");

  const showToast = (msg) => {
    setToastMsg(msg);
  };
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
                if (gameCopy.inCheck()) {
                  setCoachMessage("Cuidado! Seu Rei está em xeque.");
                } else if (gameCopy.isGameOver()) {
                  setCoachMessage("Fim de jogo!");
                } else {
                  setCoachMessage("Sua vez de jogar.");
                }
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

  function getMoveOptions(square) {
    const moves = game.moves({ square, verbose: true });
    if (moves.length === 0) {
      setOptionSquares({});
      return;
    }
    const newSquares = {};
    moves.map((move) => {
      newSquares[move.to] = {
        background: game.get(move.to) && game.get(move.to).color !== game.get(square).color
            ? 'radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)'
            : 'radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)',
        borderRadius: '50%'
      };
      return move;
    });
    newSquares[square] = { background: 'rgba(255, 255, 0, 0.4)' };
    setOptionSquares(newSquares);
  }

  function onSquareClick(square) { 
    if (game.turn() === 'w') getMoveOptions(square); 
  }

  function onPieceDragBegin(piece, sourceSquare) { 
    if (game.turn() === 'w') getMoveOptions(sourceSquare); 
  }

  const onDrop = (sourceSquare, targetSquare, piece) => {
    if (game.turn() === 'b') {
      setCoachMessage("Não é sua vez! O robô joga com as pretas.");
      return false;
    }
    if (isBotThinking) {
      showToast("O robô ainda está pensando no lance dele.");
      return false;
    }
    if (gameOver) {
      setCoachMessage("A partida já terminou!");
      return false;
    }

    setOptionSquares({});
    const gameCopy = new Chess(game.fen());
    
    const handleInvalidMove = () => {
         const piece = gameCopy.get(sourceSquare);
         let msg = "Lance inválido! Verifique as regras de movimento.";
         if (piece) {
            const isCheck = typeof gameCopy.in_check === 'function' ? gameCopy.in_check() : (typeof gameCopy.isCheck === 'function' ? gameCopy.isCheck() : false);
            
            if (isCheck) {
               msg = `Seu Rei está em XEQUE! O seu lance obrigatoriamente precisa protegê-lo (fugindo, defendendo ou capturando a ameaça).`;
            } else {
               const sFile = sourceSquare.charCodeAt(0);
               const sRank = parseInt(sourceSquare[1]);
               const tFile = targetSquare.charCodeAt(0);
               const tRank = parseInt(targetSquare[1]);
               
               if (piece.type === 'p') {
                   if ((piece.color === 'w' && sRank > tRank) || (piece.color === 'b' && sRank < tRank)) {
                       msg = "O Peão nunca pode andar para trás!";
                   } else if (sFile !== tFile) {
                       msg = "O Peão só pode andar na diagonal se for para capturar uma peça adversária!";
                   } else if (Math.abs(sRank - tRank) > 2) {
                       msg = "Você tentou avançar muitas casas! O Peão só pode andar 2 casas no primeiro movimento, e depois apenas 1 por vez.";
                   } else if (Math.abs(sRank - tRank) === 2 && ((piece.color === 'w' && sRank !== 2) || (piece.color === 'b' && sRank !== 7))) {
                       msg = "O Peão só pode andar 2 casas se estiver na sua posição inicial!";
                   } else {
                       msg = "A casa à frente do Peão parece estar bloqueada por outra peça.";
                   }
               } else if (piece.type === 'n') {
                   msg = "Movimento inválido. O Cavalo se move obrigatoriamente em 'L' (2 casas numa direção e 1 noutra).";
               } else if (piece.type === 'b') {
                   msg = "Movimento inválido. O Bispo anda apenas nas diagonais e não pula outras peças.";
               } else if (piece.type === 'r') {
                   msg = "Movimento inválido. A Torre anda apenas em linhas retas (vertical ou horizontal) e não pula peças.";
               } else if (piece.type === 'q') {
                   msg = "Movimento inválido. A Rainha anda em retas ou diagonais, mas não pula outras peças.";
               } else if (piece.type === 'k') {
                   msg = "Movimento inválido. O Rei anda apenas 1 casa por vez e nunca para uma casa que esteja sendo atacada.";
               }
            }
            try {
               addDoc(collection(db, 'mistakes'), {
                  userId: user.uid,
                  piece: piece.type,
                  errorType: "invalid_move",
                  message: msg,
                  timestamp: serverTimestamp()
               });
            } catch (err) {
               console.error("Erro ao gravar erro", err);
            }
         }
         setCoachMessage(msg); // Treinador narra o erro
         return false;
    };

    try {
      const move = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q',
      });
      if (move === null) {
         return handleInvalidMove();
      }
      setGame(gameCopy);
      setCoachMessage("Boa jogada!");
      return true;
    } catch (e) {
      return handleInvalidMove();
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
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', padding: '16px', maxWidth: '600px', margin: '0 auto', position: 'relative' }}>
      
      {/* Toast Notification */}
      {toastMsg && (
        <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', background: 'var(--danger-color)', color: 'white', padding: '12px 24px', borderRadius: '8px', zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.5)', width: '90%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '15px' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 'bold', flex: 1, textAlign: 'left' }}>{toastMsg}</span>
          <button onClick={() => setToastMsg('')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={20} />
          </button>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', marginTop: '10px' }}>
        <button onClick={() => navigate('/lobby')} className="btn" style={{ padding: '8px' }}>
          <ArrowLeft size={20} />
        </button>
        <button onClick={() => { setGame(new Chess()); setGameOver(false); setIsBotThinking(false); setCoachMessage("Partida reiniciada!"); }} className="btn" style={{ padding: '8px 16px', background: 'var(--bg-color-lighter)' }}>
          <RefreshCw size={16} /> Reiniciar
        </button>
      </div>

      {/* O Treinador IA Vivo */}
      <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: '16px', gap: '12px' }}>
         <div style={{ position: 'relative', width: '50px', height: '50px', background: 'var(--accent-color)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', zIndex: 2 }}>
            <Brain size={28} color="white" />
         </div>
         <div style={{ background: 'white', color: '#1e293b', padding: '12px 16px', borderRadius: '16px', borderBottomLeftRadius: '4px', flex: 1, fontSize: '0.9rem', fontWeight: '500', boxShadow: '0 4px 15px rgba(0,0,0,0.15)', position: 'relative' }}>
            {coachMessage}
            <div style={{ position: 'absolute', left: '-8px', bottom: '10px', width: '0', height: '0', borderTop: '8px solid transparent', borderRight: '12px solid white', borderBottom: '8px solid transparent' }}></div>
         </div>
      </div>

      <div className="glass-panel" style={{ padding: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-color-lighter)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bot size={24} color="var(--danger-color)" />
          </div>
          <div>
            <div style={{ fontWeight: 'bold' }}>Robô Nível {difficulty}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--accent-color)', minHeight: '16px' }}>
              {isBotThinking ? 'Pensando...' : ''}
            </div>
          </div>
        </div>
        
        <div style={{ padding: '4px 12px', borderRadius: '20px', background: game.turn() === 'w' ? 'white' : 'black', color: game.turn() === 'w' ? 'black' : 'white', fontWeight: 'bold', border: '2px solid var(--accent-color)' }}>
           Vez das {game.turn() === 'w' ? 'Brancas' : 'Pretas'}
        </div>
      </div>

      <div style={{ width: '100%', aspectRatio: '1 / 1', marginBottom: '16px', boxShadow: 'var(--glass-shadow)', borderRadius: '4px', overflow: 'hidden' }}>
        <Chessboard 
          id="BotBoard" 
          position={game.fen()} 
          boardWidth={boardWidth}
          onPieceDrop={onDrop}
          onPieceDragBegin={onPieceDragBegin}
          onSquareClick={onSquareClick}
          customSquareStyles={optionSquares}
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
