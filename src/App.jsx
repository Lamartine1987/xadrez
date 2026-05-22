import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase';
import Login from './Login';
import Lobby from './Lobby';
import Game from './Game';
import GameBot from './GameBot';
import Tutorial from './Tutorial';
import Ranking from './Ranking';
import Coach from './Coach';
import Live from './Live';
import OnlinePlayers from './OnlinePlayers';
import BottomNav from './components/BottomNav';
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

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Listener de desafios recebidos
    const qChallenges = query(
      collection(db, 'challenges'),
      where('to', '==', user.uid),
      where('status', '==', 'pending')
    );

    const unsubChallenges = onSnapshot(qChallenges, (snapshot) => {
      if (!snapshot.empty) {
        // Pega o primeiro desafio pendente
        setIncomingChallenge({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
      } else {
        setIncomingChallenge(null);
      }
    });

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
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
      
      await setDoc(gameRef, {
        players: {
          white: incomingChallenge.from,
          whiteName: incomingChallenge.fromName,
          whiteElo: incomingChallenge.fromElo || 1200,
          black: user.uid,
          blackName: user.displayName || user.email.split('@')[0],
          blackElo: 1200
        },
        status: 'playing', 
        fen: 'start',
        history: [],
        timeControl: 0, // Daily (Sem Tempo)
        whiteTime: 0,
        blackTime: 0,
        lastMoveAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        participantIds: [incomingChallenge.from, user.uid]
      });

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
            element={user ? <Navigate to="/lobby" /> : <Login />} 
          />
          <Route 
            path="/lobby" 
            element={user ? <Lobby user={user} /> : <Navigate to="/" />} 
          />
          <Route 
            path="/game/:gameId" 
            element={user ? <Game user={user} /> : <Navigate to="/" />} 
          />
          <Route 
            path="/bot" 
            element={user ? <GameBot user={user} /> : <Navigate to="/" />} 
          />
          <Route 
            path="/tutorial" 
            element={user ? <Tutorial user={user} /> : <Navigate to="/" />} 
          />
          <Route 
            path="/ranking" 
            element={user ? <Ranking /> : <Navigate to="/" />} 
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
        </Routes>
      </AppLayout>
    </Router>
  );
}

export default App;
