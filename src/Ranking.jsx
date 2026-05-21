import { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { Trophy, Medal, Star } from 'lucide-react';

export default function Ranking() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('elo'); // 'elo' or 'stars'

  useEffect(() => {
    const fetchRanking = async () => {
      setLoading(true);
      try {
        const orderField = activeTab === 'elo' ? 'elo' : 'stars';
        const q = query(collection(db, 'users'), orderBy(orderField, 'desc'), limit(50));
        const querySnapshot = await getDocs(q);
        const fetchedUsers = [];
        querySnapshot.forEach((doc) => {
          fetchedUsers.push({ id: doc.id, ...doc.data() });
        });
        setUsers(fetchedUsers);
      } catch (error) {
        console.error("Erro ao buscar ranking:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRanking();
  }, [activeTab]);

  const getMedalColor = (index) => {
    if (index === 0) return '#fbbf24'; // Gold
    if (index === 1) return '#94a3b8'; // Silver
    if (index === 2) return '#b45309'; // Bronze
    return 'transparent';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '600px' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <Trophy size={48} color="#fbbf24" style={{ margin: '0 auto 10px' }} />
          <h2 style={{ color: 'var(--text-main)', fontSize: '2rem', textShadow: '0 0 10px rgba(251, 191, 36, 0.5)' }}>Ranking</h2>
          <p style={{ color: 'var(--text-muted)' }}>Os melhores mestres do Neon Chess</p>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <button 
            className="btn" 
            style={{ flex: 1, background: activeTab === 'elo' ? 'var(--accent-color)' : 'var(--bg-color-lighter)' }}
            onClick={() => setActiveTab('elo')}
          >
            <Trophy size={16} /> Top Elo
          </button>
          <button 
            className="btn" 
            style={{ flex: 1, background: activeTab === 'stars' ? 'var(--accent-color)' : 'var(--bg-color-lighter)' }}
            onClick={() => setActiveTab('stars')}
          >
            <Star size={16} /> Top Estrelas
          </button>
        </div>

        {loading ? (
          <div className="loading-spinner" style={{ textAlign: 'center', marginTop: '50px' }}>Carregando ranking...</div>
        ) : (
          <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
            {users.map((user, index) => (
              <div 
                key={user.id} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  padding: '16px 20px', 
                  borderBottom: index < users.length - 1 ? '1px solid var(--glass-border)' : 'none',
                  background: index < 3 ? `rgba(255, 255, 255, ${0.05 - (index * 0.01)})` : 'transparent'
                }}
              >
                <div style={{ width: '40px', fontWeight: 'bold', color: 'var(--text-muted)' }}>
                  #{index + 1}
                </div>
                
                <div style={{ marginRight: '15px' }}>
                  {index < 3 ? (
                    <Medal size={24} color={getMedalColor(index)} />
                  ) : (
                    <div style={{ width: '24px' }}></div>
                  )}
                </div>

                <div style={{ flex: 1, fontWeight: 'bold', color: 'var(--text-main)' }}>
                  {user.displayName}
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: activeTab === 'elo' ? 'var(--accent-color)' : '#fbbf24', fontWeight: 'bold', fontSize: '1.1rem' }}>
                    {activeTab === 'elo' ? `${user.elo} Elo` : `${user.stars || 0} ⭐`}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {user.gamesPlayed || 0} partidas
                  </div>
                </div>
              </div>
            ))}
            
            {users.length === 0 && (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Nenhum jogador encontrado ainda. Jogue uma partida para entrar no ranking!
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
