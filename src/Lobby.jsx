import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from './firebase';
import { collection, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { useBoardTheme } from './hooks/useBoardTheme';
import { Chessboard } from 'react-chessboard';
import { Plus, LogOut, ArrowRight, Bot, BookOpen, Trophy, Star, Brain, Palette, X } from 'lucide-react';

export default function Lobby({ user }) {
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [stars, setStars] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const { themeId, setThemeId, pieceTheme, setPieceTheme, availableThemes, availablePieceThemes, themeStyles } = useBoardTheme();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setStars(docSnap.data().stars || 0);
      }
    });
    return unsub;
  }, [user]);

  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 6).toUpperCase();
  };

  const handleCreateGame = async () => {
    setLoading(true);
    try {
      const code = generateRoomCode();
      const gameRef = doc(collection(db, 'games'), code);
      
      await setDoc(gameRef, {
        players: {
          white: user.uid,
          whiteName: user.displayName || user.email.split('@')[0],
          black: null,
          blackName: null
        },
        status: 'waiting', 
        fen: 'start',
        history: [],
        createdAt: new Date()
      });

      navigate(`/game/${code}`);
    } catch (error) {
      console.error("Erro ao criar partida:", error);
      alert("Erro ao criar partida. Verifique as permissões do banco de dados.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGame = async (e) => {
    e.preventDefault();
    if (!roomCode || roomCode.length !== 4) {
      alert("Por favor, insira um código de 4 caracteres.");
      return;
    }

    setLoading(true);
    try {
      const code = roomCode.toUpperCase();
      const gameRef = doc(db, 'games', code);
      const gameSnap = await getDoc(gameRef);

      if (gameSnap.exists()) {
        navigate(`/game/${code}`);
      } else {
        alert("Partida não encontrada!");
      }
    } catch (error) {
      console.error("Erro ao entrar na partida:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px' }}>
      
      <div style={{ position: 'absolute', top: 20, right: 20, display: 'flex', alignItems: 'center', gap: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#fbbf24', fontWeight: 'bold' }} title="Suas Estrelas">
          <Star size={18} fill="#fbbf24" /> {stars}
        </div>
        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{user.displayName || user.email.split('@')[0]}</span>
        <button onClick={handleLogout} className="btn btn-danger" style={{ padding: '8px' }} title="Sair">
          <LogOut size={16} />
        </button>
      </div>

      <div className="glass-panel" style={{ width: '100%', maxWidth: '500px', textAlign: 'center' }}>
        <h2 style={{ marginBottom: '30px', color: 'var(--text-main)' }}>Menu Principal</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '30px' }}>
          
          {/* Multiplayer */}
          <div style={{ gridColumn: '1 / -1', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid var(--accent-glow)', padding: '20px', borderRadius: '12px' }}>
            <h3 style={{ marginBottom: '15px', color: 'var(--accent-color)' }}>Jogar com Amigos</h3>
            <button 
              onClick={handleCreateGame} 
              disabled={loading}
              className="btn" 
              style={{ width: '100%', marginBottom: '15px', padding: '12px' }}
            >
              <Plus size={20} />
              Criar Sala
            </button>
            <form onSubmit={handleJoinGame} style={{ display: 'flex', gap: '10px' }}>
              <input 
                type="text" 
                placeholder="CÓDIGO" 
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                className="input-modern"
                maxLength={4}
                style={{ textTransform: 'uppercase', textAlign: 'center', letterSpacing: '2px', fontWeight: 'bold' }}
              />
              <button type="submit" disabled={loading || roomCode.length < 4} className="btn">
                <ArrowRight size={20} />
              </button>
            </form>
          </div>

          {/* Bot */}
          <button onClick={() => navigate('/bot')} className="btn" style={{ background: 'var(--bg-color-lighter)', border: '1px solid var(--glass-border)', flexDirection: 'column', padding: '20px', gap: '10px', color: 'var(--text-main)', boxShadow: 'none' }}>
            <Bot size={32} color="var(--success-color)" />
            Desafiar Robô
          </button>

          {/* Ranking */}
          <button onClick={() => navigate('/ranking')} className="btn" style={{ background: 'var(--bg-color-lighter)', border: '1px solid var(--glass-border)', flexDirection: 'column', padding: '20px', gap: '10px', color: 'var(--text-main)', boxShadow: 'none' }}>
            <Trophy size={32} color="#fbbf24" />
            Ver Ranking
          </button>

          {/* Tutorial */}
          <button onClick={() => navigate('/tutorial')} className="btn" style={{ background: 'var(--bg-color-lighter)', border: '1px solid var(--glass-border)', flexDirection: 'column', padding: '20px', gap: '10px', color: 'var(--text-main)', boxShadow: 'none' }}>
            <BookOpen size={32} color="var(--accent-color)" />
            Como Jogar
          </button>
          
          {/* AI Coach */}
          <button onClick={() => navigate('/coach')} className="btn" style={{ background: 'linear-gradient(45deg, rgba(139, 92, 246, 0.2), rgba(59, 130, 246, 0.2))', border: '1px solid #8b5cf6', padding: '15px', gap: '10px', color: 'var(--text-main)', justifyContent: 'center' }}>
            <Brain size={24} color="#a78bfa" />
            Meu Treinador IA
          </button>

          {/* Aparência */}
          <button onClick={() => setShowSettings(true)} className="btn" style={{ background: 'var(--bg-color-lighter)', border: '1px solid var(--glass-border)', padding: '15px', gap: '10px', color: 'var(--text-main)', justifyContent: 'center' }}>
            <Palette size={24} color="#f472b6" />
            Aparência
          </button>
        </div>
      </div>

      {/* Modal de Aparência */}
      {showSettings && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '24px', position: 'relative' }}>
            <button onClick={() => setShowSettings(false)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
              <X size={24} />
            </button>
            <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
               <Palette /> Personalizar
            </h2>

            <div style={{ width: '100%', maxWidth: '200px', margin: '0 auto 20px', borderRadius: '4px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
               <Chessboard 
                 id="PreviewBoard" 
                 position="start" 
                 arePiecesDraggable={false}
                 {...themeStyles} 
               />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
               {availableThemes.map(theme => (
                  <button 
                     key={theme.id}
                     onClick={() => setThemeId(theme.id)}
                     className="btn" 
                     style={{ 
                        padding: '12px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        background: themeId === theme.id ? 'var(--accent-color)' : 'var(--bg-color-lighter)' 
                     }}
                  >
                     <span>{theme.name}</span>
                     <div style={{ display: 'flex', width: '40px', height: '20px', borderRadius: '4px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.2)' }}>
                        <div style={{ flex: 1, background: theme.light }}></div>
                        <div style={{ flex: 1, background: theme.dark }}></div>
                     </div>
                  </button>
               ))}
            </div>

            <h3 style={{ fontSize: '1rem', marginBottom: '15px', color: '#94a3b8' }}>Estilo das Peças</h3>
            <select 
               value={pieceTheme} 
               onChange={(e) => setPieceTheme(e.target.value)}
               className="input-modern"
               style={{ width: '100%', marginBottom: '10px' }}
            >
               {availablePieceThemes.map(theme => (
                  <option key={theme.id} value={theme.id} style={{ background: '#1e293b', color: 'white' }}>
                     {theme.name}
                  </option>
               ))}
            </select>
            
            <button className="btn" onClick={() => setShowSettings(false)} style={{ width: '100%', marginTop: '24px' }}>
               Salvar e Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
