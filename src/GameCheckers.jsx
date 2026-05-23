import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from './firebase';
import { doc, getDoc, updateDoc, onSnapshot, serverTimestamp, runTransaction } from 'firebase/firestore';
import { CheckersGame } from './utils/checkersLogic';
import CheckersBoard from './components/CheckersBoard';
import { ArrowLeft, Share2, Copy, Flag, Handshake, X, Trophy, Check } from 'lucide-react';
import { useBoardTheme } from './hooks/useBoardTheme';
import { initSounds, playSound } from './utils/sounds';
import ChessClock from './components/ChessClock';
import LiveChat from './components/LiveChat';

export default function GameCheckers({ user }) {
  const { gameId: id } = useParams();
  const navigate = useNavigate();
  const { themeStyles } = useBoardTheme();
  
  const [game, setGame] = useState(new CheckersGame());
  const [gameData, setGameData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState('');
  const [copied, setCopied] = useState(false);
  
  const historyLengthRef = useRef(0);
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
      } catch (e) {
        console.error("Error setting up game:", e);
      }
    };

    setupGame();

    const unsub = onSnapshot(gameRef, (docSnap) => {
      if (docSnap.exists() && isSubscribed) {
        const data = docSnap.data();
        setGameData(data);
        
        let stateObj = data.checkersState;
        if (typeof stateObj === 'string') {
          try {
             stateObj = JSON.parse(stateObj);
          } catch(e) { console.error("Erro no parse", e); }
        }

        const currentHistoryLength = stateObj?.history ? stateObj.history.length : 0;
        if (currentHistoryLength > historyLengthRef.current && historyLengthRef.current > 0) {
           const lastMove = stateObj.history[currentHistoryLength - 1];
           if (lastMove) {
             if (lastMove.isJump) playSound('capture');
             else playSound('move');
           }
        }
        historyLengthRef.current = currentHistoryLength;

        if (stateObj) {
          const newGame = new CheckersGame();
          newGame.load(stateObj);
          setGame(newGame);
        } else {
          setGame(new CheckersGame());
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

  const handleTimeUp = useCallback(async (color) => {
    if (gameData?.status !== 'playing') return;
    if (!isSpectator) {
      const gameRef = doc(db, 'games', id);
      await updateDoc(gameRef, {
        status: 'timeout',
        winnerColor: color === 'white' ? 'black' : 'white',
        winnerName: color === 'white' ? gameData.players.blackName : gameData.players.whiteName,
        updatedAt: serverTimestamp()
      });
    }
  }, [gameData, id, isSpectator]);

  const handleResign = async () => {
    if (window.confirm("Tem certeza que deseja desistir da partida?")) {
      const gameRef = doc(db, 'games', id);
      await updateDoc(gameRef, {
        status: 'resigned',
        winnerColor: isWhite ? 'black' : 'white',
        winnerName: isWhite ? gameData.players.blackName : gameData.players.whiteName,
        updatedAt: serverTimestamp()
      });
    }
  };

  const handleDrawOffer = async () => {
    const gameRef = doc(db, 'games', id);
    await updateDoc(gameRef, {
      status: 'draw_offer',
      drawOfferBy: user.uid,
      updatedAt: serverTimestamp()
    });
    showToast("Proposta de empate enviada!");
  };

  const handleAcceptDraw = async () => {
    const gameRef = doc(db, 'games', id);
    await updateDoc(gameRef, {
      status: 'draw_accepted',
      updatedAt: serverTimestamp()
    });
  };

  const handleDeclineDraw = async () => {
    const gameRef = doc(db, 'games', id);
    await updateDoc(gameRef, {
      status: 'playing',
      drawOfferBy: null,
      updatedAt: serverTimestamp()
    });
    showToast("Você recusou o empate.");
  };

  const handleMove = async (fromR, fromC, toR, toC) => {
    if (!gameData || gameData.status !== 'playing') return;
    if (game.turn !== playerColor) return;

    const allMoves = game.getAllValidMoves();
    const moveInfo = allMoves.find(m => m.from.r === fromR && m.from.c === fromC && m.to.r === toR && m.to.c === toC);

    const newGame = Object.assign(new CheckersGame(), game);
    const success = newGame.move(fromR, fromC, toR, toC);

    if (success) {
      if (moveInfo && moveInfo.isJump) playSound('capture');
      else playSound('move');
      setGame(newGame);
      
      let newStatus = gameData.status;
      if (newGame.isGameOver()) {
         newStatus = 'finished';
      }

      let updateData = {
         checkersState: JSON.stringify(newGame.getState()),
         status: newStatus,
         updatedAt: serverTimestamp(),
         lastMoveAt: serverTimestamp()
      };

      if (gameData.timeControl > 0 && gameData.lastMoveAt) {
        const elapsed = Date.now() - gameData.lastMoveAt.toMillis();
        if (playerColor === 'w') {
          updateData.whiteTime = Math.max(0, gameData.whiteTime - elapsed);
        } else {
          updateData.blackTime = Math.max(0, gameData.blackTime - elapsed);
        }
      }

      await updateDoc(doc(db, 'games', id), updateData);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    showToast("Link copiado!");
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
    gameOverReason = "Fim de Jogo!";
    gameOverWinner = game.winner === 'w' ? 'white' : 'black';
  } else if (gameData?.status === 'resigned') {
    isGameOverLocally = true;
    gameOverReason = "Abandono";
    gameOverWinner = gameData.winnerColor;
  } else if (gameData?.status === 'timeout') {
    isGameOverLocally = true;
    gameOverReason = "Fim do Tempo!";
    gameOverWinner = gameData.winnerColor;
  } else if (gameData?.status === 'draw_accepted') {
    isGameOverLocally = true;
    gameOverReason = "Empate por Acordo";
    gameOverWinner = 'draw';
  }

  // Atualizar Torneio no Firestore ao fim da partida
  useEffect(() => {
    if (isGameOverLocally && gameData && gameData.tournamentId && !gameData.tournamentUpdated) {
       const updateTournament = async () => {
          try {
             const tournamentRef = doc(db, 'tournaments', gameData.tournamentId);
             const gameRef = doc(db, 'games', id);
             
             await runTransaction(db, async (transaction) => {
                const gameDoc = await transaction.get(gameRef);
                if (gameDoc.data().tournamentUpdated) return;

                const tDoc = await transaction.get(tournamentRef);
                if (!tDoc.exists()) return;

                let winnerUid = null;
                if (gameOverWinner === 'white') winnerUid = gameData.players.white;
                else if (gameOverWinner === 'black') winnerUid = gameData.players.black;
                else winnerUid = 'draw';

                const tData = tDoc.data();
                if (!tData.matches) return;
                
                const matchesByRound = {};
                let maxRound = 1;
                tData.matches.forEach(m => {
                   if (!matchesByRound[m.round]) matchesByRound[m.round] = [];
                   matchesByRound[m.round].push(m);
                   if (m.round > maxRound) maxRound = m.round;
                });
                
                const newRounds = [];
                for (let r = 1; r <= maxRound; r++) {
                   newRounds.push(matchesByRound[r] || []);
                }
                
                for (let rIndex = 0; rIndex < newRounds.length; rIndex++) {
                   const round = newRounds[rIndex];
                   for (let mIndex = 0; mIndex < round.length; mIndex++) {
                      if (round[mIndex].gameId === id) {
                         newRounds[rIndex][mIndex].status = 'finished';
                         newRounds[rIndex][mIndex].winner = winnerUid;
                         
                         if (tData.format === 'knockout' && rIndex + 1 < newRounds.length) {
                            const nextMatchIndex = Math.floor(mIndex / 2);
                            const isP1 = mIndex % 2 === 0;
                            const nextMatch = newRounds[rIndex + 1][nextMatchIndex];
                            
                            const winnerPlayerObj = winnerUid === gameData.players.white ? 
                               {uid: gameData.players.white, name: gameData.players.whiteName} : 
                               (winnerUid === gameData.players.black ? {uid: gameData.players.black, name: gameData.players.blackName} : {uid: 'draw', name: 'Empate'});
                               
                            if (isP1) {
                               nextMatch.p1 = winnerPlayerObj;
                            } else {
                               nextMatch.p2 = winnerPlayerObj;
                            }
                            
                            if (nextMatch.p1?.uid && nextMatch.p2?.uid && nextMatch.p1.uid !== 'draw' && nextMatch.p2.uid !== 'draw') {
                               nextMatch.status = 'ready';
                               const nextGameRef = doc(db, 'games', nextMatch.gameId);
                               transaction.update(nextGameRef, {
                                  'players.white': nextMatch.p1.uid,
                                  'players.whiteName': nextMatch.p1.name,
                                  'players.black': nextMatch.p2.uid,
                                  'players.blackName': nextMatch.p2.name,
                                  status: 'playing',
                                  participantIds: [nextMatch.p1.uid, nextMatch.p2.uid]
                               });
                            }
                         }
                      }
                   }
                }
                
                let isTournamentFinished = false;
                if (tData.format === 'knockout') {
                   const lastRound = newRounds[newRounds.length - 1];
                   if (lastRound[0] && lastRound[0].status === 'finished') {
                      isTournamentFinished = true;
                   }
                } else {
                   const allFinished = newRounds.flat().every(m => m.status === 'finished');
                   if (allFinished) isTournamentFinished = true;
                }

                transaction.update(tournamentRef, {
                   matches: newRounds.flat(),
                   status: isTournamentFinished ? 'finished' : tData.status
                });
                transaction.update(gameRef, { tournamentUpdated: true });
             });
          } catch(e) { console.error("Erro ao atualizar torneio", e); }
       };
       updateTournament();
    }
  }, [isGameOverLocally, gameData, isWhite, id, gameOverWinner]);

  if (loading) {
    return <div className="loading-spinner" style={{display:'flex', height:'100vh', justifyContent:'center', alignItems:'center'}}>Carregando Partida...</div>;
  }

  const validMoves = (!isSpectator && game.turn === playerColor) ? game.getAllValidMoves(playerColor) : [];
  
  const history = game.history || [];
  const lastMove = history.length > 0 ? history[history.length - 1] : null;
  
  const movePairs = [];
  for (let i = 0; i < history.length; i += 2) {
    movePairs.push({
      white: history[i].notation,
      black: history[i + 1] ? history[i+1].notation : ''
    });
  }

  const opponentName = isWhite ? (gameData.players.blackName || 'Aguardando oponente...') : gameData.players.whiteName;
  const myName = isWhite ? gameData.players.whiteName : (gameData.players.blackName || user.displayName);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', padding: '16px 16px 100px 16px', maxWidth: '600px', margin: '0 auto', position: 'relative' }}>
      
      {/* Game Over Modal */}
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

      {/* Draw Offer Modal */}
      {gameData.status === 'draw_offer' && gameData.drawOfferBy !== user.uid && (
        <div style={{ position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)', background: '#3b82f6', color: 'white', padding: '16px 24px', borderRadius: '12px', zIndex: 9999, boxShadow: '0 10px 25px rgba(0,0,0,0.5)', width: '90%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ fontSize: '1rem', fontWeight: 'bold', textAlign: 'center' }}>O oponente ofereceu um empate!</div>
          <div style={{ display: 'flex', gap: '10px' }}>
             <button className="btn" style={{ background: 'var(--success-color)', flex: 1 }} onClick={handleAcceptDraw}>Aceitar</button>
             <button className="btn" style={{ background: 'rgba(0,0,0,0.3)', flex: 1 }} onClick={handleDeclineDraw}>Recusar</button>
          </div>
        </div>
      )}

      {toastMsg && (
        <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', background: 'var(--accent-color)', color: 'white', padding: '12px 24px', borderRadius: '8px', zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.5)', width: '90%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '15px' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 'bold', flex: 1, textAlign: 'left' }}>{toastMsg}</span>
          <button onClick={() => setToastMsg('')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={20} />
          </button>
        </div>
      )}

      <header style={{ padding: '0 0 15px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
        <button onClick={() => navigate('/')} className="btn" style={{ padding: '8px 12px', background: 'transparent', border: '1px solid var(--glass-border)' }}>
          <ArrowLeft size={18} /> Voltar
        </button>
        <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--accent-color)' }}>
          DAMAS
        </div>
      </header>

      {gameData.status === 'waiting' && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <div onClick={copyCode} className="glass-panel" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', borderRadius: '20px' }}>
            <span style={{ fontWeight: 'bold', letterSpacing: '2px', color: 'var(--accent-color)' }}>{id}</span>
            {copied ? <Check size={16} color="var(--success-color)" /> : <Copy size={16} />}
          </div>
        </div>
      )}

      <div className="glass-panel" style={{ padding: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
           <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-color-lighter)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
             {opponentName?.charAt(0)?.toUpperCase() || '?'}
           </div>
           <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
             <div style={{ fontWeight: 'bold', minHeight: '20px' }}>
                {opponentName}
             </div>
             <div style={{ fontSize: '0.8rem', minHeight: '16px', color: gameData.status === 'waiting' ? 'var(--accent-color)' : 'var(--text-muted)' }}>
               {gameData.status === 'waiting' ? 'Esperando jogador...' : (game.turn === (isWhite ? 'b' : 'w') ? 'Pensando...' : '')}
             </div>
           </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
             {gameData.timeControl > 0 && (
               <ChessClock 
                  timeMs={!isWhite ? gameData.whiteTime : gameData.blackTime}
                  active={gameData.status === 'playing' && game.turn === (!isWhite ? 'w' : 'b')}
                  lastMoveAt={gameData.lastMoveAt}
                  onTimeUp={() => handleTimeUp(!isWhite ? 'white' : 'black')}
               />
             )}
             <div style={{ padding: '2px 8px', borderRadius: '4px', background: !isWhite ? 'white' : 'rgba(255,255,255,0.1)', color: !isWhite ? 'black' : 'white', fontWeight: 'bold', fontSize: '0.7rem' }}>
                {!isWhite ? 'Claras' : 'Escuras'}
             </div>
           </div>
        </div>
      </div>

      <div style={{ width: '100%', marginBottom: '16px', borderRadius: '4px', overflow: 'hidden' }}>
         <CheckersBoard 
           board={game.board}
           onMove={handleMove}
           playerColor={playerColor || 'w'}
           themeStyles={themeStyles}
           validMoves={validMoves}
           turn={game.turn}
           lastMove={lastMove}
           showOptions={!gameData?.tournamentId}
         />
      </div>

      <div className="glass-panel" style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
           <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
             {myName?.charAt(0)?.toUpperCase() || 'V'}
           </div>
           <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
             <div style={{ fontWeight: 'bold', minHeight: '20px' }}>
                {myName} (Você)
             </div>
             <div style={{ fontSize: '0.8rem', color: 'var(--success-color)', minHeight: '16px' }}>
               {gameData.status === 'playing' && game.turn === playerColor ? 'Sua vez de jogar!' : ''}
             </div>
           </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {gameData.timeControl > 0 && (
                <ChessClock 
                   timeMs={isWhite ? gameData.whiteTime : gameData.blackTime}
                   active={gameData.status === 'playing' && game.turn === (isWhite ? 'w' : 'b')}
                   lastMoveAt={gameData.lastMoveAt}
                   onTimeUp={() => handleTimeUp(isWhite ? 'white' : 'black')}
                />
              )}
              <div style={{ padding: '2px 8px', borderRadius: '4px', background: isWhite ? 'white' : 'rgba(255,255,255,0.1)', color: isWhite ? 'black' : 'white', fontWeight: 'bold', fontSize: '0.7rem' }}>
                 {isWhite ? 'Claras' : 'Escuras'}
              </div>
           </div>
        </div>
      </div>

      <div className="move-history-container" ref={historyEndRef} style={{ marginTop: '0', marginBottom: '20px', borderRadius: '8px', maxHeight: '150px' }}>
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

      {!isSpectator && gameData.status === 'playing' && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
           <button 
             className="btn" 
             onClick={handleResign}
             style={{ flex: 1, background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', border: '1px solid #ef4444', display: 'flex', justifyContent: 'center', gap: '8px' }}
           >
              <Flag size={18} /> Desistir
           </button>
           <button 
             className="btn" 
             onClick={handleDrawOffer}
             style={{ flex: 1, background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', justifyContent: 'center', gap: '8px' }}
           >
              <Handshake size={18} /> Oferecer Empate
           </button>
        </div>
      )}

      {/* Live Chat */}
      <div style={{ marginBottom: '40px' }}>
         <LiveChat gameId={id} user={user} gameData={gameData} myName={myName} />
      </div>

    </div>
  );
}
