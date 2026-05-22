import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from './firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { useBoardTheme } from './hooks/useBoardTheme';
import { ArrowLeft, Bot, RefreshCw, X, Brain, Flag, Undo2, Trophy, Star } from 'lucide-react';
import { initSounds, playSound } from './utils/sounds';
import { calculateMaterialAdvantage } from './utils/chessLogic';
import CapturedPieces from './components/CapturedPieces';

export default function GameBot({ user }) {
  const navigate = useNavigate();
  const [game, setGame] = useState(new Chess());
  const [difficulty, setDifficulty] = useState(0); // 0 = not selected
  const [isBotThinking, setIsBotThinking] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [gameOverData, setGameOverData] = useState(null);
  const [toastMsg, setToastMsg] = useState('');
  const [optionSquares, setOptionSquares] = useState({});
  const [moveFrom, setMoveFrom] = useState(null);
  const [showOptions, setShowOptions] = useState(true);
  const { themeStyles } = useBoardTheme();
  const [coachMessage, setCoachMessage] = useState("Vamos começar! O Robô está pronto para a batalha.");

  const showToast = (msg) => {
    setToastMsg(msg);
  };
  const engineRef = useRef(null);
  const historyEndRef = useRef(null);

  // Initialize Stockfish worker and sounds
  useEffect(() => {
    window.scrollTo(0, 0);
    initSounds();
    playSound('gameStart');
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
                const gameCopy = new Chess();
                gameCopy.loadPgn(g.pgn());
                const moveObj = gameCopy.move({ from, to, promotion });
                if (moveObj) {
                  if (moveObj.san.includes('+') || moveObj.san.includes('#')) {
                    playSound('check');
                  } else if (moveObj.flags.includes('c') || moveObj.flags.includes('e')) {
                    playSound('capture');
                  } else {
                    playSound('move');
                  }
                }
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
          const gameCopy = new Chess();
          gameCopy.loadPgn(g.pgn());
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

  useEffect(() => {
    if (historyEndRef.current) {
      historyEndRef.current.scrollTop = historyEndRef.current.scrollHeight;
    }
  }, [game.history().length]);

  const handleGameOver = async () => {
    let resultText = "Empate!";
    let pointsChange = 0;
    let starsGained = 0;

    if (game.isCheckmate()) {
      if (game.turn() === 'b') {
        resultText = "Você venceu o Robô!";
        pointsChange = 15 * difficulty; // more points for harder bots
        starsGained = difficulty * 2; // stars = difficulty * 2
      } else {
        resultText = "Xeque-Mate! O Robô venceu.";
        pointsChange = -5 * difficulty;
      }
    } else if (game.isDraw() || game.isStalemate() || game.isThreefoldRepetition() || game.isInsufficientMaterial()) {
      resultText = "Empate!";
    }

    setGameOverData({ resultText, pointsChange, starsGained });

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
    if (!showOptions) {
      setOptionSquares({});
      return;
    }
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
    if (game.turn() === 'b' || isBotThinking || gameOver) return;

    // Se nenhum quadrado foi selecionado ainda
    if (moveFrom === null) {
      const pieceObj = game.get(square);
      if (pieceObj && pieceObj.color === 'w') {
        setMoveFrom(square);
        getMoveOptions(square);
      }
      return;
    }

    // Se já tinha um quadrado selecionado, tenta fazer a jogada
    const pieceObj = game.get(moveFrom);
    if (!pieceObj) {
      setMoveFrom(null);
      return;
    }
    
    // Constrói a string da peça como o react-chessboard usa ('wP', 'wN', etc)
    const pieceStr = pieceObj.color + pieceObj.type.toUpperCase();
    
    // Tenta mover chamando a função onDrop que já tem todas as validações
    const success = onDrop(moveFrom, square, pieceStr);
    
    // Se não foi um movimento válido (ex: clicou fora ou em movimento proibido)
    if (!success) {
       const clickedPiece = game.get(square);
       // Se clicou em outra peça própria, muda a seleção
       if (clickedPiece && clickedPiece.color === 'w') {
          setMoveFrom(square);
          getMoveOptions(square);
       } else {
          // Desmarca
          setMoveFrom(null);
          setOptionSquares({});
       }
    } else {
       // Movimento de sucesso
       setMoveFrom(null);
    }
  }

  function onPieceDragBegin(piece, sourceSquare) { 
    if (game.turn() === 'w') {
      setMoveFrom(sourceSquare);
      getMoveOptions(sourceSquare);
    }
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
    const gameCopy = new Chess();
    gameCopy.loadPgn(game.pgn());
    
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
      
      if (move.san.includes('+') || move.san.includes('#')) {
        playSound('check');
      } else if (move.flags.includes('c') || move.flags.includes('e')) {
        playSound('capture');
      } else {
        playSound('move');
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

  const history = game.history();
  const movePairs = [];
  for (let i = 0; i < history.length; i += 2) {
    movePairs.push({
      white: history[i],
      black: history[i + 1] || ''
    });
  }

  const handleUndo = () => {
    if (gameOver) return;
    setGame(g => {
       const gameCopy = new Chess();
       gameCopy.loadPgn(g.pgn());
       gameCopy.undo(); // undo bot move
       gameCopy.undo(); // undo player move
       return gameCopy;
    });
    setCoachMessage("Lance desfeito. Tente outra estratégia!");
  };

  const closeGameOverModal = () => {
    setGameOverData(null);
  };

  const material = calculateMaterialAdvantage(game);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', padding: '8px', paddingBottom: '90px' }}>
      
      {/* Game Over Modal */}
      {gameOverData && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div className="glass-panel" style={{ background: '#1e293b', maxWidth: '400px', width: '90%', textAlign: 'center', padding: '40px 20px', border: '1px solid var(--accent-color)' }}>
            <Trophy size={64} color={gameOverData.pointsChange > 0 ? "var(--success-color)" : (gameOverData.pointsChange < 0 ? "var(--danger-color)" : "var(--text-muted)")} style={{ marginBottom: '20px' }} />
            <h2 style={{ fontSize: '1.8rem', marginBottom: '10px' }}>{gameOverData.resultText}</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '30px', fontSize: '1.1rem' }}>
              {gameOverData.pointsChange > 0 ? 'Excelente desempenho!' : (gameOverData.pointsChange < 0 ? 'Não desanime, tente novamente!' : 'Uma partida equilibrada.')}
            </p>
            
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '30px' }}>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '8px', minWidth: '100px' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '5px' }}>ELO</div>
                <div style={{ fontWeight: 'bold', fontSize: '1.4rem', color: gameOverData.pointsChange > 0 ? 'var(--success-color)' : (gameOverData.pointsChange < 0 ? 'var(--danger-color)' : 'white') }}>
                  {gameOverData.pointsChange > 0 ? '+' : ''}{gameOverData.pointsChange}
                </div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '8px', minWidth: '100px' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '5px' }}>ESTRELAS</div>
                <div style={{ fontWeight: 'bold', fontSize: '1.4rem', color: 'gold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                  +{gameOverData.starsGained} <Star size={18} fill="gold" />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '15px' }}>
              <button className="btn" onClick={() => { closeGameOverModal(); setGame(new Chess()); setGameOver(false); setIsBotThinking(false); setCoachMessage("Nova partida, vamos lá!"); }} style={{ flex: 1 }}>
                <RefreshCw size={18} /> Jogar Novamente
              </button>
              <button className="btn" onClick={() => navigate('/lobby')} style={{ background: 'rgba(255,255,255,0.1)', flex: 1 }}>
                <ArrowLeft size={18} /> Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMsg && (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', background: 'var(--danger-color)', color: 'white', padding: '12px 24px', borderRadius: '8px', zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.5)', width: '90%', maxWidth: '400px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '15px' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 'bold', flex: 1, textAlign: 'left' }}>{toastMsg}</span>
          <button onClick={() => setToastMsg('')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={20} />
          </button>
        </div>
      )}

      <div className="game-layout">
        {/* Lado Esquerdo: Tabuleiro e Treinador */}
        <div className="game-board-container">
          
          {/* Card Topo (Robô) */}
          <div className="glass-panel" style={{ padding: '8px 12px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '4px', background: 'var(--bg-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={24} color="var(--danger-color)" />
              </div>
              <div>
                <div style={{ fontWeight: 'bold' }}>Robô Nível {difficulty}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--accent-color)', minHeight: '16px' }}>
                  {isBotThinking ? 'Pensando...' : ''}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
               <div style={{ padding: '4px 12px', borderRadius: '4px', background: game.turn() === 'b' ? 'var(--accent-color)' : 'rgba(255,255,255,0.1)', color: 'white', fontWeight: 'bold', fontSize: '0.8rem' }}>
                  Pretas
               </div>
               <CapturedPieces captured={material.capturedByBlack} advantage={material.blackAdvantage} color="black" />
            </div>
          </div>

          {/* Tabuleiro */}
          <div style={{ width: '100%', aspectRatio: '1 / 1', overflow: 'hidden', marginBottom: '16px', boxShadow: 'var(--glass-shadow)', borderRadius: '4px' }}>
            <Chessboard 
              id="BotBoard" 
              position={game.fen()} 
              onPieceDrop={onDrop}
              onPieceDragBegin={onPieceDragBegin}
              onSquareClick={onSquareClick}
              customSquareStyles={{
                ...(game.history({ verbose: true }).length > 0 ? {
                  [game.history({ verbose: true })[game.history({ verbose: true }).length - 1].from]: { background: 'rgba(255, 255, 0, 0.4)' },
                  [game.history({ verbose: true })[game.history({ verbose: true }).length - 1].to]: { background: 'rgba(255, 255, 0, 0.4)' }
                } : {}),
                ...optionSquares
              }}
              boardOrientation="white"
              {...themeStyles}
              animationDuration={300}
            />
          </div>

          {/* Card Base (Jogador) */}
          <div className="glass-panel" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '4px', background: 'var(--accent-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
                {user.displayName ? user.displayName[0].toUpperCase() : 'V'}
              </div>
              <div>
                <div style={{ fontWeight: 'bold' }}>{user.displayName || user.email.split('@')[0]}</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
               <div style={{ padding: '4px 12px', borderRadius: '4px', background: game.turn() === 'w' ? 'white' : 'rgba(255,255,255,0.1)', color: game.turn() === 'w' ? 'black' : 'white', fontWeight: 'bold', fontSize: '0.8rem' }}>
                  Brancas
               </div>
               <CapturedPieces captured={material.capturedByWhite} advantage={material.whiteAdvantage} color="white" />
            </div>
          </div>
        </div>

        {/* Lado Direito: Sidebar de Controle */}
        <div className="game-sidebar">
          <div className="sidebar-header">
             <Bot size={20} />
             <span>Jogar Com Bots</span>
          </div>
          
          <div className="sidebar-content" style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '15px', background: 'linear-gradient(180deg, #1e293b, #0f172a)' }}>
             <div style={{ display: 'flex', alignItems: 'flex-start', gap: '15px', width: '100%' }}>
               <div style={{ position: 'relative', width: '60px', height: '60px', background: 'var(--accent-color)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '2px solid rgba(255,255,255,0.2)', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
                  <Bot size={36} color="white" />
               </div>
               <div style={{ background: 'white', color: '#1e293b', padding: '12px 16px', borderRadius: '16px', borderTopLeftRadius: '4px', flex: 1, fontSize: '0.9rem', fontWeight: '500', position: 'relative', boxShadow: '0 4px 15px rgba(0,0,0,0.15)' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px', color: 'var(--accent-color)' }}>Robô Nível {difficulty}</div>
                  {coachMessage}
                  <div style={{ position: 'absolute', left: '-8px', top: '20px', width: '0', height: '0', borderTop: '8px solid transparent', borderRight: '12px solid white', borderBottom: '8px solid transparent' }}></div>
               </div>
             </div>
             
             {/* Toggle de Dicas */}
             <div style={{ width: '100%', marginTop: '10px', padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
               <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Mostrar Dicas de Movimento</span>
               <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                 <input 
                   type="checkbox" 
                   checked={showOptions} 
                   onChange={(e) => {
                     setShowOptions(e.target.checked);
                     if (!e.target.checked) setOptionSquares({});
                   }}
                   style={{ accentColor: 'var(--accent-color)', width: '18px', height: '18px' }}
                 />
               </label>
            </div>
          </div>

          <div className="move-history-container" ref={historyEndRef}>
             {movePairs.length === 0 && (
               <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>A partida ainda não começou.</div>
             )}
             {movePairs.map((pair, index) => (
               <div key={index} className="move-row">
                 <div className="move-number">{index + 1}.</div>
                 <div className="move-white">{pair.white}</div>
                 <div className="move-black">{pair.black}</div>
               </div>
             ))}
          </div>

          <div className="sidebar-actions">
             <button className="action-btn" title="Desistir / Menu" onClick={() => navigate('/lobby')}>
                <Flag size={20} />
             </button>
             <button className="action-btn" title="Voltar Lance" onClick={handleUndo}>
                <Undo2 size={20} />
             </button>
             <button className="action-btn" title="Reiniciar" onClick={() => { setGame(new Chess()); setGameOver(false); setIsBotThinking(false); setCoachMessage("Partida reiniciada!"); }}>
                <RefreshCw size={20} />
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}
