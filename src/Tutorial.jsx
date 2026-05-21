import { useState, useRef, useEffect } from 'react';
import { db } from './firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { BookOpen, ChevronRight, ChevronLeft, Play, Star } from 'lucide-react';

const lessons = [
  {
    title: 'O Movimento do Peão',
    description: 'Peões se movem uma casa para frente, mas no primeiro movimento podem pular duas casas. Eles capturam na diagonal!',
    moves: ['e4', 'c5', 'e5', 'd5', 'exd6']
  },
  {
    title: 'A Força da Rainha',
    description: 'A Rainha é a peça mais poderosa! Ela se move em qualquer direção: vertical, horizontal ou diagonal.',
    moves: ['e4', 'e5', 'Qh5', 'Nf6', 'Qxe5+', 'Be7']
  },
  {
    title: 'O Salto do Cavalo',
    description: 'O Cavalo é a única peça que pode pular as outras! Ele se move no formato de um "L".',
    moves: ['Nf3', 'Nf6', 'Nc3', 'Nc6', 'Nd5', 'Nxd5']
  },
  {
    title: 'O Roque (Proteção)',
    description: 'O único momento em que duas peças se movem ao mesmo tempo! O Rei se esconde em segurança e a Torre vem para o centro.',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O']
  },
  {
    title: 'Mate do Pastor (A Armadilha)',
    description: 'Um dos xeques-mates mais rápidos do xadrez! A Rainha e o Bispo atacam juntos o peão mais fraco do adversário.',
    moves: ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#']
  }
];

export default function Tutorial({ user }) {
  const [currentLesson, setCurrentLesson] = useState(0);
  const [game, setGame] = useState(new Chess());
  const [isPlaying, setIsPlaying] = useState(false);
  const [completedLessons, setCompletedLessons] = useState([]);
  
  const isPlayingRef = useRef(false);
  const lesson = lessons[currentLesson];

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isPlayingRef.current = false;
    };
  }, []);

  const rewardStars = async () => {
    if (completedLessons.includes(currentLesson)) return;
    setCompletedLessons(prev => [...prev, currentLesson]);
    
    if (user) {
      try {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const currentStars = snap.data().stars || 0;
          await updateDoc(userRef, { stars: currentStars + 5 });
        }
      } catch (err) {
        console.error("Erro ao dar estrelas:", err);
      }
    }
  };

  const startAnimation = async () => {
    if (isPlayingRef.current) return;
    
    isPlayingRef.current = true;
    setIsPlaying(true);
    
    let activeGame = new Chess();
    setGame(new Chess(activeGame.fen()));

    for (let i = 0; i < lesson.moves.length; i++) {
      if (!isPlayingRef.current) break;
      await new Promise(resolve => setTimeout(resolve, 1500));
      if (!isPlayingRef.current) break;
      
      try {
        activeGame.move(lesson.moves[i]);
        setGame(new Chess(activeGame.fen())); 
      } catch (e) {
        console.error("Erro no movimento:", e);
      }
    }

    if (isPlayingRef.current) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      rewardStars();
    }
  };

  const handleNextLesson = () => {
    if (currentLesson < lessons.length - 1) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      setCurrentLesson(c => c + 1);
      setGame(new Chess());
    }
  };

  const handlePrevLesson = () => {
    if (currentLesson > 0) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      setCurrentLesson(c => c - 1);
      setGame(new Chess());
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', padding: '16px', maxWidth: '600px', margin: '0 auto', minHeight: '120vh' }}>
      
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '20px', marginTop: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-color)' }}>
          <BookOpen size={24} />
          <span style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>Treinamento Base</span>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '20px', marginBottom: '10px', textAlign: 'center', position: 'relative' }}>
        {completedLessons.includes(currentLesson) && (
          <div style={{ position: 'absolute', top: 10, right: 10, color: '#fbbf24' }}>
            <Star size={20} fill="#fbbf24" />
          </div>
        )}
        <h2 style={{ color: 'var(--text-main)', marginBottom: '10px' }}>{lesson.title}</h2>
        <p style={{ color: 'var(--text-muted)' }}>{lesson.description}</p>
      </div>

      <div style={{ textAlign: 'center', color: 'var(--success-color)', fontSize: '10px', marginBottom: '10px', wordBreak: 'break-all' }}>
        Memória: {game.fen().split(' ')[0]}
      </div>

      <div style={{ width: '100%', aspectRatio: '1 / 1', marginBottom: '20px', boxShadow: 'var(--glass-shadow)', borderRadius: '4px', overflow: 'hidden' }}>
        <Chessboard 
          position={game.fen()} 
          boardOrientation="white"
          animationDuration={300}
          customDarkSquareStyle={{ backgroundColor: '#475569' }}
          customLightSquareStyle={{ backgroundColor: '#cbd5e1' }}
          onPieceDrop={() => false}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '20px' }}>
        <button 
          onClick={startAnimation} 
          className="btn" 
          style={{ width: '100%', background: 'var(--success-color)' }}
          disabled={isPlaying}
        >
          <Play size={20} />
          {isPlaying ? 'Animando...' : 'Animar Movimento'}
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '20px' }}>
        <button 
          onClick={handlePrevLesson} 
          className="btn" 
          style={{ background: 'var(--bg-color-lighter)' }}
          disabled={currentLesson === 0 || isPlaying}
        >
          <ChevronLeft size={20} /> Anterior
        </button>
        
        <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
          {currentLesson + 1} de {lessons.length}
        </span>

        <button 
          onClick={handleNextLesson} 
          className="btn" 
          disabled={currentLesson === lessons.length - 1 || isPlaying}
        >
          Próxima <ChevronRight size={20} />
        </button>
      </div>

    </div>
  );
}
