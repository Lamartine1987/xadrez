import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from './firebase';
import { doc, onSnapshot, updateDoc, arrayUnion, setDoc, collection, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { Trophy, ArrowLeft, Users, Play, Calendar, UserPlus, Trash2 } from 'lucide-react';

export default function TournamentDetails({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'tournaments', id), (docSnap) => {
      if (docSnap.exists()) {
        setTournament({ id: docSnap.id, ...docSnap.data() });
      } else {
        setTournament(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [id]);

  const handleJoin = async () => {
    if (!tournament || tournament.participants.includes(user.uid) || tournament.participants.length >= tournament.maxPlayers) return;
    try {
      await updateDoc(doc(db, 'tournaments', id), {
        participants: arrayUnion(user.uid),
        participantDetails: arrayUnion({ uid: user.uid, name: user.displayName || user.email.split('@')[0] })
      });
    } catch (err) {
      console.error("Erro ao entrar no torneio:", err);
    }
  };

  const generateKnockoutMatches = async (players) => {
    // Embaralhar jogadores
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    // Para simplificar, assumimos que o número de jogadores seja preenchido até potência de 2
    let powerOf2 = 2;
    while (powerOf2 < shuffled.length) powerOf2 *= 2;
    
    // Adicionar "byes" (null) se necessário
    while (shuffled.length < powerOf2) {
      shuffled.push(null);
    }

    const rounds = [];
    let currentRoundPlayers = [...shuffled];
    let matchIdCounter = 1;
    let roundIndex = 1;
    let prevRoundMatches = [];

    const dbGamesToCreate = [];
    const tournamentRounds = [];

    while (currentRoundPlayers.length > 1) {
      const nextRoundPlayers = [];
      const currentRoundMatches = [];

      for (let i = 0; i < currentRoundPlayers.length; i += 2) {
        const p1 = currentRoundPlayers[i];
        const p2 = currentRoundPlayers[i + 1];
        
        const isFirstRound = roundIndex === 1;
        const gameCode = Math.random().toString(36).substring(2, 6).toUpperCase() + matchIdCounter;
        
        // Se ambos são null, ou um é null (bye), a lógica de avanço de bye pode ser complexa.
        // Assumiremos que o usuário não pode jogar contra "Bye", então ele ganha automaticamente,
        // mas para simplificar, vamos salvar a partida no banco de qualquer jeito, 
        // e no app mostrar "Aguardando Vencedor" se não tiver player.
        
        const matchData = {
          gameId: gameCode,
          matchId: matchIdCounter,
          round: roundIndex,
          p1: p1 || { uid: null, name: isFirstRound ? 'Bye' : `Vencedor Jogo ${prevRoundMatches[i]?.matchId}` },
          p2: p2 || { uid: null, name: isFirstRound ? 'Bye' : `Vencedor Jogo ${prevRoundMatches[i+1]?.matchId}` },
          status: (p1 && p1.uid && p2 && p2.uid) ? 'ready' : 'waiting_players',
          winner: null
        };
        
        currentRoundMatches.push(matchData);
        nextRoundPlayers.push(null); // Placeholders para a próxima rodada
        
        // Preparar Game Doc no Firebase APENAS se tiver ambos jogadores (ou se for round_robin)
        // No mata-mata, criaremos os jogos vazios para preencher depois
        dbGamesToCreate.push({
          code: gameCode,
          data: {
            tournamentId: id,
            tournamentMatchId: matchIdCounter,
            gameType: tournament.gameType,
            players: {
              white: matchData.p1.uid || 'wait', whiteName: matchData.p1.name, whiteElo: 1200,
              black: matchData.p2.uid || 'wait', blackName: matchData.p2.name, blackElo: 1200
            },
            status: matchData.status === 'ready' ? 'playing' : 'waiting',
            fen: 'start',
            history: [],
            timeControl: 0,
            whiteTime: 0, blackTime: 0,
            createdAt: serverTimestamp(),
            participantIds: [matchData.p1.uid, matchData.p2.uid].filter(Boolean)
          }
        });
        
        matchIdCounter++;
      }
      
      tournamentRounds.push(currentRoundMatches);
      prevRoundMatches = currentRoundMatches;
      currentRoundPlayers = nextRoundPlayers;
      roundIndex++;
    }

    return { dbGamesToCreate, tournamentRounds };
  };

  const generateRoundRobinMatches = async (players) => {
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    if (shuffled.length % 2 !== 0) {
      shuffled.push({ uid: null, name: 'Bye' });
    }
    
    const numPlayers = shuffled.length;
    const roundsCount = numPlayers - 1;
    const half = numPlayers / 2;
    
    const dbGamesToCreate = [];
    const tournamentRounds = [];
    let matchIdCounter = 1;

    let playerList = [...shuffled];
    playerList.splice(1, 0); // Keep first element fixed

    for (let r = 0; r < roundsCount; r++) {
      const currentRoundMatches = [];
      for (let i = 0; i < half; i++) {
        const p1 = playerList[i];
        const p2 = playerList[numPlayers - 1 - i];
        
        if (p1.uid !== null && p2.uid !== null) {
          const gameCode = Math.random().toString(36).substring(2, 6).toUpperCase() + matchIdCounter;
          const matchData = {
            gameId: gameCode,
            matchId: matchIdCounter,
            round: r + 1,
            p1: p1,
            p2: p2,
            status: 'ready',
            winner: null
          };
          currentRoundMatches.push(matchData);
          
          dbGamesToCreate.push({
            code: gameCode,
            data: {
              tournamentId: id,
              tournamentMatchId: matchIdCounter,
              gameType: tournament.gameType,
              players: {
                white: p1.uid, whiteName: p1.name, whiteElo: 1200,
                black: p2.uid, blackName: p2.name, blackElo: 1200
              },
              status: 'playing',
              fen: 'start',
              history: [],
              timeControl: 0,
              whiteTime: 0, blackTime: 0,
              createdAt: serverTimestamp(),
              participantIds: [p1.uid, p2.uid]
            }
          });
          matchIdCounter++;
        }
      }
      tournamentRounds.push(currentRoundMatches);
      
      // Rotate array, keeping first fixed
      const last = playerList.pop();
      playerList.splice(1, 0, last);
    }
    
    return { dbGamesToCreate, tournamentRounds };
  };

  const handleStartTournament = async () => {
    if (!tournament || tournament.creator !== user.uid || starting) return;
    setStarting(true);
    
    try {
      const players = tournament.participantDetails;
      let generationResult;
      
      if (tournament.format === 'knockout') {
        generationResult = await generateKnockoutMatches(players);
      } else {
        generationResult = await generateRoundRobinMatches(players);
      }
      
      // Save games to Firestore
      for (const game of generationResult.dbGamesToCreate) {
        await setDoc(doc(db, 'games', game.code), game.data);
      }
      
      // Update tournament
      await updateDoc(doc(db, 'tournaments', id), {
        status: 'in_progress',
        matches: generationResult.tournamentRounds.flat(),
        startedAt: serverTimestamp()
      });
      
    } catch (err) {
      console.error("Erro ao iniciar torneio:", err);
      alert("Houve um erro ao iniciar.");
    } finally {
      setStarting(false);
    }
  };

  const handleDeleteTournament = async () => {
    if (!window.confirm("Tem certeza que deseja excluir este torneio permanentemente?")) return;
    try {
      await deleteDoc(doc(db, 'tournaments', id));
      navigate('/tournaments');
    } catch(err) {
      console.error("Erro ao excluir torneio:", err);
      alert("Erro ao excluir torneio.");
    }
  };

  if (loading) {
    return <div style={{ color: 'white', padding: '40px', textAlign: 'center' }}>Carregando torneio...</div>;
  }

  if (!tournament) {
    return <div style={{ color: 'white', padding: '40px', textAlign: 'center' }}>Torneio não encontrado.</div>;
  }

  const isCreator = user.uid === tournament.creator;
  const isParticipant = tournament.participants.includes(user.uid);
  const isFull = tournament.participants.length >= tournament.maxPlayers;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-color)', color: 'var(--text-main)', paddingBottom: '90px' }}>
      <header style={{ padding: '15px 20px', display: 'flex', alignItems: 'center', background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid var(--glass-border)', position: 'sticky', top: 0, zIndex: 100 }}>
        <button onClick={() => navigate('/tournaments')} className="btn" style={{ padding: '8px 12px', background: 'transparent', border: '1px solid var(--glass-border)' }}>
          <ArrowLeft size={18} /> Voltar
        </button>
        <div style={{ marginLeft: '15px', display: 'flex', flexDirection: 'column', flex: 1 }}>
          <span style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'white' }}>{tournament.name}</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--accent-color)' }}>{tournament.format === 'knockout' ? 'Mata-mata' : 'Pontos Corridos'}</span>
        </div>
        {isCreator && (
          <button onClick={handleDeleteTournament} className="btn" style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#fca5a5', display: 'flex', gap: '8px', alignItems: 'center' }} title="Excluir Torneio">
            <Trash2 size={16} /> <span className="hide-mobile">Excluir</span>
          </button>
        )}
      </header>

      <main style={{ flex: 1, padding: '20px', maxWidth: '900px', margin: '0 auto', width: '100%' }}>
        {tournament.status === 'waiting' && (
          <div className="glass-panel" style={{ padding: '30px', textAlign: 'center' }}>
            <Calendar size={48} color="var(--accent-color)" style={{ margin: '0 auto 15px' }} />
            <h2 style={{ fontSize: '1.5rem', color: 'white', marginBottom: '10px' }}>Inscrições Abertas</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>Aguardando o organizador iniciar o torneio.</p>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '30px' }}>
              <Users size={20} color="var(--text-muted)" />
              <span style={{ fontSize: '1.1rem' }}>{tournament.participants.length} / {tournament.maxPlayers} Jogadores</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '300px', margin: '0 auto' }}>
              {!isParticipant && !isFull && (
                <button onClick={handleJoin} className="btn" style={{ width: '100%', justifyContent: 'center', background: 'var(--success-color)', border: 'none' }}>
                  <UserPlus size={20} /> Entrar no Torneio
                </button>
              )}
              {isCreator && (
                <button onClick={handleStartTournament} disabled={starting || tournament.participants.length < 2} className="btn" style={{ width: '100%', justifyContent: 'center', background: 'var(--accent-color)', border: 'none' }}>
                  <Play size={20} /> {starting ? 'Iniciando...' : 'Iniciar Torneio Agora'}
                </button>
              )}
            </div>

            <div style={{ marginTop: '40px', textAlign: 'left' }}>
              <h3 style={{ fontSize: '1.2rem', color: 'white', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px', marginBottom: '15px' }}>Inscritos</h3>
              <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                {tournament.participantDetails?.map(p => (
                  <li key={p.uid} style={{ background: 'rgba(255,255,255,0.05)', padding: '10px 15px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                    {p.name} {p.uid === tournament.creator && <span style={{ color: 'var(--accent-color)', fontSize: '0.8rem', marginLeft: '5px' }}>(Org)</span>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {tournament.status !== 'waiting' && (
          <div>
            <h2 style={{ fontSize: '1.5rem', color: 'white', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Trophy size={24} color="#fbbf24" /> Chaveamento / Partidas
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              {Array.from(new Set((tournament.matches || []).map(m => m.round))).sort((a,b)=>a-b).map((roundNumber) => {
                const roundMatches = (tournament.matches || []).filter(m => m.round === roundNumber);
                return (
                <div key={roundNumber} className="glass-panel" style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '1.1rem', color: 'var(--accent-color)', marginBottom: '15px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' }}>
                    Rodada {roundNumber}
                  </h3>
                  <div style={{ display: 'grid', gap: '15px', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                    {roundMatches.map(match => {
                      const isMyMatch = match.p1?.uid === user.uid || match.p2?.uid === user.uid;
                      
                      return (
                        <div key={match.matchId} style={{ background: isMyMatch ? 'rgba(59, 130, 246, 0.1)' : 'rgba(0,0,0,0.2)', border: isMyMatch ? '1px solid var(--accent-color)' : '1px solid var(--glass-border)', padding: '15px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Jogo #{match.matchId}</span>
                            {match.status === 'finished' && <span style={{ color: 'var(--success-color)', fontWeight: 'bold' }}>Finalizado</span>}
                            {match.status === 'ready' && <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>Pendente</span>}
                            {match.status === 'waiting_players' && <span style={{ color: 'var(--text-muted)' }}>Aguardando...</span>}
                          </div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', background: match.winner === match.p1?.uid ? 'rgba(16, 185, 129, 0.2)' : 'transparent', padding: '5px 10px', borderRadius: '6px' }}>
                              <span style={{ fontWeight: match.p1?.uid ? 'bold' : 'normal', color: match.p1?.uid ? 'white' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {match.winner === match.p1?.uid && <Trophy size={14} color="var(--success-color)" />}
                                {match.p1?.name || 'TBD'}
                              </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', background: match.winner === match.p2?.uid ? 'rgba(16, 185, 129, 0.2)' : 'transparent', padding: '5px 10px', borderRadius: '6px' }}>
                              <span style={{ fontWeight: match.p2?.uid ? 'bold' : 'normal', color: match.p2?.uid ? 'white' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {match.winner === match.p2?.uid && <Trophy size={14} color="var(--success-color)" />}
                                {match.p2?.name || 'TBD'}
                              </span>
                            </div>
                          </div>

                          {isMyMatch && match.status === 'ready' && (
                            <button onClick={() => navigate(`/game/${match.gameId}`)} className="btn" style={{ width: '100%', justifyContent: 'center', background: 'var(--accent-color)', color: 'white', marginTop: '5px' }}>
                              <Play size={16} /> Entrar na Partida
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )})}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
