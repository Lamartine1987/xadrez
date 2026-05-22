import React from 'react';

const ICONS = {
  p: '♟',
  n: '♞',
  b: '♝',
  r: '♜',
  q: '♛'
};

// color: 'white' (peças brancas) ou 'black' (peças pretas)
export default function CapturedPieces({ captured, advantage, color }) {
  if (captured.length === 0 && advantage === 0) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '24px' }}>
      <div style={{ display: 'flex', fontSize: '1rem', color: color === 'white' ? '#f8fafc' : '#0f172a', textShadow: color === 'white' ? '0 1px 2px rgba(0,0,0,0.8)' : '0 1px 1px rgba(255,255,255,0.8)' }}>
        {captured.map((piece, i) => (
          <span key={i} style={{ marginLeft: i > 0 ? '-6px' : '0' }}>
            {ICONS[piece]}
          </span>
        ))}
      </div>
      {advantage > 0 && (
        <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#10b981', marginLeft: '4px' }}>
          +{advantage}
        </span>
      )}
    </div>
  );
}
