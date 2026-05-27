import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from './firebase';
import { doc, getDoc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { SudokuGame } from './utils/sudokuLogic';
import { ArrowLeft, Trophy, Clock, X, Grid, Brain, Plus } from 'lucide-react';
import { playSound } from './utils/sounds';

export default function GameSudokuSolo({ user }) {
  const navigate = useNavigate();
  
  const [game, setGame] = useState(null);
  const [difficulty, setDifficulty] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [selectedCell, setSelectedCell] = useState(null);
  const [conflicts, setConflicts] = useState([]);
  
  // Timer
  useEffect(() => {
    let interval;
    if (game && !gameOver && difficulty > 0) {
       interval = setInterval(() => {
          setTimeElapsed(prev => prev + 1);
       }, 1000);
    }
    return () => clearInterval(interval);
  }, [game, gameOver, difficulty]);

  // Keypress listener
  useEffect(() => {
    const handleKeyDown = (e) => {
       if (gameOver || !game || !selectedCell) return;
       
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
  }, [selectedCell, game, gameOver]);

  const startGame = (level) => {
     setDifficulty(level);
     const newGame = new SudokuGame(level);
     setGame(newGame);
     setTimeElapsed(0);
     setGameOver(false);
     setConflicts([]);
     setSelectedCell(null);
  };

  const handlePlayMove = (r, c, val) => {
     if (game.initialBoard[r][c] !== 0) return; // Cannot edit initial cells
     
     const newGame = new SudokuGame();
     newGame.load(game.getState());
     
     newGame.board[r][c] = val;
     
     // Recalculate conflicts
     const newConflicts = newGame.getConflicts();
     setConflicts(newConflicts);
     
     newGame.checkGameOver('w');
     
     playSound('move');
     setGame(newGame);
     
     if (newGame.isOver) {
        setGameOver(true);
        handleGameOverAsync();
     }
  };

  const handleGameOverAsync = async () => {
    let pointsChange = 15 * difficulty;
    let starsGained = difficulty * 2;
    
    // Penalize slightly based on time (optional)
    
    if (user) {
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
        
        await addDoc(collection(db, 'games'), {
          players: {
            white: user.uid,
            whiteName: user.displayName || user.email.split('@')[0],
            whiteElo: null,
            black: 'bot',
            blackName: `Sudoku Nível ${difficulty}`,
            blackElo: null
          },
          gameType: 'sudoku',
          status: 'finished', 
          history: game.history || [],
          timeControl: 0,
          timeElapsed,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          participantIds: [user.uid]
        });
      } catch (err) {
        console.error("Erro ao atualizar pontos/histórico:", err);
      }
    }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (difficulty === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', minHeight: '100vh', padding: '40px 20px 100px 20px' }}>
        <div className="glass-panel" style={{ textAlign: 'center', maxWidth: '400px', width: '100%' }}>
          <Brain size={48} color="var(--accent-color)" style={{ margin: '0 auto 20px' }} />
          <h2 style={{ marginBottom: '20px' }}>Desafio Sudoku Diário</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '30px' }}>Escolha a dificuldade e teste o seu raciocínio lógico contra o tempo!</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button className="btn" style={{ background: 'rgba(59, 130, 246, 0.8)' }} onClick={() => startGame(1)}>Nível 1 (Fácil)</button>
            <button className="btn" style={{ background: 'rgba(59, 130, 246, 0.9)' }} onClick={() => startGame(2)}>Nível 2 (Médio)</button>
            <button className="btn" style={{ background: 'rgba(59, 130, 246, 1)' }} onClick={() => startGame(3)}>Nível 3 (Difícil)</button>
            <button className="btn" style={{ background: 'rgba(139, 92, 246, 1)' }} onClick={() => startGame(4)}>Nível 4 (Expert)</button>
            <button className="btn" style={{ background: 'var(--danger-color)' }} onClick={() => startGame(5)}>Nível 5 (Mestre)</button>
          </div>
          
          <button onClick={() => navigate('/')} className="btn" style={{ width: '100%', marginTop: '20px', background: 'transparent', border: '1px solid var(--glass-border)', color: 'white' }}>
             <ArrowLeft size={18} style={{ marginRight: '8px' }} /> Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-color)', color: 'var(--text-main)', paddingBottom: '20px' }}>
      
      {/* Header */}
      <header style={{ padding: '15px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--glass-border)', position: 'sticky', top: 0, zIndex: 100 }}>
        <button onClick={() => navigate('/')} className="btn" style={{ padding: '8px 12px', background: 'transparent', border: '1px solid var(--glass-border)' }}>
          <ArrowLeft size={18} /> Voltar
        </button>
        <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
           <Grid size={20} /> Sudoku
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
           <Clock size={18} /> <span style={{ fontFamily: 'monospace', fontSize: '1.1rem' }}>{formatTime(timeElapsed)}</span>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px', gap: '20px', maxWidth: '600px', margin: '0 auto', width: '100%' }}>
        
        {/* Sudoku Board */}
        <div style={{ 
           display: 'grid', 
           gridTemplateColumns: 'repeat(9, 1fr)', 
           width: '100%', 
           maxWidth: '450px', 
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
                 
                 // Highlight same numbers
                 const isSameNumber = !isSelected && val !== 0 && selectedCell && game.board[selectedCell.r][selectedCell.c] === val;
                 
                 // Highlight row/col/box of selected
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', width: '100%', maxWidth: '450px', marginTop: '10px' }}>
           {[1,2,3,4,5,6,7,8,9].map(num => (
              <button 
                 key={num}
                 className="btn"
                 style={{ padding: '15px 0', fontSize: '1.2rem', background: 'var(--bg-color-lighter)', border: '1px solid rgba(255,255,255,0.1)', justifyContent: 'center' }}
                 onClick={() => selectedCell && handlePlayMove(selectedCell.r, selectedCell.c, num)}
              >
                 {num}
              </button>
           ))}
           <button 
              className="btn"
              style={{ padding: '15px 0', fontSize: '1.2rem', background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger-color)', border: '1px solid var(--danger-color)', justifyContent: 'center' }}
              onClick={() => selectedCell && handlePlayMove(selectedCell.r, selectedCell.c, 0)}
           >
              <X size={20} />
           </button>
        </div>

        {gameOver && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }}>
            <div className="glass-panel" style={{ background: '#1e293b', maxWidth: '400px', width: '100%', textAlign: 'center', padding: '40px 20px', border: '1px solid var(--success-color)', animation: 'fadeIn 0.5s ease' }}>
               <Trophy size={64} color="var(--success-color)" style={{ margin: '0 auto 20px' }} />
               <h2 style={{ color: 'var(--success-color)', marginBottom: '10px', fontSize: '1.8rem' }}>Puzzle Resolvido!</h2>
               <p style={{ marginBottom: '20px', color: 'var(--text-muted)' }}>
                  Excelente! Você completou o Sudoku nível {difficulty} em {formatTime(timeElapsed)}.
               </p>
               
               <div style={{ display: 'flex', gap: '15px' }}>
                  <button onClick={() => startGame(difficulty)} className="btn" style={{ flex: 1, padding: '12px', background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                     Jogar Novamente
                  </button>
                  <button onClick={() => navigate('/')} className="btn" style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                     Voltar
                  </button>
               </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
