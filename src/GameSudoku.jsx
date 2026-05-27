import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from './firebase';
import { doc, getDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { SudokuGame } from './utils/sudokuLogic';
import { ArrowLeft, Flag, Handshake, X, Trophy, Copy, Check, Grid } from 'lucide-react';
import { playSound } from './utils/sounds';
import LiveChat from './components/LiveChat';

export default function GameSudoku({ user }) {
  const { gameId: id } = useParams();
  const navigate = useNavigate();
  
  const [game, setGame] = useState(new SudokuGame());
  const [gameData, setGameData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null);
  const [conflicts, setConflicts] = useState([]);

  useEffect(() => {
    playSound('gameStart');
  }, []);

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
        
        let stateObj = data.sudokuState;
        if (typeof stateObj === 'string') {
          try { stateObj = JSON.parse(stateObj); } catch(e) {}
        }

        if (stateObj) {
          const newGame = new SudokuGame();
          newGame.load(stateObj);
          setGame(newGame);
          setConflicts(newGame.getConflicts());
        }
        
        setLoading(false);
      }
    });

    return () => {
      isSubscribed = false;
      unsub();
    };
  }, [id, user]);

  // Keypress listener
  useEffect(() => {
    const handleKeyDown = (e) => {
       if (game.isOver || !game || !selectedCell || gameData?.status !== 'playing') return;
       
       const { r, c } = selectedCell;
       
       if (e.key >= '1' && e.key <= '9') {
          handlePlayMove(r, c, parseInt(e.key));
       } else if (e.key === 'Backspace' || e.key === 'Delete') {
          handlePlayMove(r, c, 0);
       } else if (e.key === 'ArrowUp' && r > 0) setSelectedCell({r: r-1, c});
       else if (e.key === 'ArrowDown' && r < 8) setSelectedCell({r: r+1, c});
       else if (e.key === 'ArrowLeft' && c > 0) setSelectedCell({r, c: c-1});
       else if (e.key === 'ArrowRight' && c < 8) setSelectedCell({r, c: c+1});
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCell, game, gameData]);

  const isWhite = gameData?.players?.white === user.uid;
  const isBlack = gameData?.players?.black === user.uid;
  const isSpectator = !isWhite && !isBlack;
  const playerColor = isWhite ? 'w' : isBlack ? 'b' : null;

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

  const syncGame = async (newGame) => {
    playSound('move');
    setGame(newGame);
    
    let newStatus = gameData.status;
    if (newGame.isGameOver) {
       newStatus = 'finished';
    }

    await updateDoc(doc(db, 'games', id), {
       sudokuState: JSON.stringify(newGame.getState()),
       status: newStatus,
       updatedAt: serverTimestamp()
    });
  };

  const handlePlayMove = (r, c, val) => {
    if (!gameData || gameData.status !== 'playing' || isSpectator) return;
    if (game.initialBoard[r][c] !== 0) return;
    
    const newGame = new SudokuGame();
    newGame.load(game.getState());
    
    if (newGame.playMove(playerColor, r, c, val)) {
       syncGame(newGame);
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
  
  if (game.isOver) {
    isGameOverLocally = true;
    gameOverReason = "Puzzle Resolvido!";
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
        <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--accent-color)' }}>SUDOKU</div>
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
               {gameData.status === 'waiting' ? 'Esperando...' : 'Trabalhando no tabuleiro...'}
             </div>
           </div>
        </div>
      </div>

      {/* Board Area */}
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#0f172a' }}>
         <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(9, 1fr)', 
            width: '100%', 
            maxWidth: '400px', 
            aspectRatio: '1/1', 
            background: '#1e293b', 
            border: '2px solid var(--text-main)',
            borderRadius: '4px',
            overflow: 'hidden'
         }}>
            {game && game.board.map((row, r) => (
               row.map((val, c) => {
                  const isInitial = game.initialBoard[r][c] !== 0;
                  const isSelected = selectedCell?.r === r && selectedCell?.c === c;
                  const isConflict = conflicts.some(conf => conf[0] === r && conf[1] === c);
                  
                  const isSameNumber = !isSelected && val !== 0 && selectedCell && game.board[selectedCell.r][selectedCell.c] === val;
                  const inSameRegion = selectedCell && (selectedCell.r === r || selectedCell.c === c || (Math.floor(selectedCell.r/3) === Math.floor(r/3) && Math.floor(selectedCell.c/3) === Math.floor(c/3)));

                  let bg = 'transparent';
                  if (isSelected) bg = 'rgba(59, 130, 246, 0.5)';
                  else if (isSameNumber) bg = 'rgba(59, 130, 246, 0.3)';
                  else if (inSameRegion) bg = 'rgba(255, 255, 255, 0.05)';
                  
                  if (isConflict) bg = 'rgba(239, 68, 68, 0.3)';

                  const borderRight = c % 3 === 2 && c !== 8 ? '2px solid var(--text-main)' : '1px solid rgba(255,255,255,0.1)';
                  const borderBottom = r % 3 === 2 && r !== 8 ? '2px solid var(--text-main)' : '1px solid rgba(255,255,255,0.1)';

                  return (
                     <div 
                        key={`${r}-${c}`}
                        onClick={() => setSelectedCell({r, c})}
                        style={{
                           background: bg,
                           borderRight,
                           borderBottom,
                           display: 'flex',
                           alignItems: 'center',
                           justifyContent: 'center',
                           fontSize: '1.2rem',
                           fontWeight: isInitial ? 'bold' : 'normal',
                           color: isConflict ? 'var(--danger-color)' : (isInitial ? 'white' : 'var(--accent-glow)'),
                           cursor: 'pointer',
                           userSelect: 'none'
                        }}
                     >
                        {val !== 0 ? val : ''}
                     </div>
                  );
               })
            ))}
         </div>

         {/* Numpad */}
         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', width: '100%', maxWidth: '400px', marginTop: '15px' }}>
            {[1,2,3,4,5,6,7,8,9].map(num => (
               <button 
                  key={num}
                  className="btn"
                  style={{ padding: '12px 0', fontSize: '1.2rem', background: 'var(--bg-color-lighter)', border: '1px solid rgba(255,255,255,0.1)', justifyContent: 'center' }}
                  onClick={() => selectedCell && handlePlayMove(selectedCell.r, selectedCell.c, num)}
               >
                  {num}
               </button>
            ))}
            <button 
               className="btn"
               style={{ padding: '12px 0', fontSize: '1.2rem', background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger-color)', border: '1px solid var(--danger-color)', justifyContent: 'center' }}
               onClick={() => selectedCell && handlePlayMove(selectedCell.r, selectedCell.c, 0)}
            >
               <X size={20} />
            </button>
         </div>
      </div>

      {/* Player Area */}
      <div className="glass-panel" style={{ padding: '12px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '10px', border: '1px solid var(--success-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
           <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--success-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
             {myName?.charAt(0)?.toUpperCase() || 'V'}
           </div>
           <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
             <div style={{ fontWeight: 'bold' }}>{myName} (Você)</div>
           </div>
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

      <div style={{ marginBottom: '40px' }}>
         <LiveChat gameId={id} user={user} gameData={gameData} myName={myName} />
      </div>

    </div>
  );
}
