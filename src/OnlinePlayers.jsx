import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from './firebase';
import { collection, onSnapshot, query, where, addDoc, serverTimestamp, doc } from 'firebase/firestore';
import { Users, Swords, PlayCircle, X } from 'lucide-react';

export default function OnlinePlayers({ user }) {
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [sentChallengeId, setSentChallengeId] = useState(null);
  const [sentChallengeTargetId, setSentChallengeTargetId] = useState(null);
  const [selectedOpponent, setSelectedOpponent] = useState(null);
  const [gameType, setGameType] = useState('chess');
  const [timeControl, setTimeControl] = useState('0');
  const [myGames, setMyGames] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!user) return;

    // Fetch users where status is 'online'
    const qUsers = query(
      collection(db, 'users'),
      where('status', '==', 'online')
    );
    
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      const players = [];
      snapshot.forEach(doc => {
        if (doc.id !== user.uid) { // Exclude current user
           players.push({ id: doc.id, ...doc.data() });
        }
      });
      // Sort by elo or displayName if needed
      setOnlineUsers(players);
      });

    // Inscrição nas partidas ativas
    const qGames = query(
      collection(db, 'games'), 
      where('participantIds', 'array-contains', user.uid)
    );
    
    const unsubGames = onSnapshot(qGames, (snapshot) => {
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
       unsubUsers();
       unsubGames();
    };
  }, [user]);

  useEffect(() => {
    if (!sentChallengeId) return;

    const unsub = onSnapshot(doc(db, 'challenges', sentChallengeId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.status === 'accepted' && data.gameId) {
           navigate(`/game/${data.gameId}`);
        }
      } else {
        // Desafio foi recusado (documento deletado)
        alert("O jogador recusou o seu desafio.");
        setSentChallengeId(null);
        setSentChallengeTargetId(null);
      }
    });

    return () => unsub();
  }, [sentChallengeId, navigate]);

  const confirmChallenge = async () => {
    if (!selectedOpponent) return;
    try {
      setSentChallengeTargetId(selectedOpponent.id);
      const docRef = await addDoc(collection(db, 'challenges'), {
        from: user.uid,
        fromName: user.displayName || user.email.split('@')[0],
        fromElo: user.elo || 1200,
        to: selectedOpponent.id,
        toName: selectedOpponent.displayName || selectedOpponent.email.split('@')[0],
        status: 'pending',
        gameType: gameType,
        timeControl: parseInt(timeControl),
        createdAt: serverTimestamp()
      });
      setSentChallengeId(docRef.id);
      setSelectedOpponent(null);
    } catch (error) {
      console.error("Erro ao enviar desafio", error);
      alert("Erro ao enviar desafio.");
      setSentChallengeTargetId(null);
      setSelectedOpponent(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', padding: '20px', paddingBottom: '90px' }}>
      
      <div style={{ width: '100%', maxWidth: '500px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
         <Users size={28} color="var(--success-color)" />
         <h1 style={{ fontSize: '1.5rem', color: 'white' }}>Jogadores Online</h1>
      </div>

      {myGames.length > 0 && (
         <div style={{ width: '100%', maxWidth: '500px', marginBottom: '30px' }}>
            <h2 style={{ fontSize: '1.1rem', color: 'var(--text-muted)', marginBottom: '15px' }}>Minhas Partidas Ativas</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
               {myGames.map(game => {
                   const isWhite = game.players.white === user.uid;
                   const opponentName = isWhite ? game.players.blackName : game.players.whiteName;
                   
                   let isMyTurn = false;
                   if (game.status === 'playing') {
                      if (game.gameType === 'checkers') {
                         if (game.checkersState) {
                            try {
                               const stateObj = typeof game.checkersState === 'string' ? JSON.parse(game.checkersState) : game.checkersState;
                               if ((isWhite && stateObj.turn === 'w') || (!isWhite && stateObj.turn === 'b')) {
                                  isMyTurn = true;
                               }
                            } catch(e) {}
                         }
                      } else {
                         if (game.fen) {
                            const turnStr = game.fen.split(' ')[1] || 'w';
                            if ((isWhite && turnStr === 'w') || (!isWhite && turnStr === 'b')) {
                               isMyTurn = true;
                            }
                         }
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
                          background: 'rgba(0,0,0,0.3)', 
                          borderRadius: '8px', 
                          padding: '12px 15px', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          border: isMyTurn ? '1px solid var(--success-color)' : '1px solid var(--glass-border)',
                          transition: 'all 0.2s'
                        }}
                        className="hover-glow"
                     >
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                           <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>{opponentName || 'Sem oponente'}</div>
                           <div style={{ fontSize: '0.8rem', color: statusColor, fontWeight: isMyTurn ? 'bold' : 'normal', marginTop: '4px' }}>
                              {statusText}
                           </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                           <PlayCircle size={24} color={isMyTurn ? "var(--success-color)" : "var(--accent-color)"} />
                        </div>
                     </div>
                   );
               })}
            </div>
         </div>
      )}

      <div className="glass-panel" style={{ width: '100%', maxWidth: '500px', padding: '20px' }}>
         <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '300px' }}>
           {onlineUsers.length === 0 ? (
             <div style={{ color: 'var(--text-muted)', padding: '40px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <Users size={40} color="rgba(255,255,255,0.1)" />
                Nenhum outro jogador online no momento.<br/>Convide seus amigos!
             </div>
           ) : (
             onlineUsers.map(player => {
                const playerName = player.displayName || player.email?.split('@')[0] || 'Jogador';
                const elo = player.elo || 1200;
                
                return (
                  <div 
                     key={player.id} 
                     style={{ 
                       background: 'rgba(0,0,0,0.2)', 
                       borderRadius: '8px', 
                       padding: '12px 15px', 
                       display: 'flex', 
                       alignItems: 'center', 
                       justifyContent: 'space-between',
                       border: '1px solid rgba(255,255,255,0.05)'
                     }}
                  >
                     <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '1rem', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                           <div style={{width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success-color)'}}></div>
                           {playerName}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                           Rating: {elo}
                        </div>
                     </div>
                     <button 
                        className="btn"
                        onClick={() => setSelectedOpponent(player)}
                        disabled={sentChallengeId !== null}
                        style={{ padding: '8px 12px', fontSize: '0.85rem', opacity: (sentChallengeId !== null && sentChallengeTargetId !== player.id) ? 0.5 : 1 }}
                     >
                        <Swords size={16} /> {sentChallengeTargetId === player.id ? "Aguardando..." : "Desafiar"}
                     </button>
                  </div>
                );
             })
           )}
         </div>
      </div>

      {selectedOpponent && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '350px', padding: '24px', textAlign: 'center', border: '1px solid var(--accent-color)' }}>
            <h2 style={{ marginBottom: '20px', fontSize: '1.2rem', color: 'white' }}>Desafiar {selectedOpponent.displayName || selectedOpponent.email?.split('@')[0]}</h2>
            
            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
               <button onClick={() => setGameType('chess')} className="btn" style={{ flex: 1, background: gameType === 'chess' ? 'var(--accent-color)' : 'var(--bg-color-lighter)', border: 'none' }}>Xadrez</button>
               <button onClick={() => setGameType('checkers')} className="btn" style={{ flex: 1, background: gameType === 'checkers' ? 'var(--accent-color)' : 'var(--bg-color-lighter)', border: 'none' }}>Damas</button>
            </div>

            <select 
               value={timeControl} 
               onChange={(e) => setTimeControl(e.target.value)}
               className="input-modern"
               style={{ width: '100%', marginBottom: '20px', cursor: 'pointer' }}
            >
               <option value="0">Sem Tempo (Correspondência)</option>
               <option value="3">3 minutos</option>
               <option value="5">5 minutos</option>
               <option value="10">10 minutos</option>
            </select>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setSelectedOpponent(null)} className="btn" style={{ flex: 1, background: 'transparent', border: '1px solid var(--glass-border)' }}>
                 Cancelar
              </button>
              <button onClick={confirmChallenge} className="btn" style={{ flex: 1, background: 'var(--success-color)', border: 'none' }}>
                <Swords size={18} /> Enviar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
