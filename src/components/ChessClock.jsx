import React, { useState, useEffect } from 'react';

// timeMs = tempo restante salvo no banco de dados em milissegundos
// active = se é o turno deste jogador (o relógio deve rodar)
// lastMoveAt = timestamp do firebase de quando a última jogada ocorreu
export default function ChessClock({ timeMs, active, lastMoveAt, onTimeUp }) {
  const [displayTime, setDisplayTime] = useState(timeMs);

  useEffect(() => {
    if (!timeMs) return;

    if (!active || !lastMoveAt) {
      setDisplayTime(timeMs);
      return;
    }

    // Calcular o offset inicial
    const calculateRemaining = () => {
       const now = Date.now();
       const elapsed = now - lastMoveAt.toMillis();
       const remaining = timeMs - elapsed;
       return remaining > 0 ? remaining : 0;
    };

    setDisplayTime(calculateRemaining());

    const interval = setInterval(() => {
      const remaining = calculateRemaining();
      setDisplayTime(remaining);
      
      if (remaining <= 0) {
        clearInterval(interval);
        if (onTimeUp) onTimeUp();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [timeMs, active, lastMoveAt, onTimeUp]);

  if (!timeMs) return null; // Não renderiza se o jogo for sem tempo

  const seconds = Math.ceil(displayTime / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  
  const formatted = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  
  const isDanger = seconds <= 30; // Fica vermelho nos últimos 30 segundos

  return (
    <div style={{
      background: active ? (isDanger ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.2)') : 'rgba(0,0,0,0.3)',
      color: active ? (isDanger ? '#ef4444' : 'white') : 'var(--text-muted)',
      padding: '4px 12px',
      borderRadius: '4px',
      fontFamily: 'monospace',
      fontWeight: 'bold',
      fontSize: '1.1rem',
      letterSpacing: '1px',
      border: active ? (isDanger ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.5)') : '1px solid transparent',
      transition: 'all 0.3s ease',
      boxShadow: active ? '0 0 10px rgba(255,255,255,0.1)' : 'none'
    }}>
      {formatted}
    </div>
  );
}
