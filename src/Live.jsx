import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from './firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Eye, Clock } from 'lucide-react';

export default function Live({ user }) {
  const [liveGames, setLiveGames] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    // Inscrição nas partidas ao vivo de toda a plataforma
    const qLive = query(
      collection(db, 'games'),
      where('status', '==', 'playing')
    );
    
    const unsubLive = onSnapshot(qLive, (snapshot) => {
      const live = [];
      snapshot.forEach(doc => {
        // Não incluir as partidas em que o usuário está jogando
        if (!doc.data().participantIds?.includes(user.uid)) {
           live.push({ id: doc.id, ...doc.data() });
        }
      });
      live.sort((a, b) => {
         const timeA = a.updatedAt?.toMillis() || a.createdAt?.toMillis() || 0;
         const timeB = b.updatedAt?.toMillis() || b.createdAt?.toMillis() || 0;
         return timeB - timeA;
      });
      setLiveGames(live);
    });

    return () => unsubLive();
  }, [user]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', padding: '20px', paddingBottom: '90px' }}>
      
      <div style={{ width: '100%', maxWidth: '500px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
         <Eye size={28} color="var(--danger-color)" />
         <h1 style={{ fontSize: '1.5rem', color: 'white' }}>Partidas ao Vivo</h1>
      </div>

      <div className="glass-panel" style={{ width: '100%', maxWidth: '500px', padding: '20px' }}>
         <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '300px' }}>
           {liveGames.length === 0 ? (
             <div style={{ color: 'var(--text-muted)', padding: '40px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <Clock size={40} color="rgba(255,255,255,0.1)" />
                Nenhuma partida rolando ao vivo no momento.<br/>Aguarde novas partidas começarem.
             </div>
           ) : (
             liveGames.map(game => {
                const whitePlayer = game.players.whiteName || 'Visitante';
                const blackPlayer = game.players.blackName || 'Visitante';
                
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
                       border: '1px solid rgba(255,255,255,0.05)',
                       transition: 'all 0.2s'
                     }}
                     className="hover-glow"
                  >
                     <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1 }}>
                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'white', display: 'flex', alignItems: 'center', gap: '5px' }}>
                           <div style={{width: '12px', height: '12px', background: 'white', borderRadius: '2px'}}></div> {whitePlayer}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0', paddingLeft: '18px' }}>vs</div>
                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'white', display: 'flex', alignItems: 'center', gap: '5px' }}>
                           <div style={{width: '12px', height: '12px', background: '#333', border: '1px solid #666', borderRadius: '2px'}}></div> {blackPlayer}
                        </div>
                     </div>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--danger-color)', fontWeight: 'bold', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <div style={{width: '6px', height: '6px', borderRadius: '50%', background: 'var(--danger-color)', animation: 'pulse 1.5s infinite'}}></div> Ao Vivo
                          </span>
                          <span style={{ fontSize: '0.7rem', fontFamily: 'monospace', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', letterSpacing: '1px' }}>
                             {game.id}
                          </span>
                        </div>
                        <Eye size={20} color="var(--accent-color)" />
                     </div>
                  </div>
                );
             })
           )}
         </div>
      </div>
    </div>
  );
}
