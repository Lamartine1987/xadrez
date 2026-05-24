import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase';
import Login from './Login';
import Lobby from './Lobby';
import GameWrapper from './GameWrapper';
import GameBot from './GameBot';
import GameBotCheckers from './GameBotCheckers';
import Tutorial from './Tutorial';
import Ranking from './Ranking';
import Coach from './Coach';
import Live from './Live';
import OnlinePlayers from './OnlinePlayers';
import History from './History';
import Tournaments from './Tournaments';
import TournamentDetails from './TournamentDetails';
import AdminSettings from './AdminSettings';
import BottomNav from './components/BottomNav';
import LandingPage from './LandingPage';
import './App.css';

import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, setDoc, deleteDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Swords, X, Check } from 'lucide-react';

function AppLayout({ children, user }) {
  const [incomingChallenge, setIncomingChallenge] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    
    const userRef = doc(db, 'users', user.uid);
    
    updateDoc(userRef, {
      status: 'online',
      lastActive: serverTimestamp()
    }).catch(console.error);

    const handleBeforeUnload = () => {
      updateDoc(userRef, { status: 'offline' });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        updateDoc(userRef, { status: 'offline' }).catch(console.error);
      } else {
        updateDoc(userRef, { status: 'online', lastActive: serverTimestamp() }).catch(console.error);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Listener de desafios recebidos
    const qChallenges = query(
      collection(db, 'challenges'),
      where('to', '==', user.uid)
    );

    const unsubChallenges = onSnapshot(qChallenges, (snapshot) => {
      let pendingChallenge = null;
      snapshot.forEach(doc => {
         if (doc.data().status === 'pending') {
            pendingChallenge = { id: doc.id, ...doc.data() };
         }
      });
      setIncomingChallenge(pendingChallenge);
    });

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      updateDoc(userRef, { status: 'offline' }).catch(console.error);
      unsubChallenges();
    };
  }, [user]);

  const handleAcceptChallenge = async () => {
    if (!incomingChallenge) return;
    try {
      // Criar nova sala de jogo
      const code = Math.random().toString(36).substring(2, 6).toUpperCase();
      const gameRef = doc(collection(db, 'games'), code);
      
      const gameType = incomingChallenge.gameType || 'chess';
      const timeControl = incomingChallenge.timeControl || 0;
      
      const baseGameData = {
        players: {
          white: incomingChallenge.from,
          whiteName: incomingChallenge.fromName,
          whiteElo: incomingChallenge.fromElo || 1200,
          black: user.uid,
          blackName: user.displayName || user.email.split('@')[0],
          blackElo: 1200
        },
        status: 'playing',
        gameType: gameType,
        timeControl: timeControl,
        whiteTime: timeControl * 60 * 1000,
        blackTime: timeControl * 60 * 1000,
        lastMoveAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        participantIds: [incomingChallenge.from, user.uid],
        isChallenge: true
      };

      if (gameType === 'checkers') {
         // Create default checkers state
         const { CheckersGame } = await import('./utils/checkersLogic');
         const newCheckers = new CheckersGame();
         baseGameData.checkersState = JSON.stringify(newCheckers.getState());
      } else {
         baseGameData.fen = 'start';
         baseGameData.history = [];
      }

      await setDoc(gameRef, baseGameData);

      // Atualizar o desafio como aceito
      await updateDoc(doc(db, 'challenges', incomingChallenge.id), {
        status: 'accepted',
        gameId: code
      });
      
      setIncomingChallenge(null);
      navigate(`/game/${code}`);
    } catch (err) {
      console.error("Erro ao aceitar desafio:", err);
    }
  };

  const handleDeclineChallenge = async () => {
    if (!incomingChallenge) return;
    try {
      await deleteDoc(doc(db, 'challenges', incomingChallenge.id));
      setIncomingChallenge(null);
    } catch (err) {
      console.error("Erro ao recusar desafio:", err);
    }
  };

  if (!user) return children;
  
  return (
    <div className="main-layout">
      {children}
      <BottomNav />
      
      {incomingChallenge && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '350px', padding: '24px', textAlign: 'center', border: '1px solid var(--accent-color)' }}>
            <Swords size={48} color="var(--accent-color)" style={{ marginBottom: '15px' }} />
            <h2 style={{ marginBottom: '10px', fontSize: '1.2rem', color: 'white' }}>Desafio Recebido!</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '25px' }}>
              <strong style={{ color: 'white' }}>{incomingChallenge.fromName}</strong> te desafiou para uma partida de xadrez!
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleDeclineChallenge} className="btn" style={{ flex: 1, background: 'transparent', border: '1px solid var(--danger-color)', color: 'var(--danger-color)' }}>
                <X size={18} /> Recusar
              </button>
              <button onClick={handleAcceptChallenge} className="btn" style={{ flex: 1, background: 'var(--success-color)', border: 'none' }}>
                <Check size={18} /> Aceitar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="loading-spinner">Carregando...</div>
      </div>
    );
  }

  return (
    <Router>
      <AppLayout user={user}>
        <Routes>
          <Route 
            path="/" 
            element={user ? <Navigate to="/lobby" /> : <LandingPage />} 
          />
          <Route 
            path="/login" 
            element={user ? <Navigate to="/lobby" /> : <Login />} 
          />
          <Route 
            path="/lobby" 
            element={user ? <Lobby user={user} /> : <Navigate to="/" />} 
          />
          <Route 
            path="/game/:gameId" 
            element={user ? <GameWrapper user={user} /> : <Navigate to="/" />} 
          />
          <Route 
            path="/bot" 
            element={user ? <GameBot user={user} /> : <Navigate to="/" />} 
          />
          <Route 
            path="/bot/checkers" 
            element={user ? <GameBotCheckers user={user} /> : <Navigate to="/" />} 
          />
          <Route 
            path="/tutorial" 
            element={user ? <Tutorial user={user} /> : <Navigate to="/" />} 
          />
          <Route 
            path="/ranking" 
            element={user ? <Ranking user={user} /> : <Navigate to="/" />} 
          />
          <Route 
            path="/coach" 
            element={user ? <Coach user={user} /> : <Navigate to="/" />} 
          />
          <Route 
            path="/live" 
            element={user ? <Live user={user} /> : <Navigate to="/" />} 
          />
          <Route 
            path="/online" 
            element={user ? <OnlinePlayers user={user} /> : <Navigate to="/" />} 
          />
          <Route 
            path="/history" 
            element={user ? <History user={user} /> : <Navigate to="/" />} 
          />
          <Route 
            path="/tournaments" 
            element={user ? <Tournaments user={user} /> : <Navigate to="/" />} 
          />
          <Route 
            path="/tournament/:id" 
            element={user ? <TournamentDetails user={user} /> : <Navigate to="/" />} 
          />
          <Route 
            path="/admin" 
            element={user ? <AdminSettings user={user} /> : <Navigate to="/" />} 
          />
        </Routes>
      </AppLayout>
    </Router>
  );
}

export default App;
