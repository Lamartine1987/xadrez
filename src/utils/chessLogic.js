export const PIECE_VALUES = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0
};

export const calculateMaterialAdvantage = (game) => {
  const board = game.board();
  
  const startingCounts = {
    p: 8, n: 2, b: 2, r: 2, q: 1
  };
  
  const currentCounts = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0 }
  };
  
  // Contagem de peças atuais no tabuleiro
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const piece = board[i][j];
      if (piece && piece.type !== 'k') {
        currentCounts[piece.color][piece.type]++;
      }
    }
  }
  
  const capturedByWhite = [];
  const capturedByBlack = [];
  
  let whiteScore = 0;
  let blackScore = 0;
  
  // Array com ordem de importância visual (Rainha primeiro, Peão por último)
  ['q', 'r', 'b', 'n', 'p'].forEach(type => {
    // Brancas capturaram peças pretas (Faltam peças pretas no tabuleiro)
    const blackMissing = startingCounts[type] - currentCounts.b[type];
    for (let i = 0; i < blackMissing; i++) {
      capturedByWhite.push(type);
      whiteScore += PIECE_VALUES[type];
    }
    
    // Pretas capturaram peças brancas (Faltam peças brancas no tabuleiro)
    const whiteMissing = startingCounts[type] - currentCounts.w[type];
    for (let i = 0; i < whiteMissing; i++) {
      capturedByBlack.push(type);
      blackScore += PIECE_VALUES[type];
    }
  });
  
  return {
    capturedByWhite, // ex: ['q', 'p', 'p']
    capturedByBlack,
    whiteAdvantage: whiteScore - blackScore > 0 ? whiteScore - blackScore : 0,
    blackAdvantage: blackScore - whiteScore > 0 ? blackScore - whiteScore : 0
  };
};
