import React, { useState, useEffect } from 'react';

export default function CheckersBoard({ 
  board, 
  onMove, 
  playerColor = 'w', 
  themeStyles = {}, 
  validMoves = [],
  turn = 'w',
  lastMove = null,
  showOptions = true
}) {
  const [selected, setSelected] = useState(null);

  // Clear selection if turn changes
  useEffect(() => {
     setSelected(null);
  }, [turn]);

  const lightColor = themeStyles.customLightSquareStyle?.backgroundColor || '#cbd5e1';
  const darkColor = themeStyles.customDarkSquareStyle?.backgroundColor || '#475569';

  const handleSquareClick = (r, c) => {
    if (turn !== playerColor && playerColor !== 'both') return;

    if (selected) {
      if (selected.r === r && selected.c === c) {
        setSelected(null);
        return;
      }
      
      const isMoveValid = validMoves.some(m => m.from.r === selected.r && m.from.c === selected.c && m.to.r === r && m.to.c === c);
      if (isMoveValid) {
        onMove(selected.r, selected.c, r, c);
        setSelected(null);
      } else {
         const piece = board[r][c];
         if (piece && piece.toLowerCase() === playerColor) {
           setSelected({ r, c });
         } else {
           setSelected(null);
         }
      }
    } else {
      const piece = board[r][c];
      if (piece && piece.toLowerCase() === playerColor) {
        setSelected({ r, c });
      }
    }
  };

  const renderPiece = (piece) => {
    if (!piece) return null;
    const isWhite = piece.toLowerCase() === 'w';
    const isKing = piece === 'W' || piece === 'B';
    
    const color = isWhite ? '#f8fafc' : '#1e293b';
    const borderColor = isWhite ? '#94a3b8' : '#0f172a';
    
    return (
      <div style={{
        width: '80%',
        height: '80%',
        borderRadius: '50%',
        backgroundColor: color,
        border: `3px solid ${borderColor}`,
        boxShadow: 'inset 0 -5px 10px rgba(0,0,0,0.2), 0 4px 6px rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative'
      }}>
        {isKing && <span style={{ color: isWhite ? '#0f172a' : '#f8fafc', fontSize: '1.5rem', fontWeight: 'bold' }}>♚</span>}
      </div>
    );
  };

  const renderSquare = (r, c) => {
    const isDark = (r + c) % 2 !== 0;
    const bgColor = isDark ? darkColor : lightColor;
    
    let isSelected = selected && selected.r === r && selected.c === c;
    let isPossibleMove = showOptions && selected && validMoves.some(m => m.from.r === selected.r && m.from.c === selected.c && m.to.r === r && m.to.c === c);
    let isLastMove = lastMove && ((lastMove.from.r === r && lastMove.from.c === c) || (lastMove.to.r === r && lastMove.to.c === c));

    return (
      <div 
        key={`${r}-${c}`}
        onClick={() => handleSquareClick(r, c)}
        style={{
          backgroundColor: bgColor,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          cursor: isDark ? 'pointer' : 'default'
        }}
      >
        {isLastMove && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255, 255, 0, 0.4)', zIndex: 1 }}></div>}
        {isSelected && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255, 255, 0, 0.4)', zIndex: 1 }}></div>}
        {isPossibleMove && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '30%', height: '30%', borderRadius: '50%', backgroundColor: 'rgba(0, 0, 0, 0.3)', zIndex: 2 }}></div>}
        
        <div style={{ zIndex: 3, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {renderPiece(board[r][c])}
        </div>
      </div>
    );
  };

  const grid = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      let logicR = r;
      let logicC = c;
      if (playerColor === 'b') {
        logicR = 7 - r;
        logicC = 7 - c;
      }
      grid.push(renderSquare(logicR, logicC));
    }
  }

  return (
    <div style={{ 
      width: '100%', 
      maxWidth: '800px',
      aspectRatio: '1 / 1', 
      display: 'grid', 
      gridTemplateColumns: 'repeat(8, 1fr)',
      gridTemplateRows: 'repeat(8, 1fr)',
      boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
      borderRadius: '4px',
      overflow: 'hidden',
      border: '4px solid #1e293b'
    }}>
      {grid}
    </div>
  );
}
