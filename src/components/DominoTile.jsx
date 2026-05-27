import React from 'react';

const Dot = ({ cx, cy, r }) => <circle cx={cx} cy={cy} r={r} fill="#1e293b" />;

const drawDots = (value, size) => {
  const r = size * 0.08;
  const c = size / 2;
  const o = size * 0.25;
  const o2 = size * 0.75;
  
  const dots = [];
  if (value === 1 || value === 3 || value === 5) {
    dots.push(<Dot key="c" cx={c} cy={c} r={r} />);
  }
  if (value > 1) {
    dots.push(<Dot key="tl" cx={o} cy={o} r={r} />);
    dots.push(<Dot key="br" cx={o2} cy={o2} r={r} />);
  }
  if (value > 3) {
    dots.push(<Dot key="tr" cx={o2} cy={o} r={r} />);
    dots.push(<Dot key="bl" cx={o} cy={o2} r={r} />);
  }
  if (value === 6) {
    dots.push(<Dot key="ml" cx={o} cy={c} r={r} />);
    dots.push(<Dot key="mr" cx={o2} cy={c} r={r} />);
  }
  return dots;
};

export default function DominoTile({ 
  tile, 
  orientation = 'vertical', // 'vertical' or 'horizontal'
  onClick, 
  selected = false,
  highlight = false,
  hidden = false,
  size = 60,
  style = {}
}) {
  const width = orientation === 'vertical' ? size : size * 2;
  const height = orientation === 'vertical' ? size * 2 : size;
  const halfSize = size;

  if (hidden) {
    return (
      <div 
        style={{ 
          width, 
          height, 
          background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', 
          borderRadius: '8px', 
          border: '2px solid rgba(255,255,255,0.2)',
          boxShadow: '2px 2px 5px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...style 
        }}
      >
         <div style={{ width: '80%', height: '80%', border: '2px dashed rgba(255,255,255,0.3)', borderRadius: '4px' }}></div>
      </div>
    );
  }

  const [top, bottom] = tile;

  return (
    <div 
      onClick={onClick}
      style={{ 
        width, 
        height, 
        background: '#f8fafc', 
        borderRadius: '8px', 
        boxShadow: selected ? '0 0 0 4px var(--accent-color)' : (highlight ? '0 0 0 3px var(--success-color)' : '2px 2px 5px rgba(0,0,0,0.5)'),
        cursor: onClick ? 'pointer' : 'default',
        transform: selected ? 'translateY(-10px)' : 'none',
        transition: 'transform 0.2s',
        display: 'flex',
        flexDirection: orientation === 'vertical' ? 'column' : 'row',
        overflow: 'hidden',
        border: '1px solid #cbd5e1',
        ...style 
      }}
    >
      <svg width={orientation === 'vertical' ? size : size} height={orientation === 'vertical' ? size : size}>
        {drawDots(top, halfSize)}
      </svg>
      <div style={{ 
        background: '#94a3b8', 
        width: orientation === 'vertical' ? '100%' : '2px', 
        height: orientation === 'vertical' ? '2px' : '100%' 
      }}></div>
      <svg width={orientation === 'vertical' ? size : size} height={orientation === 'vertical' ? size : size}>
        {drawDots(bottom, halfSize)}
      </svg>
    </div>
  );
}
