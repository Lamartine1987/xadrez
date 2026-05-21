import { useState, useEffect } from 'react';

export const THEMES = {
  classic: {
    id: 'classic',
    name: 'Clássico',
    dark: '#475569',
    light: '#cbd5e1'
  },
  wood: {
    id: 'wood',
    name: 'Madeira Clássica',
    dark: '#b58863',
    light: '#f0d9b5'
  },
  emerald: {
    id: 'emerald',
    name: 'Esmeralda',
    dark: '#739552',
    light: '#ebecd0'
  },
  midnight: {
    id: 'midnight',
    name: 'Meia-Noite',
    dark: '#2c3e50',
    light: '#bdc3c7'
  }
};

export const PIECE_THEMES = [
  { id: 'standard', name: 'Padrão (Padrão do Xadrez)' },
  { id: 'anarcandy', name: 'Anarcandy' },
  { id: 'cardinal', name: 'Cardinal' },
  { id: 'celtic', name: 'Celtic' },
  { id: 'cooke', name: 'Cooke' },
  { id: 'dubrovny', name: 'Dubrovny' },
  { id: 'fantasy', name: 'Fantasy' },
  { id: 'firi', name: 'Firi' },
  { id: 'horsey', name: 'Horsey' },
  { id: 'kosal', name: 'Kosal' }
];

export function useBoardTheme() {
  const [themeId, setThemeId] = useState(() => {
    return localStorage.getItem('chessTheme') || 'classic';
  });

  const [pieceTheme, setPieceTheme] = useState(() => {
    return localStorage.getItem('chessPieceTheme') || 'standard';
  });

  useEffect(() => {
    localStorage.setItem('chessTheme', themeId);
  }, [themeId]);

  useEffect(() => {
    localStorage.setItem('chessPieceTheme', pieceTheme);
  }, [pieceTheme]);

  const currentTheme = THEMES[themeId] || THEMES.classic;

  const getCustomPieces = () => {
    if (pieceTheme === 'standard') return undefined; // usa as originais do react-chessboard
    
    const pieces = ['wP', 'wR', 'wN', 'wB', 'wQ', 'wK', 'bP', 'bR', 'bN', 'bB', 'bQ', 'bK'];
    const customPieces = {};
    
    pieces.forEach(piece => {
      customPieces[piece] = ({ squareWidth }) => (
        <div style={{ width: squareWidth, height: squareWidth, backgroundImage: `url(/pieces/${pieceTheme}/${piece}.svg)`, backgroundSize: '100%', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }} />
      );
    });
    
    return customPieces;
  };

  return {
    themeId,
    setThemeId,
    pieceTheme,
    setPieceTheme,
    themeStyles: {
      customDarkSquareStyle: { backgroundColor: currentTheme.dark },
      customLightSquareStyle: { backgroundColor: currentTheme.light },
      customPieces: getCustomPieces()
    },
    availableThemes: Object.values(THEMES),
    availablePieceThemes: PIECE_THEMES
  };
}
