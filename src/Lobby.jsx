import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from './firebase';
import { collection, doc, setDoc, getDoc, onSnapshot, query, where, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { useBoardTheme } from './hooks/useBoardTheme';
import { Chessboard } from 'react-chessboard';
import { Plus, LogOut, ArrowRight, Bot, BookOpen, Trophy, Star, Brain, Palette, X, Clock, PlayCircle, Trash2 } from 'lucide-react';

export default function Lobby({ user }) {
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [stars, setStars] = useState(0);
  const [elo, setElo] = useState(1200);
  const [myGames, setMyGames] = useState([]);
  const [activeTab, setActiveTab] = useState('menu'); // 'menu' or 'games'
  const [showSettings, setShowSettings] = useState(false);
  const [timeControl, setTimeControl] = useState('0');
  const [gameToDelete, setGameToDelete] = useState(null);
  const [toastMsg, setToastMsg] = useState('');
  const { themeId, setThemeId, pieceTheme, setPieceTheme, availableThemes, availablePieceThemes, themeStyles } = useBoardTheme();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    
    // Inscrição dos pontos/estrelas do usuário
    const unsubUser = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setStars(docSnap.data().stars || 0);
        setElo(docSnap.data().elo || 1200);
      }
    });

    // Inscrição nas partidas ativas
    const q = query(
      collection(db, 'games'), 
      where('participantIds', 'array-contains', user.uid)
    );
    
    const unsubGames = onSnapshot(q, (snapshot) => {
      const games = [];
      snapshot.forEach(doc => {
        games.push({ id: doc.id, ...doc.data() });
      });
      games.sort((a, b) => {
         const timeA = a.updatedAt?.toMillis() || a.createdAt?.toMillis() || 0;
         const timeB = b.updatedAt?.toMillis() || b.createdAt?.toMillis() || 0;
         return timeB - timeA;
      });
      setMyGames(games);
    });

    return () => {
       unsubUser();
       unsubGames();
    };
  }, [user]);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

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
          whiteElo: elo,
          black: null,
          blackName: null,
          blackElo: null
        },
        status: 'waiting', 
        fen: 'start',
        history: [],
        timeControl: parseInt(timeControl, 10),
        whiteTime: parseInt(timeControl, 10) > 0 ? parseInt(timeControl, 10) * 1000 : null,
        blackTime: parseInt(timeControl, 10) > 0 ? parseInt(timeControl, 10) * 1000 : null,
        lastMoveAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        participantIds: [user.uid]
      });

      navigate(`/game/${code}`);
    } catch (error) {
      console.error("Erro ao criar partida:", error);
      showToast("Erro ao criar partida. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGame = async (e) => {
    e.preventDefault();
    if (!roomCode || roomCode.length !== 4) {
      showToast("Por favor, insira um código de 4 caracteres.");
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
        showToast("Partida não encontrada!");
      }
    } catch (error) {
      console.error("Erro ao entrar na partida:", error);
      showToast("Erro ao entrar na partida.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (gameId, e) => {
    e.stopPropagation();
    setGameToDelete(gameId);
  };

  const confirmDelete = async () => {
    if (!gameToDelete) return;
    try {
      await deleteDoc(doc(db, 'games', gameToDelete));
      showToast("Partida excluída com sucesso.");
    } catch (error) {
      console.error("Erro ao excluir partida:", error);
      showToast("Não foi possível excluir a partida. Tente novamente.");
    }
    setGameToDelete(null);
  };

  const handleLogout = () => {
    signOut(auth);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px', position: 'relative' }}>
      
      {toastMsg && (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', background: 'var(--accent-color)', color: 'white', padding: '12px 24px', borderRadius: '8px', zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.5)', width: '90%', maxWidth: '400px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '15px' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 'bold', flex: 1, textAlign: 'center' }}>{toastMsg}</span>
          <button onClick={() => setToastMsg('')} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={20} />
          </button>
        </div>
      )}

      {gameToDelete && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
          <div className="glass-panel" style={{ background: '#1e293b', maxWidth: '350px', width: '100%', textAlign: 'center', padding: '30px 20px', border: '1px solid var(--accent-color)', borderRadius: '12px' }}>
            <Trash2 size={48} color="var(--danger-color)" style={{ marginBottom: '15px' }} />
            <h3 style={{ marginBottom: '10px', fontSize: '1.2rem', color: 'white' }}>Excluir partida?</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '25px', fontSize: '0.9rem' }}>Essa ação não pode ser desfeita. Tem certeza que deseja remover esta sala?</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setGameToDelete(null)} className="btn" style={{ flex: 1, background: 'transparent', border: '1px solid var(--glass-border)' }}>Cancelar</button>
              <button onClick={confirmDelete} className="btn" style={{ flex: 1, background: 'var(--danger-color)', border: 'none' }}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ position: 'absolute', top: 20, right: 20, display: 'flex', alignItems: 'center', gap: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#fbbf24', fontWeight: 'bold' }} title="Suas Estrelas">
          <Star size={18} fill="#fbbf24" /> {stars}
        </div>
        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{user.displayName || user.email.split('@')[0]}</span>
        <button onClick={handleLogout} className="btn btn-danger" style={{ padding: '8px' }} title="Sair">
          <LogOut size={16} />
        </button>
      </div>

      <div className="glass-panel" style={{ width: '100%', maxWidth: '500px', textAlign: 'center', padding: '0', overflow: 'hidden' }}>
        
        <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', marginBottom: '20px' }}>
           <button 
             onClick={() => setActiveTab('menu')}
             style={{ flex: 1, padding: '15px 5px', background: activeTab === 'menu' ? 'rgba(255,255,255,0.05)' : 'transparent', border: 'none', color: activeTab === 'menu' ? 'white' : 'var(--text-muted)', fontWeight: 'bold', cursor: 'pointer', borderBottom: activeTab === 'menu' ? '2px solid var(--accent-color)' : '2px solid transparent', transition: 'all 0.2s', fontSize: '0.9rem' }}
           >
             Menu
           </button>
           <button 
             onClick={() => setActiveTab('games')}
             style={{ flex: 1, padding: '15px 5px', background: activeTab === 'games' ? 'rgba(255,255,255,0.05)' : 'transparent', border: 'none', color: activeTab === 'games' ? 'white' : 'var(--text-muted)', fontWeight: 'bold', cursor: 'pointer', borderBottom: activeTab === 'games' ? '2px solid var(--accent-color)' : '2px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', transition: 'all 0.2s', fontSize: '0.9rem' }}
           >
             Partidas 
             {myGames.length > 0 && (
               <span style={{ background: 'var(--accent-color)', color: 'white', padding: '2px 6px', borderRadius: '10px', fontSize: '0.7rem' }}>{myGames.length}</span>
             )}
           </button>
        </div>

        <div style={{ padding: '0 20px 20px 20px' }}>
          {activeTab === 'menu' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              {/* Multiplayer */}
              <div style={{ gridColumn: '1 / -1', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid var(--accent-glow)', padding: '20px', borderRadius: '12px' }}>
                <h3 style={{ marginBottom: '15px', color: 'var(--accent-color)' }}>Jogar com Amigos</h3>
                
                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                  <select 
                    value={timeControl} 
                    onChange={(e) => setTimeControl(e.target.value)}
                    className="input-modern"
                    style={{ flex: 1, cursor: 'pointer' }}
                  >
                    <option value="0">Sem Tempo (Diário)</option>
                    <option value="180">3 minutos (Blitz)</option>
                    <option value="300">5 minutos (Blitz)</option>
                    <option value="600">10 minutos (Rápida)</option>
                  </select>
                  <button 
                    onClick={handleCreateGame} 
                    disabled={loading}
                    className="btn" 
                    style={{ padding: '12px', flex: 1 }}
                  >
                    <Plus size={20} />
                    Criar Sala
                  </button>
                </div>

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

              {/* Histórico */}
              <button onClick={() => navigate('/history')} className="btn" style={{ background: 'var(--bg-color-lighter)', border: '1px solid var(--glass-border)', flexDirection: 'column', padding: '20px', gap: '10px', color: 'var(--text-main)', boxShadow: 'none' }}>
                <Clock size={32} color="#fbbf24" />
                Histórico
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
          ) : activeTab === 'games' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '300px' }}>
              {myGames.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', padding: '40px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                   <Clock size={40} color="rgba(255,255,255,0.1)" />
                   Nenhuma partida ativa no momento.<br/>Crie uma sala e convide seus amigos!
                </div>
              ) : (
                myGames.map(game => {
                   const isWhite = game.players.white === user.uid;
                   const opponentName = isWhite ? game.players.blackName : game.players.whiteName;
                   
                   let isMyTurn = false;
                   if (game.status === 'playing') {
                      const turnStr = game.fen.split(' ')[1];
                      if ((isWhite && turnStr === 'w') || (!isWhite && turnStr === 'b')) {
                         isMyTurn = true;
                      }
                   }

                   let statusText = "Finalizada";
                   let statusColor = "var(--text-muted)";
                   
                   if (game.status === 'waiting') {
                      statusText = "Aguardando Oponente";
                      statusColor = "var(--accent-color)";
                   } else if (game.status === 'playing') {
                      if (isMyTurn) {
                         statusText = "Sua Vez!";
                         statusColor = "var(--success-color)";
                      } else {
                         statusText = "Vez do Oponente";
                         statusColor = "var(--text-muted)";
                      }
                   }

                   return (
                     <div 
                        key={game.id} 
                        onClick={() => navigate(`/game/${game.id}`)}
                        style={{ 
                          background: 'rgba(0,0,0,0.2)', 
                          borderRadius: '8px', 
                          padding: '12px 15px', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          border: isMyTurn ? '1px solid var(--success-color)' : '1px solid transparent',
                          transition: 'all 0.2s'
                        }}
                        className="hover-glow"
                     >
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                           <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>{opponentName || 'Sem oponente'}</div>
                           <div style={{ fontSize: '0.8rem', color: statusColor, fontWeight: isMyTurn ? 'bold' : 'normal', marginTop: '2px' }}>
                              {statusText}
                           </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                           <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', background: 'rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: '4px', letterSpacing: '1px' }}>
                              {game.id}
                           </span>
                           <PlayCircle size={20} color={isMyTurn ? "var(--success-color)" : "var(--accent-color)"} />
                           <button 
                             onClick={(e) => handleDeleteClick(game.id, e)}
                             style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}
                             title="Excluir partida"
                           >
                             <Trash2 size={18} />
                           </button>
                        </div>
                     </div>
                   );
                })
              )}
            </div>
          ) : null}
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
