import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from './firebase';
import { doc, onSnapshot, updateDoc, collection, addDoc, serverTimestamp, arrayUnion, getDoc, runTransaction } from 'firebase/firestore';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { useBoardTheme } from './hooks/useBoardTheme';
import { ArrowLeft, Copy, Check, X, Flag, Handshake, Trophy, RefreshCw } from 'lucide-react';
import { initSounds, playSound } from './utils/sounds';
import { calculateMaterialAdvantage } from './utils/chessLogic';
import { calculateElo } from './utils/eloLogic';
import CapturedPieces from './components/CapturedPieces';
import ChessClock from './components/ChessClock';
import LiveChat from './components/LiveChat';

export default function Game({ user }) {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(new Chess());
  const [gameData, setGameData] = useState(null);
  const [playerColor, setPlayerColor] = useState(null); // 'white', 'black', or null (spectator)
  const [optionSquares, setOptionSquares] = useState({});
  const { themeStyles } = useBoardTheme();
  const [copied, setCopied] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [moveFrom, setMoveFrom] = useState(null);
  const [showOptions, setShowOptions] = useState(true);
  const [moveToPromote, setMoveToPromote] = useState(null);
  const [premove, setPremove] = useState(null);
  const [analysisMode, setAnalysisMode] = useState(false);
  const [analysisIndex, setAnalysisIndex] = useState(0);
  const historyLengthRef = useRef(0);
  const historyEndRef = useRef(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    initSounds();
    playSound('gameStart');
  }, []);

  useEffect(() => {
    if (historyEndRef.current) {
      historyEndRef.current.scrollTop = historyEndRef.current.scrollHeight;
    }
  }, [game.history().length]);

  const showToast = (msg) => {
    setToastMsg(msg);
  };

  const handleResign = async () => {
    if (window.confirm("Tem certeza que deseja desistir da partida?")) {
      const gameRef = doc(db, 'games', gameId);
      await updateDoc(gameRef, {
        status: 'resigned',
        winnerColor: playerColor === 'white' ? 'black' : 'white',
        winnerName: playerColor === 'white' ? gameData.players.blackName : gameData.players.whiteName,
        updatedAt: serverTimestamp()
      });
    }
  };

  const handleDrawOffer = async () => {
    const gameRef = doc(db, 'games', gameId);
    await updateDoc(gameRef, {
      status: 'draw_offer',
      drawOfferBy: user.uid,
      updatedAt: serverTimestamp()
    });
    showToast("Proposta de empate enviada!");
  };

  const handleAcceptDraw = async () => {
    const gameRef = doc(db, 'games', gameId);
    await updateDoc(gameRef, {
      status: 'draw_accepted',
      updatedAt: serverTimestamp()
    });
  };

  const handleDeclineDraw = async () => {
    const gameRef = doc(db, 'games', gameId);
    await updateDoc(gameRef, {
      status: 'playing',
      drawOfferBy: null,
      updatedAt: serverTimestamp()
    });
    showToast("Você recusou o empate.");
  };

  const handleTimeUp = useCallback(async (color) => {
    if (gameData?.status !== 'playing') return;
    if (playerColor !== 'spectator') {
      const gameRef = doc(db, 'games', gameId);
      await updateDoc(gameRef, {
        status: 'timeout',
        winnerColor: color === 'white' ? 'black' : 'white',
        winnerName: color === 'white' ? gameData.players.blackName : gameData.players.whiteName,
        updatedAt: serverTimestamp()
      });
    }
  }, [gameData, gameId, playerColor]);

  useEffect(() => {
    const gameRef = doc(db, 'games', gameId);

    const unsubscribe = onSnapshot(gameRef, async (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setGameData(data);

        // Update local chess instance
        const newGame = new Chess();
        if (data.pgn) {
           try { newGame.loadPgn(data.pgn); } catch(e) { console.error(e) }
        } else if (data.fen && data.fen !== 'start') {
           try { newGame.load(data.fen); } catch(e) { console.error("Invalid FEN", e) }
        }
        setGame(newGame);

        // Som de movimento remoto (se oponente jogou)
        const currentHistoryLength = data.history ? data.history.length : 0;
        if (currentHistoryLength > historyLengthRef.current && historyLengthRef.current > 0) {
           const lastMove = data.history[currentHistoryLength - 1];
           if (lastMove) {
             if (lastMove.includes('+') || lastMove.includes('#')) {
               playSound('check');
             } else if (lastMove.includes('x')) {
               playSound('capture');
             } else {
               playSound('move');
             }
           }
        }
        historyLengthRef.current = currentHistoryLength;

        // Join as Black if spot is empty and user is not White
        if (data.players.white !== user.uid && !data.players.black) {
          let blackElo = 1200;
          try {
             const userSnap = await getDoc(doc(db, 'users', user.uid));
             if (userSnap.exists()) blackElo = userSnap.data().elo || 1200;
          } catch(e) { console.error("Erro get elo", e); }

          await updateDoc(gameRef, {
            'players.black': user.uid,
            'players.blackName': user.displayName || 'Jogador 2',
            'players.blackElo': blackElo,
            status: 'playing',
            participantIds: arrayUnion(user.uid),
            updatedAt: serverTimestamp()
          });
        }

        // Determine player color
        if (data.players.white === user.uid) setPlayerColor('white');
        else if (data.players.black === user.uid) setPlayerColor('black');
        else setPlayerColor('spectator');

      } else {
        alert("Partida não encontrada!");
        navigate('/lobby');
      }
    });

    return () => unsubscribe();
  }, [gameId, user, navigate]);

  // Determinar status de fim de jogo
  let isGameOverLocally = false;
  let gameOverReason = "";
  let gameOverWinner = ""; 
  
  if (game.isCheckmate()) {
    isGameOverLocally = true;
    gameOverReason = "Xeque-Mate!";
    gameOverWinner = game.turn() === 'w' ? 'black' : 'white';
  } else if (game.isDraw() || game.isStalemate() || game.isThreefoldRepetition() || game.isInsufficientMaterial()) {
    isGameOverLocally = true;
    gameOverReason = "Empate!";
    gameOverWinner = 'draw';
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

  // Atualizar Elo no Firestore ao fim da partida
  useEffect(() => {
    if (isGameOverLocally && gameData && !gameData.eloUpdated && playerColor === 'white') {
      const updateRankings = async () => {
         try {
            const gameRef = doc(db, 'games', gameId);
            const whiteRef = doc(db, 'users', gameData.players.white);
            const blackRef = doc(db, 'users', gameData.players.black);

            await runTransaction(db, async (transaction) => {
               const gameDoc = await transaction.get(gameRef);
               if (gameDoc.data().eloUpdated) return;

               const whiteDoc = await transaction.get(whiteRef);
               const blackDoc = await transaction.get(blackRef);

               const wElo = whiteDoc.exists() ? (whiteDoc.data().elo || 1200) : 1200;
               const bElo = blackDoc.exists() ? (blackDoc.data().elo || 1200) : 1200;

               let wResult = 'draw';
               let bResult = 'draw';

               if (gameOverWinner === 'white') {
                  wResult = 'win'; bResult = 'loss';
               } else if (gameOverWinner === 'black') {
                  wResult = 'loss'; bResult = 'win';
               }

               const newWElo = calculateElo(wElo, bElo, wResult);
               const newBElo = calculateElo(bElo, wElo, bResult);

               transaction.update(whiteRef, { elo: newWElo });
               transaction.update(blackRef, { elo: newBElo });
               transaction.update(gameRef, { eloUpdated: true });
            });
         } catch(e) { console.error("Erro ao atualizar Elo", e); }
      };
      updateRankings();
    }
  }, [isGameOverLocally, gameData, playerColor, gameId, gameOverWinner]);

  function getMoveOptions(square) {
    if (!showOptions) {
      setOptionSquares({});
      return;
    }
    const moves = game.moves({
      square,
      verbose: true
    });
    
    if (moves.length === 0) {
      setOptionSquares({});
      return;
    }

    const newSquares = {};
    moves.map((move) => {
      newSquares[move.to] = {
        background:
          game.get(move.to) && game.get(move.to).color !== game.get(square).color
            ? 'radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)'
            : 'radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)',
        borderRadius: '50%'
      };
      return move;
    });
    newSquares[square] = {
      background: 'rgba(255, 255, 0, 0.4)'
    };
    setOptionSquares(newSquares);
  }

  function onSquareClick(square) {
    if (analysisMode) return;
    if (premove) setPremove(null);
    if (game.turn() !== (playerColor === 'white' ? 'w' : 'b')) return;
    
    if (moveFrom === null) {
      const pieceObj = game.get(square);
      if (pieceObj && pieceObj.color === (playerColor === 'white' ? 'w' : 'b')) {
        setMoveFrom(square);
        getMoveOptions(square);
      }
      return;
    }

    const success = onDrop(moveFrom, square);
    if (!success) {
      const pieceObj = game.get(square);
      if (pieceObj && pieceObj.color === (playerColor === 'white' ? 'w' : 'b')) {
        setMoveFrom(square);
        getMoveOptions(square);
      } else {
        setMoveFrom(null);
        setOptionSquares({});
      }
    } else {
      setMoveFrom(null);
    }
  }

  function onPieceDragBegin(piece, sourceSquare) {
    if (analysisMode) return;
    if (premove) setPremove(null);
    if (game.turn() !== (playerColor === 'white' ? 'w' : 'b')) return;
    setMoveFrom(sourceSquare);
    getMoveOptions(sourceSquare);
  }

  const executeMove = async (sourceSquare, targetSquare, promotion = 'q') => {
      setOptionSquares({});
      const gameCopy = new Chess();
      gameCopy.loadPgn(game.pgn());
      
      const handleInvalidMove = () => {
         const piece = gameCopy.get(sourceSquare);
         let msg = "Lance inválido!";
         if (piece) {
            addDoc(collection(db, 'mistakes'), {
               userId: user.uid,
               piece: piece.type,
               details: msg,
               timestamp: serverTimestamp()
            }).catch(err => {
               console.error("Erro ao gravar erro", err);
            });
         }
         showToast(msg);
         return false;
      };

      try {
        const move = gameCopy.move({
          from: sourceSquare,
          to: targetSquare,
          promotion: promotion,
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

        let updateData = {
          fen: gameCopy.fen(),
          pgn: gameCopy.pgn(),
          history: [...(gameData.history || []), move.san],
          updatedAt: serverTimestamp(),
          lastMoveAt: serverTimestamp()
        };

        if (gameData.timeControl > 0 && gameData.lastMoveAt) {
          const turn = game.turn() === 'w' ? 'black' : 'white'; // O turno anterior foi quem jogou
          const elapsed = Date.now() - gameData.lastMoveAt.toMillis();
          if (turn === 'white') {
            updateData.whiteTime = Math.max(0, gameData.whiteTime - elapsed);
          } else {
            updateData.blackTime = Math.max(0, gameData.blackTime - elapsed);
          }
        }

        const gameRef = doc(db, 'games', gameId);
        await updateDoc(gameRef, updateData);

        return true;
      } catch (error) {
        return handleInvalidMove();
      }
  };

  const onDrop = useCallback(
    async (sourceSquare, targetSquare) => {
      if (analysisMode) return false;
      if (playerColor === 'spectator') {
        showToast("Você é apenas um espectador nesta partida.");
        return false;
      }
      if (gameData?.status !== 'playing') {
        showToast("Aguarde o oponente entrar na sala antes de mover!");
        return false;
      }
      
      const turn = game.turn() === 'w' ? 'white' : 'black';
      if (turn !== playerColor) {
        // Lógica de Premove
        const pieceObj = game.get(sourceSquare);
        if (pieceObj && pieceObj.color === (playerColor === 'white' ? 'w' : 'b')) {
           setPremove({ from: sourceSquare, to: targetSquare });
        } else {
           showToast("Não é a sua vez! Aguarde o oponente jogar.");
        }
        return false;
      }

      // Check if this move is a pawn promotion
      const piece = game.get(sourceSquare);
      const isPromotion = piece?.type === 'p' && 
         ((piece.color === 'w' && sourceSquare[1] === '7' && targetSquare[1] === '8') || 
          (piece.color === 'b' && sourceSquare[1] === '2' && targetSquare[1] === '1'));

      if (isPromotion) {
         setMoveToPromote({ from: sourceSquare, to: targetSquare });
         return true; // We accept the drop for now, await promotion piece selection
      }

      return executeMove(sourceSquare, targetSquare);
    },
    [game, playerColor, gameId, gameData, user.uid]
  );

  const onPromotionPieceSelect = (piece) => {
     if (piece && moveToPromote) {
        const promotionChar = piece[1].toLowerCase();
        executeMove(moveToPromote.from, moveToPromote.to, promotionChar);
     }
     setMoveToPromote(null);
     return true;
  };

  // Efeito para executar o Premove quando for a nossa vez
  useEffect(() => {
    const turn = game.turn() === 'w' ? 'white' : 'black';
    if (turn === playerColor && premove && gameData?.status === 'playing') {
       const p = premove;
       setPremove(null); 
       
       const gameCopy = new Chess();
       gameCopy.loadPgn(game.pgn());
       
       const isPromotion = 
          gameCopy.get(p.from)?.type === 'p' && 
          ((playerColor === 'white' && p.to[1] === '8') || (playerColor === 'black' && p.to[1] === '1'));
       
       const move = gameCopy.move({ from: p.from, to: p.to, promotion: isPromotion ? 'q' : undefined });
       if (move) {
          setTimeout(() => {
             executeMove(p.from, p.to, isPromotion ? 'q' : undefined);
          }, 50); // delay suave
       }
    }
  }, [game.fen(), playerColor, premove, gameData?.status]);

  const copyCode = () => {
    navigator.clipboard.writeText(gameId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!gameData) return <div className="loading-spinner" style={{display:'flex', height:'100vh', justifyContent:'center', alignItems:'center'}}>Carregando...</div>;

  const opponentName = playerColor === 'white' 
    ? (gameData.players.blackName || 'Aguardando oponente...') 
    : gameData.players.whiteName;
  const opponentElo = playerColor === 'white' ? gameData.players.blackElo : gameData.players.whiteElo;
    
  const myName = playerColor === 'white' ? gameData.players.whiteName : (gameData.players.blackName || user.displayName);
  const myElo = playerColor === 'white' ? gameData.players.whiteElo : gameData.players.blackElo;

  const material = calculateMaterialAdvantage(game);
  
  // Determine who is playing which color
  const amIWhite = playerColor === 'white';
  const myCaptured = amIWhite ? material.capturedByWhite : material.capturedByBlack;
  const myAdvantage = amIWhite ? material.whiteAdvantage : material.blackAdvantage;
  const oppCaptured = amIWhite ? material.capturedByBlack : material.capturedByWhite;
  const oppAdvantage = amIWhite ? material.blackAdvantage : material.whiteAdvantage;

  const history = game.history();
  const movePairs = [];
  for (let i = 0; i < history.length; i += 2) {
    movePairs.push({
      white: history[i],
      black: history[i + 1] || ''
    });
  }

  const showGameOverModal = isGameOverLocally && !analysisMode;

  const analysisGame = new Chess();
  if (analysisMode) {
     for (let i = 0; i < analysisIndex; i++) {
        analysisGame.move(history[i]);
     }
  }
  const displayFen = analysisMode ? analysisGame.fen() : game.fen();

  const getExpirationWarning = () => {
    if (!gameData || gameData.timeControl > 0 || !gameData.createdAt || gameData.status !== 'playing') return null;
    const createdMs = typeof gameData.createdAt.toMillis === 'function' ? gameData.createdAt.toMillis() : Date.now();
    const daysPassed = Math.floor((Date.now() - createdMs) / (1000 * 60 * 60 * 24));
    const daysLeft = 30 - daysPassed;
    
    if (daysLeft < 0) {
       return <div style={{ background: 'var(--danger-color)', color: 'white', padding: '8px', borderRadius: '4px', textAlign: 'center', marginBottom: '16px', fontSize: '0.9rem', fontWeight: 'bold' }}>Sala expirada (prazo de 30 dias excedido).</div>;
    } else if (daysLeft <= 3) {
       return <div style={{ background: 'orange', color: 'white', padding: '8px', borderRadius: '4px', textAlign: 'center', marginBottom: '16px', fontSize: '0.9rem', fontWeight: 'bold' }}>Aviso: A sala expira em {daysLeft} dia(s).</div>;
    } else {
       return <div style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', padding: '6px', borderRadius: '4px', textAlign: 'center', marginBottom: '16px', fontSize: '0.8rem' }}>Partida Diária (Expira em {daysLeft} dias)</div>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', padding: '16px 16px 100px 16px', maxWidth: '600px', margin: '0 auto', position: 'relative' }}>
      
      {getExpirationWarning()}
      
      {/* Game Over Modal Premium */}
      {showGameOverModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }}>
          <div className="glass-panel" style={{ background: '#1e293b', maxWidth: '400px', width: '100%', textAlign: 'center', padding: '40px 20px', border: '1px solid var(--accent-color)' }}>
            <Trophy size={64} color={gameOverWinner === playerColor ? "var(--success-color)" : (gameOverWinner === 'draw' ? "var(--text-muted)" : "var(--danger-color)")} style={{ marginBottom: '20px' }} />
            <h2 style={{ fontSize: '1.8rem', marginBottom: '10px' }}>{gameOverReason}</h2>
            <p style={{ marginBottom: '20px', color: 'var(--text-muted)' }}>
              {gameOverReason}
            </p>

            <button onClick={() => { setAnalysisMode(true); setAnalysisIndex(history.length); }} style={{ width: '100%', padding: '12px', background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', marginBottom: '10px' }}>
              Analisar Partida
            </button>

            <button onClick={() => navigate('/lobby')} style={{ width: '100%', padding: '12px', background: 'transparent', color: 'var(--accent-color)', border: '1px solid var(--accent-color)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
               Voltar ao Menu Principal
            </button>
          </div>
        </div>
      )}

      {/* Proposta de Empate Recebida */}
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
        <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', background: 'var(--danger-color)', color: 'white', padding: '12px 24px', borderRadius: '8px', zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.5)', width: '90%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '15px' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 'bold', flex: 1, textAlign: 'left' }}>{toastMsg}</span>
          <button onClick={() => setToastMsg('')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={20} />
          </button>
        </div>
      )}

      {gameData.status === 'waiting' && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px', marginTop: '10px' }}>
          <div onClick={copyCode} className="glass-panel" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', borderRadius: '20px' }}>
            <span style={{ fontWeight: 'bold', letterSpacing: '2px', color: 'var(--accent-color)' }}>{gameId}</span>
            {copied ? <Check size={16} color="var(--success-color)" /> : <Copy size={16} />}
          </div>
        </div>
      )}

      <div className="glass-panel" style={{ padding: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
           <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-color-lighter)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
             O
           </div>
           <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
             <div style={{ fontWeight: 'bold', minHeight: '20px' }}>
                {opponentName} {opponentElo ? <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>({opponentElo})</span> : ''}
             </div>
             <div style={{ fontSize: '0.8rem', minHeight: '16px', color: gameData.status === 'waiting' ? 'var(--accent-color)' : 'var(--text-muted)' }}>
               {gameData.status === 'waiting' ? 'Esperando jogador...' : (game.turn() === (playerColor === 'white' ? 'b' : 'w') ? 'Pensando...' : '')}
             </div>
           </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
             {gameData.timeControl > 0 && (
               <ChessClock 
                  timeMs={!amIWhite ? gameData.whiteTime : gameData.blackTime}
                  active={gameData.status === 'playing' && game.turn() === (!amIWhite ? 'w' : 'b')}
                  lastMoveAt={gameData.lastMoveAt}
                  onTimeUp={() => handleTimeUp(!amIWhite ? 'white' : 'black')}
               />
             )}
             <div style={{ padding: '2px 8px', borderRadius: '4px', background: !amIWhite ? 'white' : 'rgba(255,255,255,0.1)', color: !amIWhite ? 'black' : 'white', fontWeight: 'bold', fontSize: '0.7rem' }}>
                {!amIWhite ? 'Brancas' : 'Pretas'}
             </div>
           </div>
           <CapturedPieces captured={oppCaptured} advantage={oppAdvantage} color={!amIWhite ? 'white' : 'black'} />
        </div>
      </div>

      <div style={{ width: '100%', aspectRatio: '1 / 1', marginBottom: '16px', boxShadow: 'var(--glass-shadow)', borderRadius: '4px', overflow: 'hidden' }}>
        <Chessboard 
          id="BasicBoard" 
          position={displayFen} 
          onPieceDrop={onDrop}
          boardOrientation={playerColor === 'black' ? 'black' : 'white'}
          onPieceDragBegin={onPieceDragBegin}
          onSquareClick={onSquareClick}
          promotionToSquare={moveToPromote ? moveToPromote.to : null}
          onPromotionPieceSelect={onPromotionPieceSelect}
          customSquareStyles={{
            ...(game.history({ verbose: true }).length > 0 ? {
              [game.history({ verbose: true })[game.history({ verbose: true }).length - 1].from]: { background: 'rgba(255, 255, 0, 0.4)' },
              [game.history({ verbose: true })[game.history({ verbose: true }).length - 1].to]: { background: 'rgba(255, 255, 0, 0.4)' }
            } : {}),
            ...optionSquares,
            ...(premove ? {
               [premove.from]: { background: 'rgba(239, 68, 68, 0.4)' },
               [premove.to]: { background: 'rgba(239, 68, 68, 0.4)' }
            } : {})
          }}
          {...themeStyles}
          animationDuration={300}
        />
      </div>

      {analysisMode && (
         <div className="glass-panel" style={{ display: 'flex', justifyContent: 'center', gap: '20px', padding: '10px', marginBottom: '16px' }}>
            <button onClick={() => setAnalysisIndex(0)} className="btn" style={{ padding: '8px' }}>{'<<'}</button>
            <button onClick={() => setAnalysisIndex(Math.max(0, analysisIndex - 1))} className="btn" style={{ padding: '8px' }}>{'<'}</button>
            <span style={{ display: 'flex', alignItems: 'center', fontWeight: 'bold' }}>Lance {analysisIndex} / {history.length}</span>
            <button onClick={() => setAnalysisIndex(Math.min(history.length, analysisIndex + 1))} className="btn" style={{ padding: '8px' }}>{'>'}</button>
            <button onClick={() => setAnalysisIndex(history.length)} className="btn" style={{ padding: '8px' }}>{'>>'}</button>
            <button onClick={() => setAnalysisMode(false)} className="btn" style={{ padding: '8px', background: 'var(--danger-color)' }}><X size={16}/></button>
         </div>
      )}

      <div className="glass-panel" style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
           <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
             V
           </div>
           <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
             <div style={{ fontWeight: 'bold', minHeight: '20px' }}>
                {myName} (Você) {myElo ? <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>({myElo})</span> : ''}
             </div>
             <div style={{ fontSize: '0.8rem', color: 'var(--success-color)', minHeight: '16px' }}>
               {gameData.status === 'playing' && game.turn() === (playerColor === 'white' ? 'w' : 'b') ? 'Sua vez de jogar!' : ''}
             </div>
           </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {gameData.timeControl > 0 && (
                <ChessClock 
                   timeMs={amIWhite ? gameData.whiteTime : gameData.blackTime}
                   active={gameData.status === 'playing' && game.turn() === (amIWhite ? 'w' : 'b')}
                   lastMoveAt={gameData.lastMoveAt}
                   onTimeUp={() => handleTimeUp(amIWhite ? 'white' : 'black')}
                />
              )}
              <div style={{ padding: '2px 8px', borderRadius: '4px', background: amIWhite ? 'white' : 'rgba(255,255,255,0.1)', color: amIWhite ? 'black' : 'white', fontWeight: 'bold', fontSize: '0.7rem' }}>
                 {amIWhite ? 'Brancas' : 'Pretas'}
              </div>
           </div>
           <CapturedPieces captured={myCaptured} advantage={myAdvantage} color={amIWhite ? 'white' : 'black'} />
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', width: '100%', justifyContent: 'flex-end', marginTop: '4px' }}>
           <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Dicas</span>
           <input type="checkbox" checked={showOptions} onChange={(e) => {
              setShowOptions(e.target.checked);
              if (!e.target.checked) setOptionSquares({});
           }} style={{ accentColor: 'var(--accent-color)' }} />
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

      {playerColor !== 'spectator' && gameData.status === 'playing' && (
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
         <LiveChat gameId={gameId} user={user} gameData={gameData} myName={myName} />
      </div>

    </div>
  );
}
