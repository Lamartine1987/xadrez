import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from './firebase';
import { collection, onSnapshot, query, where, addDoc, serverTimestamp, doc } from 'firebase/firestore';
import { Users, Swords } from 'lucide-react';

export default function OnlinePlayers({ user }) {
  const [onlineUsers, setOnlineUsers] = useState([]);
  const navigate = useNavigate();

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

    return () => unsubUsers();
  }, [user]);

  const [sentChallengeId, setSentChallengeId] = useState(null);

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
      }
    });

    return () => unsub();
  }, [sentChallengeId, navigate]);

  const handleChallenge = async (opponent) => {
    try {
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
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', padding: '20px', paddingBottom: '90px' }}>
      
      <div style={{ width: '100%', maxWidth: '500px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
         <Users size={28} color="var(--success-color)" />
         <h1 style={{ fontSize: '1.5rem', color: 'white' }}>Jogadores Online</h1>
      </div>

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
                        style={{ padding: '8px 12px', fontSize: '0.85rem', opacity: sentChallengeId ? 0.5 : 1 }}
                     >
                        <Swords size={16} /> {sentChallengeId ? "Aguardando..." : "Desafiar"}
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
