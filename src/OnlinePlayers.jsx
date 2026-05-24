import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from './firebase';
import { collection, onSnapshot, query, where, addDoc, serverTimestamp, doc } from 'firebase/firestore';
import { Users, Swords, PlayCircle } from 'lucide-react';

export default function OnlinePlayers({ user }) {
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [sentChallengeId, setSentChallengeId] = useState(null);
  const [sentChallengeTargetId, setSentChallengeTargetId] = useState(null);
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

  const handleChallenge = async (opponent) => {
    try {
      setSentChallengeTargetId(opponent.id);
      const docRef = await addDoc(collection(db, 'challenges'), {
        from: user.uid,
        fromName: user.displayName || user.email.split('@')[0],
        fromElo: user.elo || 1200,
        to: opponent.id,
        toName: opponent.displayName || opponent.email.split('@')[0],
        status: 'pending',
        createdAt: serverTimestamp()
      });
      setSentChallengeId(docRef.id);
    } catch (error) {
      console.error("Erro ao enviar desafio", error);
      alert("Erro ao enviar desafio.");
      setSentChallengeTargetId(null);
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
                        onClick={() => handleChallenge(player)}
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
    </div>
  );
}
