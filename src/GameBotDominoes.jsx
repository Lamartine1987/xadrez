import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from './firebase';
import { doc, getDoc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { DominoesGame } from './utils/dominoesLogic';
import DominoTile from './components/DominoTile';
import { ArrowLeft, RefreshCw, Trophy, Skull, Bot, Info } from 'lucide-react';
import { playSound } from './utils/sounds';

export default function GameBotDominoes({ user }) {
  const navigate = useNavigate();
  
  const [game, setGame] = useState(new DominoesGame());
  const [difficulty, setDifficulty] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  const [isThinking, setIsThinking] = useState(false);
  const [playerColor, setPlayerColor] = useState('w');
  const [selectedTileIndex, setSelectedTileIndex] = useState(null);
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  useEffect(() => {
    playSound('gameStart');
  }, []);

  useEffect(() => {
    if (game.turn !== playerColor && !game.isGameOver()) {
       setIsThinking(true);
       setTimeout(() => {
          const actionInfo = game.getBotAction(difficulty, game.turn);
          if (actionInfo) {
             const newGame = new DominoesGame();
             newGame.load(game.getState());
             
             if (actionInfo.action === 'play') {
                newGame.playTile(game.turn, actionInfo.tileIndex, actionInfo.end);
                playSound('move');
             } else if (actionInfo.action === 'draw') {
                newGame.drawTile(game.turn);
             } else if (actionInfo.action === 'pass') {
                newGame.passTurn(game.turn);
             }
             setGame(newGame);
          }
          setIsThinking(false);
       }, Math.random() * 1000 + 500); // 0.5s to 1.5s thinking time
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
                 blackName: `Robô Dominó Nível ${difficulty}`,
                 blackElo: null
               },
               gameType: 'dominoes',
               status: 'finished', 
               history: game.history || [],
               timeControl: 0,
               createdAt: serverTimestamp(),
               updatedAt: serverTimestamp(),
               participantIds: [user.uid]
             });
           } catch (err) {
             console.error("Erro ao atualizar pontos:", err);
           }
         }
       };
       handleGameOverAsync();
    }
  }, [game.turn, difficulty, playerColor, gameOver, game]);

  const handleDrawTile = () => {
    if (game.turn !== playerColor || game.isGameOver()) return;
    const newGame = new DominoesGame();
    newGame.load(game.getState());
    if (newGame.drawTile(playerColor)) {
       setGame(newGame);
    }
  };

  const handlePassTurn = () => {
    if (game.turn !== playerColor || game.isGameOver()) return;
    const newGame = new DominoesGame();
    newGame.load(game.getState());
    if (newGame.passTurn(playerColor)) {
       setGame(newGame);
    } else {
       showToast("Você ainda pode jogar ou comprar!");
    }
  };

  const handlePlayTile = (tileIndex, end) => {
    if (game.turn !== playerColor || game.isGameOver()) return;
    const newGame = new DominoesGame();
    newGame.load(game.getState());
    if (newGame.playTile(playerColor, tileIndex, end)) {
       playSound('move');
       setGame(newGame);
       setSelectedTileIndex(null);
    } else {
       showToast("Movimento inválido.");
       setSelectedTileIndex(null);
    }
  };

  const onTileClick = (index) => {
    if (game.turn !== playerColor || game.isGameOver()) return;
    
    const validMoves = game.getValidMoves(playerColor).filter(m => m.tile[0] === game.hands[playerColor][index][0] && m.tile[1] === game.hands[playerColor][index][1]);
    
    if (validMoves.length === 0) {
       showToast("Esta peça não encaixa na mesa.");
       return;
    }
    
    if (validMoves.length === 1) {
       handlePlayTile(index, validMoves[0].end);
    } else {
       setSelectedTileIndex(index === selectedTileIndex ? null : index);
    }
  };

  const resetGame = () => {
    setGame(new DominoesGame());
    setGameOver(false);
    setWinner(null);
    setIsThinking(false);
    setSelectedTileIndex(null);
    playSound('gameStart');
  };

  if (difficulty === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', minHeight: '100vh', padding: '40px 20px 100px 20px' }}>
        <div className="glass-panel" style={{ textAlign: 'center', maxWidth: '400px', width: '100%' }}>
          <Bot size={48} color="var(--accent-color)" style={{ margin: '0 auto 20px' }} />
          <h2 style={{ marginBottom: '20px' }}>Desafiar o Robô de Dominó</h2>
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

  const myHand = playerColor ? game.hands[playerColor] : [];
  const opponentColor = playerColor === 'w' ? 'b' : 'w';
  const opponentHandCount = game.hands[opponentColor] ? game.hands[opponentColor].length : 0;
  
  const canPass = game.turn === playerColor && !game.canPlay(playerColor) && game.boneyard.length === 0;
  const canDraw = game.turn === playerColor && !game.canPlay(playerColor) && game.boneyard.length > 0;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-color)', color: 'var(--text-main)', paddingBottom: '100px' }}>
      
      {toastMsg && (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', background: 'var(--accent-color)', color: 'white', padding: '12px 24px', borderRadius: '8px', zIndex: 9999 }}>
          {toastMsg}
        </div>
      )}

      {/* Header */}
      <header style={{ padding: '15px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--glass-border)', position: 'sticky', top: 0, zIndex: 100 }}>
        <button onClick={() => navigate('/')} className="btn" style={{ padding: '8px 12px', background: 'transparent', border: '1px solid var(--glass-border)' }}>
          <ArrowLeft size={18} /> Voltar
        </button>
        <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--accent-color)' }}>Dominó vs Robô</div>
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
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px', gap: '16px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        
        {/* Opponent Area */}
        <div className="glass-panel" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🤖</div>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                 <span style={{ fontWeight: 'bold' }}>Robô Nível {difficulty}</span>
                 <span style={{ fontSize: '0.8rem', color: game.turn === opponentColor ? 'var(--accent-color)' : 'var(--text-muted)' }}>
                    {game.turn === opponentColor ? 'Pensando...' : 'Aguardando'}
                 </span>
              </div>
              {isThinking && <RefreshCw size={18} color="var(--accent-color)" className="spin" />}
           </div>
           <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', padding: '5px 0' }}>
              {Array.from({ length: opponentHandCount }).map((_, i) => (
                <DominoTile key={i} tile={[0,0]} hidden={true} size={30} />
              ))}
           </div>
        </div>

        {/* Board Area */}
        <div className="glass-panel" style={{ padding: '20px', flex: 1, minHeight: '250px', display: 'flex', flexDirection: 'column', background: '#0f172a', width: '100%' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                 <Info size={16} /> Mesa
              </span>
              <div style={{ display: 'flex', gap: '10px' }}>
                 <button 
                    onClick={handleDrawTile}
                    disabled={!canDraw}
                    className="btn" 
                    style={{ background: canDraw ? 'var(--accent-color)' : 'rgba(255,255,255,0.1)', opacity: canDraw ? 1 : 0.5, padding: '5px 10px', fontSize: '0.85rem' }}
                 >
                    Monte ({game.boneyard.length})
                 </button>
                 <button 
                    onClick={handlePassTurn}
                    disabled={!canPass}
                    className="btn" 
                    style={{ background: canPass ? 'var(--danger-color)' : 'rgba(255,255,255,0.1)', opacity: canPass ? 1 : 0.5, padding: '5px 10px', fontSize: '0.85rem' }}
                 >
                    Passar a Vez
                 </button>
              </div>
           </div>
           
           <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', justifyContent: 'center', alignItems: 'center', flex: 1, padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
              {game.board.length === 0 ? (
                 <div style={{ color: 'rgba(255,255,255,0.3)' }}>Nenhuma peça na mesa</div>
              ) : (
                 game.board.map((bTile, i) => {
                    const isDouble = bTile.left === bTile.right;
                    return (
                       <DominoTile 
                          key={i} 
                          tile={[bTile.left, bTile.right]} 
                          orientation={isDouble ? 'vertical' : 'horizontal'}
                          size={35}
                          style={{ margin: isDouble ? '0 2px' : '0' }}
                       />
                    );
                 })
              )}
           </div>

           {selectedTileIndex !== null && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '15px' }}>
                 <div style={{ color: 'var(--accent-color)', fontWeight: 'bold' }}>Jogar na:</div>
                 <button className="btn" style={{ padding: '5px 15px', background: 'var(--bg-color-lighter)' }} onClick={() => handlePlayTile(selectedTileIndex, 'left')}>Esquerda</button>
                 <button className="btn" style={{ padding: '5px 15px', background: 'var(--bg-color-lighter)' }} onClick={() => handlePlayTile(selectedTileIndex, 'right')}>Direita</button>
                 <button className="btn" style={{ padding: '5px 15px', background: 'transparent' }} onClick={() => setSelectedTileIndex(null)}>Cancelar</button>
              </div>
           )}
        </div>

        {/* Player Area */}
        <div className="glass-panel" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', border: game.turn === playerColor && !gameOver ? '1px solid var(--success-color)' : '1px solid var(--glass-border)', width: '100%' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--success-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
                {user?.displayName?.charAt(0)?.toUpperCase() || 'V'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div style={{ fontWeight: 'bold' }}>{user?.displayName || 'Você'}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--success-color)' }}>
                  {game.turn === playerColor && !gameOver ? 'Sua vez de jogar!' : ''}
                </div>
              </div>
           </div>
           
           <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', padding: '10px 5px', minHeight: '130px' }}>
              {myHand.map((tile, i) => {
                 const validMoves = game.turn === playerColor && !gameOver ? game.getValidMoves(playerColor) : [];
                 const isValid = validMoves.some(m => m.tile[0] === tile[0] && m.tile[1] === tile[1]);
                 
                 return (
                    <DominoTile 
                      key={i} 
                      tile={tile} 
                      size={40}
                      onClick={() => onTileClick(i)}
                      selected={selectedTileIndex === i}
                      highlight={game.turn === playerColor && isValid && selectedTileIndex === null}
                      style={{ flexShrink: 0 }}
                    />
                 );
              })}
           </div>
        </div>

        {/* History */}
        <div className="move-history-container" style={{ width: '100%', marginTop: '0', marginBottom: '20px', borderRadius: '8px', maxHeight: '150px' }}>
           {game.history.length === 0 && <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>A partida ainda não começou.</div>}
           {game.history.map((h, index) => (
             <div key={index} style={{ padding: '5px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
               <span style={{ color: h.player === 'w' ? 'white' : '#94a3b8', fontWeight: 'bold' }}>{h.player === playerColor ? 'Você' : 'Robô'}: </span>
               {h.action === 'play' && <span>Jogou {h.notation}</span>}
               {h.action === 'draw' && <span>Comprou do monte</span>}
               {h.action === 'pass' && <span>Passou a vez</span>}
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
              ) : winner === 'draw' ? (
                <>
                  <Handshake size={64} color="var(--text-muted)" style={{ margin: '0 auto 20px' }} />
                  <h2 style={{ color: 'white', marginBottom: '10px', fontSize: '1.8rem' }}>Jogo Trancado!</h2>
                </>
              ) : (
                <>
                  <Skull size={64} color="var(--danger-color)" style={{ margin: '0 auto 20px' }} />
                  <h2 style={{ color: 'var(--danger-color)', marginBottom: '10px', fontSize: '1.8rem' }}>O Robô Venceu!</h2>
                </>
              )}
              <p style={{ marginBottom: '20px', color: 'var(--text-muted)' }}>
                Fim de jogo. {winner === playerColor ? 'Parabéns!' : winner === 'draw' ? 'Empate por pontos menores.' : 'Tente novamente!'}
              </p>
              
              <div style={{ display: 'flex', gap: '15px' }}>
                <button onClick={resetGame} className="btn" style={{ flex: 1, padding: '12px', background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Jogar Novamente
               </button>
                <button onClick={() => navigate('/')} className="btn" style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Sair
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
