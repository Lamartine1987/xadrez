import { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import Game from './Game';
import GameCheckers from './GameCheckers';
import GameDominoes from './GameDominoes';
import GameSudoku from './GameSudoku';

export default function GameWrapper({ user }) {
  const { gameId } = useParams();
  const [gameType, setGameType] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGame = async () => {
      if (!gameId) return;
      const snap = await getDoc(doc(db, 'games', gameId));
      if (snap.exists()) {
        setGameType(snap.data().gameType || 'chess');
      } else {
        setGameType('not_found');
      }
      setLoading(false);
    };
    fetchGame();
  }, [gameId]);

  if (loading) return <div style={{ color: 'white', textAlign: 'center', marginTop: '50px' }}>Carregando Partida...</div>;
  if (gameType === 'not_found') return <Navigate to="/" />;

  if (gameType === 'checkers') {
    return <GameCheckers user={user} />;
  }

  if (gameType === 'dominoes') {
    return <GameDominoes user={user} />;
  }

  if (gameType === 'sudoku') {
    return <GameSudoku user={user} />;
  }

  return <Game user={user} />;
}
