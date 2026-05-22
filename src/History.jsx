import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from './firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { ArrowLeft, Clock, Search } from 'lucide-react';

export default function History({ user }) {
  const [historyGames, setHistoryGames] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!user) return;
    const qGames = query(
      collection(db, 'games'), 
      where('participantIds', 'array-contains', user.uid)
    );
    
    const unsub = onSnapshot(qGames, (snapshot) => {
      const games = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.status !== 'playing' && data.status !== 'waiting') {
           games.push({ id: doc.id, ...data });
        }
      });
      games.sort((a, b) => {
         const timeA = a.updatedAt?.toMillis() || a.createdAt?.toMillis() || 0;
         const timeB = b.updatedAt?.toMillis() || b.createdAt?.toMillis() || 0;
         return timeB - timeA;
      });
      setHistoryGames(games);
    });

    return () => unsub();
  }, [user]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', padding: '20px', paddingBottom: '90px' }}>
      
      <div style={{ width: '100%', maxWidth: '500px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
         <button onClick={() => navigate('/lobby')} className="btn" style={{ padding: '8px' }}>
            <ArrowLeft size={20} />
         </button>
         <Clock size={28} color="#fbbf24" />
         <h1 style={{ fontSize: '1.5rem', color: 'white' }}>Histórico de Partidas</h1>
      </div>

      <div className="glass-panel" style={{ width: '100%', maxWidth: '500px', padding: '20px' }}>
         <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '300px' }}>
           {historyGames.length === 0 ? (
             <div style={{ color: 'var(--text-muted)', padding: '40px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <Search size={40} color="rgba(255,255,255,0.1)" />
                Nenhuma partida finalizada encontrada.<br/>Jogue algumas partidas para ver seu histórico!
             </div>
           ) : (
             historyGames.map(game => {
                const isWhite = game.players.white === user.uid;
                const opponentName = isWhite ? game.players.blackName : game.players.whiteName;
                
                let resultText = "Partida Finalizada";
                let resultColor = "var(--text-muted)";

                // Lógica simples para identificar o vencedor baseada no status e fen
                if (game.status === 'resigned' || game.status === 'timeout') {
                   // O 'turn' normalmente mostra de quem era a vez, então quem não era o turno venceu, a menos que...
                   // Na verdade, se o adversário abandonou, nós vencemos. Como não temos um 'winner' claro no BD em todos os casos antigos,
                   // Vamos usar uma simplificação visual:
                   resultText = "Finalizada";
                }
                
                return (
                  <div 
                     key={game.id} 
                     onClick={() => navigate(`/game/${game.id}?analysis=true`)}
                     style={{ 
                       background: 'rgba(0,0,0,0.2)', 
                       borderRadius: '8px', 
                       padding: '12px 15px', 
                       display: 'flex', 
                       alignItems: 'center', 
                       justifyContent: 'space-between',
                       border: '1px solid rgba(255,255,255,0.05)',
                       cursor: 'pointer'
                     }}
                     className="hover-glow"
                  >
                     <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '1rem', color: 'white' }}>
                           vs {opponentName || 'Desconhecido'}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: resultColor, marginTop: '4px' }}>
                           {new Date(game.createdAt?.toMillis() || Date.now()).toLocaleDateString('pt-BR')} - Status: {game.status}
                        </div>
                     </div>
                     <div style={{ fontSize: '0.8rem', fontFamily: 'monospace', background: 'rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: '4px' }}>
                        Ver Tabuleiro
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
