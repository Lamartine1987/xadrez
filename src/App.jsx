import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import Login from './Login';
import Lobby from './Lobby';
import Game from './Game';
import GameBot from './GameBot';
import Tutorial from './Tutorial';
import Ranking from './Ranking';
import BottomNav from './components/BottomNav';
import './App.css';

function AppLayout({ children, user }) {
  if (!user) return children;
  return (
    <div className="main-layout">
      {children}
      <BottomNav />
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
        </Routes>
      </AppLayout>
    </Router>
  );
}

export default App;
