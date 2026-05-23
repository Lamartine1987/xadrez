import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckersGame } from './utils/checkersLogic';
import CheckersBoard from './components/CheckersBoard';
import { ArrowLeft, RefreshCw, Trophy, Skull, Bot } from 'lucide-react';
import { useBoardTheme } from './hooks/useBoardTheme';
import { initSounds, playSound } from './utils/sounds';
import { db } from './firebase';
import { doc, getDoc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';

export default function GameBotCheckers({ user }) {
  const navigate = useNavigate();
  const { themeStyles } = useBoardTheme();
  
  const [game, setGame] = useState(new CheckersGame());
  const [difficulty, setDifficulty] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  const [isThinking, setIsThinking] = useState(false);
  const [playerColor, setPlayerColor] = useState('w');
  const historyEndRef = useRef(null);

  useEffect(() => {
    initSounds();
    playSound('gameStart');
  }, []);

  useEffect(() => {
    if (historyEndRef.current) {
      historyEndRef.current.scrollTop = historyEndRef.current.scrollHeight;
    }
  }, [game.history.length]);

  useEffect(() => {
    if (game.turn !== playerColor && !game.isGameOver()) {
       setIsThinking(true);
       setTimeout(() => {
          const depth = difficulty; // 1 to 5
          const bestMoveInfo = game.getBestMove(depth, game.turn);
          if (bestMoveInfo) {
             const m = bestMoveInfo.move;
             game.move(m.from.r, m.from.c, m.to.r, m.to.c);
             if (m.isJump) playSound('capture');
             else playSound('move');
             setGame(Object.assign(new CheckersGame(), game));
          }
          setIsThinking(false);
       }, 500); // add a slight delay for realism
    } else if (game.isGameOver() && !gameOver) {
       setGameOver(true);
       setWinner(game.winner);
       
       const handleGameOverAsync = async () => {
         let pointsChange = 0;
         let starsGained = 0;
         if (game.winner === playerColor) {
            pointsChange = 15 * difficulty;
            starsGained = difficulty * 2;
         } else if (game.winner) {
            pointsChange = -5 * difficulty;
         }
         
         if (user) {
           try {
             if (pointsChange !== 0 || starsGained > 0) {
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
             }
             
             await addDoc(collection(db, 'games'), {
               players: {
                 white: user.uid,
                 whiteName: user.displayName || user.email.split('@')[0],
                 whiteElo: null,
                 black: 'bot',
                 blackName: `Robô Damas Nível ${difficulty}`,
                 blackElo: null
               },
               gameType: 'checkers',
               status: 'finished', 
               history: game.history || [],
               timeControl: 0,
               createdAt: serverTimestamp(),
               updatedAt: serverTimestamp(),
               participantIds: [user.uid]
             });
           } catch (err) {
             console.error("Erro ao atualizar pontos/histórico:", err);
           }
         }
       };
       handleGameOverAsync();
    }
  }, [game.turn, game.history.length, difficulty, playerColor, gameOver]);

  const handleMove = (fromR, fromC, toR, toC) => {
    if (game.turn !== playerColor || game.isGameOver()) return;
    
    const allMoves = game.getAllValidMoves();
    const moveInfo = allMoves.find(m => m.from.r === fromR && m.from.c === fromC && m.to.r === toR && m.to.c === toC);
    
    const success = game.move(fromR, fromC, toR, toC);
    if (success) {
       if (moveInfo && moveInfo.isJump) playSound('capture');
       else playSound('move');
       setGame(Object.assign(new CheckersGame(), game));
    }
  };

  const resetGame = () => {
    setGame(new CheckersGame());
    setGameOver(false);
    setWinner(null);
    setIsThinking(false);
    playSound('gameStart');
  };

  const validMoves = game.getAllValidMoves(playerColor);
  const history = game.history || [];
  const lastMove = history.length > 0 ? history[history.length - 1] : null;

  const movePairs = [];
  for (let i = 0; i < history.length; i += 2) {
    movePairs.push({
      white: history[i].notation,
      black: history[i + 1] ? history[i+1].notation : ''
    });
  }

  if (difficulty === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', minHeight: '100vh', padding: '40px 20px 100px 20px' }}>
        <div className="glass-panel" style={{ textAlign: 'center', maxWidth: '400px', width: '100%' }}>
          <Bot size={48} color="var(--accent-color)" style={{ margin: '0 auto 20px' }} />
          <h2 style={{ marginBottom: '20px' }}>Desafiar o Robô de Damas</h2>
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
          
          <button onClick={() => navigate('/')} className="btn" style={{ width: '100%', marginTop: '20px', background: 'transparent', border: '1px solid var(--glass-border)', color: 'white' }}>
             <ArrowLeft size={18} style={{ marginRight: '8px' }} /> Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-color)', color: 'var(--text-main)' }}>
      {/* Header */}
      <header style={{ padding: '15px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--glass-border)', position: 'sticky', top: 0, zIndex: 100 }}>
        <button onClick={() => navigate('/')} className="btn" style={{ padding: '8px 12px', background: 'transparent', border: '1px solid var(--glass-border)' }}>
          <ArrowLeft size={18} /> Voltar
        </button>
        <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--accent-color)' }}>Damas vs Robô</div>
        <select 
          value={difficulty} 
          onChange={(e) => setDifficulty(Number(e.target.value))}
          className="input-modern"
          style={{ width: 'auto', padding: '8px', cursor: 'pointer' }}
          disabled={game.history.length > 0 && !gameOver}
        >
          <option value={1}>Nível 1</option>
          <option value={2}>Nível 2</option>
          <option value={3}>Nível 3</option>
          <option value={4}>Nível 4</option>
          <option value={5}>Nível 5</option>
        </select>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px', gap: '20px' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: '600px', alignItems: 'center', padding: '10px 15px', background: 'var(--bg-color-lighter)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🤖</div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                 <span style={{ fontWeight: 'bold' }}>Robô de Damas</span>
                 <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Nível {difficulty}</span>
              </div>
           </div>
           {isThinking && <span style={{ color: 'var(--accent-color)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '5px' }}><RefreshCw size={14} className="spin" /> Pensando...</span>}
        </div>

        <div style={{ width: '100%', maxWidth: '600px', marginBottom: '16px' }}>
         <CheckersBoard 
           board={game.board}
           onMove={handleMove}
           playerColor={'w'}
           themeStyles={themeStyles}
           validMoves={validMoves}
           turn={game.turn}
           lastMove={lastMove}
         />
      </div>

         <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: '600px', alignItems: 'center', padding: '10px 15px', background: 'var(--bg-color-lighter)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
               <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-color)', fontWeight: 'bold' }}>
                  {user?.displayName ? user.displayName.charAt(0).toUpperCase() : 'V'}
               </div>
               <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 'bold' }}>{user?.displayName || 'Você'}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Peças Claras</span>
               </div>
            </div>
         </div>

         <div className="move-history-container" ref={historyEndRef} style={{ width: '100%', maxWidth: '600px', marginTop: '0', marginBottom: '20px', borderRadius: '8px', maxHeight: '150px' }}>
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

        {gameOver && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }}>
            <div className="glass-panel" style={{ background: '#1e293b', maxWidth: '400px', width: '100%', textAlign: 'center', padding: '40px 20px', border: winner === playerColor ? '1px solid var(--success-color)' : '1px solid var(--danger-color)', animation: 'fadeIn 0.5s ease' }}>
              {winner === playerColor ? (
                <>
                  <Trophy size={64} color="var(--success-color)" style={{ margin: '0 auto 20px' }} />
                  <h2 style={{ color: 'var(--success-color)', marginBottom: '10px', fontSize: '1.8rem' }}>Você Venceu!</h2>
                </>
              ) : (
                <>
                  <Skull size={64} color="var(--danger-color)" style={{ margin: '0 auto 20px' }} />
                  <h2 style={{ color: 'var(--danger-color)', marginBottom: '10px', fontSize: '1.8rem' }}>O Robô Venceu!</h2>
                </>
              )}
              <p style={{ marginBottom: '20px', color: 'var(--text-muted)' }}>
                Fim de jogo. As {winner === 'w' ? 'Peças Claras' : 'Peças Escuras'} ganharam a partida!
              </p>
              
              <div style={{ display: 'flex', gap: '15px' }}>
                <button onClick={resetGame} className="btn" style={{ flex: 1, padding: '12px', background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Jogar Novamente
                </button>
                <button onClick={() => navigate('/')} className="btn" style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Sair do Jogo
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
