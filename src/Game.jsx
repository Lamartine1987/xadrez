import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from './firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { ArrowLeft, Copy, Check } from 'lucide-react';

export default function Game({ user }) {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(new Chess());
  const [gameData, setGameData] = useState(null);
  const [playerColor, setPlayerColor] = useState(null); // 'white', 'black', or null (spectator)
  const [copied, setCopied] = useState(false);

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
      if (playerColor === 'spectator' || gameData?.status !== 'playing') return false;
      
      // Check if it's player's turn
      const turn = game.turn() === 'w' ? 'white' : 'black';
      if (turn !== playerColor) return false;

      const gameCopy = new Chess(game.fen());
      
      try {
        const move = gameCopy.move({
          from: sourceSquare,
          to: targetSquare,
          promotion: 'q', // always promote to queen for simplicity in mobile
        });

        if (move === null) return false; // illegal move

        setGame(gameCopy);

        // Update Firestore
        const gameRef = doc(db, 'games', gameId);
        await updateDoc(gameRef, {
          fen: gameCopy.fen(),
          history: [...(gameData.history || []), move.san]
        });

        return true;
      } catch (error) {
        return false;
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
      
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
        <div>
          <div style={{ fontWeight: 'bold' }}>{opponentName}</div>
          {gameData.status === 'waiting' && <div style={{ fontSize: '0.8rem', color: 'var(--accent-color)' }}>Esperando jogador...</div>}
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
        <div>
          <div style={{ fontWeight: 'bold' }}>{myName} (Você)</div>
        </div>
      </div>

    </div>
  );
}
