import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from './firebase';
import { doc, getDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { DominoesGame } from './utils/dominoesLogic';
import DominoTile from './components/DominoTile';
import { ArrowLeft, Flag, Handshake, X, Trophy, Copy, Check, Info } from 'lucide-react';
import { playSound } from './utils/sounds';
import LiveChat from './components/LiveChat';

export default function GameDominoes({ user }) {
  const { gameId: id } = useParams();
  const navigate = useNavigate();
  
  const [game, setGame] = useState(new DominoesGame());
  const [gameData, setGameData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [selectedTileIndex, setSelectedTileIndex] = useState(null);

  const historyLengthRef = useRef(0);
  const historyEndRef = useRef(null);

  useEffect(() => {
    playSound('gameStart');
  }, []);

  useEffect(() => {
    if (historyEndRef.current) {
      historyEndRef.current.scrollTop = historyEndRef.current.scrollHeight;
    }
  }, [game.history.length]);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  useEffect(() => {
    if (!user || !id) return;
    const gameRef = doc(db, 'games', id);
    let isSubscribed = true;

    const setupGame = async () => {
      try {
        const snap = await getDoc(gameRef);
        if (snap.exists()) {
          const data = snap.data();
          if (data.status === 'waiting' && data.players.white !== user.uid && !data.players.black) {
             await updateDoc(gameRef, {
                'players.black': user.uid,
                'players.blackName': user.displayName || user.email.split('@')[0],
                status: 'playing',
                updatedAt: serverTimestamp(),
                participantIds: [data.players.white, user.uid]
             });
          }
        }
      } catch (e) { console.error("Error setting up game:", e); }
    };
    setupGame();

    const unsub = onSnapshot(gameRef, (docSnap) => {
      if (docSnap.exists() && isSubscribed) {
        const data = docSnap.data();
        setGameData(data);
        
        let stateObj = data.dominoesState;
        if (typeof stateObj === 'string') {
          try { stateObj = JSON.parse(stateObj); } catch(e) {}
        }

        const currentHistoryLength = stateObj?.history ? stateObj.history.length : 0;
        if (currentHistoryLength > historyLengthRef.current && historyLengthRef.current > 0) {
           playSound('move');
        }
        historyLengthRef.current = currentHistoryLength;

        if (stateObj) {
          const newGame = new DominoesGame();
          newGame.load(stateObj);
          setGame(newGame);
        } else {
          setGame(new DominoesGame());
        }
        
        setLoading(false);
      }
    });

    return () => {
      isSubscribed = false;
      unsub();
    };
  }, [id, user]);

  const isWhite = gameData?.players?.white === user.uid;
  const isBlack = gameData?.players?.black === user.uid;
  const isSpectator = !isWhite && !isBlack;
  const playerColor = isWhite ? 'w' : isBlack ? 'b' : null;
  const opponentColor = playerColor === 'w' ? 'b' : 'w';

  const handleResign = async () => {
    if (window.confirm("Tem certeza que deseja desistir da partida?")) {
      await updateDoc(doc(db, 'games', id), {
        status: 'resigned',
        winnerColor: isWhite ? 'black' : 'white',
        winnerName: isWhite ? gameData.players.blackName : gameData.players.whiteName,
        updatedAt: serverTimestamp()
      });
    }
  };

  const handleDrawOffer = async () => {
    await updateDoc(doc(db, 'games', id), {
      status: 'draw_offer',
      drawOfferBy: user.uid,
      updatedAt: serverTimestamp()
    });
    showToast("Proposta de empate enviada!");
  };

  const handleAcceptDraw = async () => {
    await updateDoc(doc(db, 'games', id), {
      status: 'draw_accepted',
      updatedAt: serverTimestamp()
    });
  };

  const handleDeclineDraw = async () => {
    await updateDoc(doc(db, 'games', id), {
      status: 'playing',
      drawOfferBy: null,
      updatedAt: serverTimestamp()
    });
    showToast("Você recusou o empate.");
  };

  const syncGame = async (newGame) => {
    playSound('move');
    setGame(newGame);
    setSelectedTileIndex(null);
    
    let newStatus = gameData.status;
    if (newGame.isGameOver()) {
       newStatus = 'finished';
    }

    await updateDoc(doc(db, 'games', id), {
       dominoesState: JSON.stringify(newGame.getState()),
       status: newStatus,
       updatedAt: serverTimestamp()
    });
  };

  const handleDrawTile = () => {
    if (!gameData || gameData.status !== 'playing' || game.turn !== playerColor) return;
    const newGame = new DominoesGame();
    newGame.load(game.getState());
    if (newGame.drawTile(playerColor)) {
       syncGame(newGame);
    }
  };

  const handlePassTurn = () => {
    if (!gameData || gameData.status !== 'playing' || game.turn !== playerColor) return;
    const newGame = new DominoesGame();
    newGame.load(game.getState());
    if (newGame.passTurn(playerColor)) {
       syncGame(newGame);
    } else {
       showToast("Você ainda pode jogar ou comprar!");
    }
  };

  const handlePlayTile = (tileIndex, end) => {
    if (!gameData || gameData.status !== 'playing' || game.turn !== playerColor) return;
    const newGame = new DominoesGame();
    newGame.load(game.getState());
    if (newGame.playTile(playerColor, tileIndex, end)) {
       syncGame(newGame);
    } else {
       showToast("Movimento inválido.");
       setSelectedTileIndex(null);
    }
  };

  const onTileClick = (index) => {
    if (!gameData || gameData.status !== 'playing' || game.turn !== playerColor) return;
    
    const validMoves = game.getValidMoves(playerColor).filter(m => m.tile[0] === game.hands[playerColor][index][0] && m.tile[1] === game.hands[playerColor][index][1]);
    
    if (validMoves.length === 0) {
       showToast("Esta peça não encaixa na mesa.");
       return;
    }
    
    if (validMoves.length === 1) {
       // Only one place to play, do it directly
       handlePlayTile(index, validMoves[0].end);
    } else {
       // Can play on both ends, select it and show options
       setSelectedTileIndex(index === selectedTileIndex ? null : index);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  let isGameOverLocally = false;
  let gameOverReason = "";
  let gameOverWinner = ""; 
  
  if (game.isGameOver()) {
    isGameOverLocally = true;
    gameOverReason = game.winner === 'draw' ? "Jogo Trancado!" : "Fim de Jogo!";
    gameOverWinner = game.winner === 'w' ? 'white' : (game.winner === 'b' ? 'black' : 'draw');
  } else if (gameData?.status === 'resigned') {
    isGameOverLocally = true;
    gameOverReason = "Abandono";
    gameOverWinner = gameData.winnerColor;
  } else if (gameData?.status === 'draw_accepted') {
    isGameOverLocally = true;
    gameOverReason = "Empate por Acordo";
    gameOverWinner = 'draw';
  }

  if (loading) return <div className="loading-spinner" style={{display:'flex', height:'100vh', justifyContent:'center', alignItems:'center'}}>Carregando Partida...</div>;

  const opponentName = isWhite ? (gameData.players.blackName || 'Aguardando...') : gameData.players.whiteName;
  const myName = isWhite ? gameData.players.whiteName : (gameData.players.blackName || user.displayName);
  const myHand = playerColor ? game.hands[playerColor] : [];
  const opponentHandCount = opponentColor && game.hands[opponentColor] ? game.hands[opponentColor].length : 0;
  
  const canPass = game.turn === playerColor && !game.canPlay(playerColor) && game.boneyard.length === 0;
  const canDraw = game.turn === playerColor && !game.canPlay(playerColor) && game.boneyard.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', padding: '16px', maxWidth: '800px', margin: '0 auto', position: 'relative' }}>
      
      {isGameOverLocally && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }}>
          <div className="glass-panel" style={{ background: '#1e293b', maxWidth: '400px', width: '100%', textAlign: 'center', padding: '40px 20px', border: '1px solid var(--accent-color)' }}>
            <Trophy size={64} color={(gameOverWinner === 'white' && isWhite) || (gameOverWinner === 'black' && isBlack) ? "var(--success-color)" : (gameOverWinner === 'draw' ? "var(--text-muted)" : "var(--danger-color)")} style={{ marginBottom: '20px' }} />
            <h2 style={{ fontSize: '1.8rem', marginBottom: '10px' }}>{gameOverReason}</h2>
            <p style={{ marginBottom: '20px', color: 'var(--text-muted)' }}>
              {gameOverWinner === 'draw' ? 'Empate' : (gameOverWinner === 'white' ? 'As Brancas Venceram' : 'As Pretas Venceram')}
            </p>
            <button onClick={() => navigate('/')} style={{ width: '100%', padding: '12px', background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
               Voltar ao Menu Principal
            </button>
          </div>
        </div>
      )}

      {toastMsg && (
        <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', background: 'var(--accent-color)', color: 'white', padding: '12px 24px', borderRadius: '8px', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '15px' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 'bold', flex: 1, textAlign: 'left' }}>{toastMsg}</span>
          <button onClick={() => setToastMsg('')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={20} /></button>
        </div>
      )}

      <header style={{ padding: '0 0 15px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={() => navigate('/')} className="btn" style={{ padding: '8px 12px', background: 'transparent', border: '1px solid var(--glass-border)' }}>
          <ArrowLeft size={18} /> Voltar
        </button>
        <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--accent-color)' }}>DOMINÓ</div>
      </header>

      {gameData.status === 'waiting' && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <div onClick={copyCode} className="glass-panel" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', borderRadius: '20px' }}>
            <span style={{ fontWeight: 'bold', letterSpacing: '2px', color: 'var(--accent-color)' }}>{id}</span>
            {copied ? <Check size={16} color="var(--success-color)" /> : <Copy size={16} />}
          </div>
        </div>
      )}

      {/* Opponent Area */}
      <div className="glass-panel" style={{ padding: '12px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
           <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-color-lighter)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
             {opponentName?.charAt(0)?.toUpperCase() || '?'}
           </div>
           <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
             <div style={{ fontWeight: 'bold' }}>{opponentName}</div>
             <div style={{ fontSize: '0.8rem', color: gameData.status === 'waiting' ? 'var(--accent-color)' : 'var(--text-muted)' }}>
               {gameData.status === 'waiting' ? 'Esperando...' : (game.turn === opponentColor ? 'Pensando...' : 'Aguardando')}
             </div>
           </div>
        </div>
        <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', padding: '5px 0' }}>
           {Array.from({ length: opponentHandCount }).map((_, i) => (
             <DominoTile key={i} tile={[0,0]} hidden={true} size={30} />
           ))}
        </div>
      </div>

      {/* Board Area */}
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '16px', flex: 1, minHeight: '250px', display: 'flex', flexDirection: 'column', background: '#0f172a' }}>
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
      <div className="glass-panel" style={{ padding: '12px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '10px', border: game.turn === playerColor && gameData.status === 'playing' ? '1px solid var(--success-color)' : '1px solid var(--glass-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
           <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--success-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
             {myName?.charAt(0)?.toUpperCase() || 'V'}
           </div>
           <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
             <div style={{ fontWeight: 'bold' }}>{myName} (Você)</div>
             <div style={{ fontSize: '0.8rem', color: 'var(--success-color)' }}>
               {gameData.status === 'playing' && game.turn === playerColor ? 'Sua vez de jogar!' : ''}
             </div>
           </div>
        </div>
        
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', padding: '10px 5px', minHeight: '130px' }}>
           {myHand.map((tile, i) => {
              const validMoves = game.turn === playerColor && game.status !== 'finished' ? game.getValidMoves(playerColor) : [];
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

      {!isSpectator && gameData.status === 'playing' && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
           <button className="btn" onClick={handleResign} style={{ flex: 1, background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', border: '1px solid #ef4444', justifyContent: 'center' }}>
              <Flag size={18} /> Desistir
           </button>
           <button className="btn" onClick={handleDrawOffer} style={{ flex: 1, background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255,255,255,0.2)', justifyContent: 'center' }}>
              <Handshake size={18} /> Empate
           </button>
        </div>
      )}

      {/* History */}
      <div className="move-history-container" ref={historyEndRef} style={{ marginTop: '0', marginBottom: '20px', borderRadius: '8px', maxHeight: '150px' }}>
         {game.history.length === 0 && <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>A partida ainda não começou.</div>}
         {game.history.map((h, index) => (
           <div key={index} style={{ padding: '5px 10px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.9rem' }}>
             <span style={{ color: h.player === 'w' ? 'white' : '#94a3b8', fontWeight: 'bold' }}>{h.player === 'w' ? gameData?.players?.whiteName : gameData?.players?.blackName}: </span>
             {h.action === 'play' && <span>Jogou {h.notation}</span>}
             {h.action === 'draw' && <span>Comprou do monte</span>}
             {h.action === 'pass' && <span>Passou a vez</span>}
           </div>
         ))}
      </div>

      <div style={{ marginBottom: '40px' }}>
         <LiveChat gameId={id} user={user} gameData={gameData} myName={myName} />
      </div>

    </div>
  );
}
