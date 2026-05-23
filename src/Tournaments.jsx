import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from './firebase';
import { collection, query, onSnapshot, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { Trophy, ArrowLeft, Plus, Users, Search, Clock, LayoutGrid } from 'lucide-react';

export default function Tournaments({ user }) {
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Create Tournament State
  const [newTourneyName, setNewTourneyName] = useState('');
  const [newTourneyGame, setNewTourneyGame] = useState('chess');
  const [newTourneyFormat, setNewTourneyFormat] = useState('knockout');
  const [newTourneyMaxPlayers, setNewTourneyMaxPlayers] = useState('8');

  useEffect(() => {
    const q = query(collection(db, 'tournaments'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const tList = [];
      snapshot.forEach(doc => {
        tList.push({ id: doc.id, ...doc.data() });
      });
      setTournaments(tList);
    });
    return () => unsub();
  }, []);

  const handleCreateTournament = async (e) => {
    e.preventDefault();
    if (!newTourneyName.trim()) return;

    try {
      const docRef = await addDoc(collection(db, 'tournaments'), {
        name: newTourneyName,
        gameType: newTourneyGame,
        format: newTourneyFormat,
        maxPlayers: parseInt(newTourneyMaxPlayers, 10),
        creator: user.uid,
        creatorName: user.displayName || user.email.split('@')[0],
        status: 'waiting',
        participants: [user.uid], // Creator joins automatically
        participantDetails: [{ uid: user.uid, name: user.displayName || user.email.split('@')[0] }],
        rounds: [],
        createdAt: serverTimestamp()
      });
      setShowCreateModal(false);
      navigate(`/tournament/${docRef.id}`);
    } catch (err) {
      console.error("Erro ao criar torneio:", err);
      alert("Erro ao criar torneio.");
    }
  };

  const activeTournaments = tournaments.filter(t => t.status !== 'finished');
  const finishedTournaments = tournaments.filter(t => t.status === 'finished');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-color)', color: 'var(--text-main)', paddingBottom: '90px' }}>
      <header style={{ padding: '15px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(10px)', borderBottom: '1px solid var(--glass-border)', position: 'sticky', top: 0, zIndex: 100 }}>
        <button onClick={() => navigate('/lobby')} className="btn" style={{ padding: '8px 12px', background: 'transparent', border: '1px solid var(--glass-border)' }}>
          <ArrowLeft size={18} /> Menu
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Trophy size={24} color="#fbbf24" />
          <span style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'white' }}>Torneios</span>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn" style={{ padding: '8px 12px', background: 'var(--accent-color)', color: 'white', border: 'none' }}>
          <Plus size={18} /> Novo
        </button>
      </header>

      <main style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        
        <h2 style={{ fontSize: '1.2rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Clock size={20} color="var(--accent-color)" /> Torneios Ativos / Aguardando
        </h2>
        
        <div style={{ display: 'grid', gap: '15px', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {activeTournaments.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', padding: '40px 20px', textAlign: 'center', gridColumn: '1 / -1', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
               <Search size={40} color="rgba(255,255,255,0.1)" style={{ margin: '0 auto 10px' }} />
               Nenhum torneio aberto no momento.<br/>Crie um novo torneio e convide seus amigos!
            </div>
          ) : (
            activeTournaments.map(t => (
              <div 
                key={t.id} 
                onClick={() => navigate(`/tournament/${t.id}`)}
                className="glass-panel hover-glow" 
                style={{ padding: '20px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '15px' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'white', margin: 0 }}>{t.name}</h3>
                  <span style={{ background: t.status === 'waiting' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)', color: t.status === 'waiting' ? '#60a5fa' : '#34d399', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold', border: t.status === 'waiting' ? '1px solid #3b82f6' : '1px solid #10b981' }}>
                    {t.status === 'waiting' ? 'Inscrições Abertas' : 'Em Andamento'}
                  </span>
                </div>
                
                <div style={{ display: 'flex', gap: '15px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <LayoutGrid size={16} /> {t.gameType === 'chess' ? 'Xadrez' : 'Damas'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Trophy size={16} /> {t.format === 'knockout' ? 'Mata-mata' : 'Pontos Corridos'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Users size={16} /> {t.participants?.length || 0}/{t.maxPlayers}
                  </div>
                </div>
                
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Criado por: <strong style={{ color: 'var(--accent-glow)' }}>{t.creatorName}</strong>
                </div>
              </div>
            ))
          )}
        </div>

        {finishedTournaments.length > 0 && (
          <>
            <h2 style={{ fontSize: '1.2rem', margin: '20px 0 10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Trophy size={20} color="gold" /> Torneios Finalizados
            </h2>
            <div style={{ display: 'grid', gap: '15px', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
              {finishedTournaments.map(t => (
                <div 
                  key={t.id} 
                  onClick={() => navigate(`/tournament/${t.id}`)}
                  className="glass-panel hover-glow" 
                  style={{ padding: '20px', cursor: 'pointer', opacity: 0.7 }}
                >
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'white', marginBottom: '10px' }}>{t.name}</h3>
                  <div style={{ display: 'flex', gap: '15px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    <span>{t.gameType === 'chess' ? 'Xadrez' : 'Damas'}</span>
                    <span>&bull;</span>
                    <span>{t.participants?.length || 0} jogadores</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

      </main>

      {/* Modal de Criação */}
      {showCreateModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '30px' }}>
            <h2 style={{ marginBottom: '20px', textAlign: 'center', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <Trophy size={24} color="var(--accent-color)" /> Novo Torneio
            </h2>
            
            <form onSubmit={handleCreateTournament} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Nome do Torneio</label>
                <input 
                  type="text" 
                  className="input-modern" 
                  value={newTourneyName}
                  onChange={(e) => setNewTourneyName(e.target.value)}
                  placeholder="Ex: Taça de Inverno"
                  required
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Jogo</label>
                <select className="input-modern" value={newTourneyGame} onChange={(e) => setNewTourneyGame(e.target.value)} style={{ cursor: 'pointer' }}>
                  <option value="chess">Xadrez</option>
                  <option value="checkers">Damas</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Formato</label>
                <select className="input-modern" value={newTourneyFormat} onChange={(e) => setNewTourneyFormat(e.target.value)} style={{ cursor: 'pointer' }}>
                  <option value="knockout">Mata-mata (Eliminação)</option>
                  <option value="round_robin">Pontos Corridos (Todos contra todos)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Máximo de Jogadores</label>
                <select className="input-modern" value={newTourneyMaxPlayers} onChange={(e) => setNewTourneyMaxPlayers(e.target.value)} style={{ cursor: 'pointer' }}>
                  <option value="4">4 Jogadores</option>
                  <option value="8">8 Jogadores</option>
                  <option value="16">16 Jogadores</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn" style={{ flex: 1, background: 'transparent', border: '1px solid var(--danger-color)', color: 'var(--danger-color)' }}>
                  Cancelar
                </button>
                <button type="submit" className="btn" style={{ flex: 1, background: 'var(--success-color)', border: 'none' }}>
                  Criar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
