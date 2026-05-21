import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from './firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { ArrowLeft, Copy, Check, X } from 'lucide-react';

export default function Game({ user }) {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(new Chess());
  const [gameData, setGameData] = useState(null);
  const [playerColor, setPlayerColor] = useState(null); // 'white', 'black', or null (spectator)
  const [copied, setCopied] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg) => {
    setToastMsg(msg);
  };

  useEffect(() => {
    const gameRef = doc(db, 'games', gameId);

    const unsubscribe = onSnapshot(gameRef, async (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setGameData(data);

        // Update local chess instance
        const newGame = new Chess();
        if (data.fen !== 'start') {
           try {
              newGame.load(data.fen);
           } catch(e) { console.error("Invalid FEN", e) }
        }
        setGame(newGame);

        // Join as Black if spot is empty and user is not White
        if (data.players.white !== user.uid && !data.players.black) {
          await updateDoc(gameRef, {
            'players.black': user.uid,
            'players.blackName': user.displayName || 'Jogador 2',
            status: 'playing'
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

  const onDrop = useCallback(
    async (sourceSquare, targetSquare) => {
      if (playerColor === 'spectator') {
        showToast("Você é apenas um espectador nesta partida.");
        return false;
      }
      if (gameData?.status !== 'playing') {
        showToast("Aguarde o oponente entrar na sala antes de mover!");
        return false;
      }
      
      // Check if it's player's turn
      const turn = game.turn() === 'w' ? 'white' : 'black';
      if (turn !== playerColor) {
        showToast("Não é a sua vez! Aguarde o oponente jogar.");
        return false;
      }

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
         }
         showToast(msg);
         return false; // illegal move
      };

      try {
        const move = gameCopy.move({
          from: sourceSquare,
          to: targetSquare,
          promotion: 'q', // always promote to queen for simplicity in mobile
        });

        if (move === null) {
           return handleInvalidMove();
        }

        setGame(gameCopy);

        // Update Firestore
        const gameRef = doc(db, 'games', gameId);
        await updateDoc(gameRef, {
          fen: gameCopy.fen(),
          history: [...(gameData.history || []), move.san]
        });

        return true;
      } catch (error) {
        return handleInvalidMove();
      }
    },
    [game, playerColor, gameId, gameData]
  );

  const copyCode = () => {
    navigator.clipboard.writeText(gameId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!gameData) return <div className="loading-spinner" style={{display:'flex', height:'100vh', justifyContent:'center', alignItems:'center'}}>Carregando...</div>;

  const opponentName = playerColor === 'white' 
    ? (gameData.players.blackName || 'Aguardando oponente...') 
    : gameData.players.whiteName;
    
  const myName = playerColor === 'white' ? gameData.players.whiteName : (gameData.players.blackName || user.displayName);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', padding: '16px', maxWidth: '600px', margin: '0 auto', position: 'relative' }}>
      
      {/* Toast Notification */}
      {toastMsg && (
        <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', background: 'var(--danger-color)', color: 'white', padding: '12px 24px', borderRadius: '8px', zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.5)', width: '90%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '15px' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 'bold', flex: 1, textAlign: 'left' }}>{toastMsg}</span>
          <button onClick={() => setToastMsg('')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={20} />
          </button>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', marginTop: '10px' }}>
        <button onClick={() => navigate('/lobby')} className="btn" style={{ padding: '8px' }}>
          <ArrowLeft size={20} />
        </button>
        
        <div onClick={copyCode} className="glass-panel" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', borderRadius: '20px' }}>
          <span style={{ fontWeight: 'bold', letterSpacing: '2px', color: 'var(--accent-color)' }}>{gameId}</span>
          {copied ? <Check size={16} color="var(--success-color)" /> : <Copy size={16} />}
        </div>
      </div>

      {/* Opponent Info */}
      <div className="glass-panel" style={{ padding: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-color-lighter)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          O
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontWeight: 'bold', minHeight: '20px' }}>{opponentName}</div>
          <div style={{ fontSize: '0.8rem', minHeight: '16px', color: gameData.status === 'waiting' ? 'var(--accent-color)' : 'var(--text-muted)' }}>
            {gameData.status === 'waiting' ? 'Esperando jogador...' : (game.turn() === (playerColor === 'white' ? 'b' : 'w') ? 'Pensando...' : '')}
          </div>
        </div>
      </div>

      {/* Board container for responsiveness */}
      <div style={{ width: '100%', aspectRatio: '1 / 1', marginBottom: '16px', boxShadow: 'var(--glass-shadow)', borderRadius: '4px', overflow: 'hidden' }}>
        <Chessboard 
          id="BasicBoard" 
          position={game.fen()} 
          onPieceDrop={onDrop}
          boardOrientation={playerColor === 'black' ? 'black' : 'white'}
          customDarkSquareStyle={{ backgroundColor: '#475569' }}
          customLightSquareStyle={{ backgroundColor: '#cbd5e1' }}
          animationDuration={300}
        />
      </div>

      {/* Player Info */}
      <div className="glass-panel" style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
          V
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontWeight: 'bold', minHeight: '20px' }}>{myName} (Você)</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--success-color)', minHeight: '16px' }}>
            {gameData.status === 'playing' && game.turn() === (playerColor === 'white' ? 'w' : 'b') ? 'Sua vez de jogar!' : ''}
          </div>
        </div>
      </div>

    </div>
  );
}
