export class CheckersGame {
  constructor() {
    this.reset();
  }

  reset() {
    this.board = Array(8).fill(null).map(() => Array(8).fill(null));
    
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if ((r + c) % 2 !== 0) {
          if (r < 3) this.board[r][c] = 'b';
          else if (r > 4) this.board[r][c] = 'w';
        }
      }
    }
    
    this.turn = 'w';
    this.history = [];
    this.winner = null;
    this.mustJumpFrom = null; // Used when a piece makes a jump and has another jump
  }

  load(state) {
    this.board = JSON.parse(JSON.stringify(state.board));
    this.turn = state.turn;
    this.winner = state.winner;
    this.history = [...(state.history || [])];
    this.mustJumpFrom = state.mustJumpFrom || null;
  }

  getState() {
    return {
      board: JSON.parse(JSON.stringify(this.board)),
      turn: this.turn,
      winner: this.winner,
      history: [...this.history],
      mustJumpFrom: this.mustJumpFrom
    };
  }

  getAllValidMoves(player = this.turn) {
    let moves = [];
    let jumpMoves = [];

    // If forced to jump from a specific piece (multi-jump rule)
    if (this.mustJumpFrom && player === this.turn) {
       const piece = this.board[this.mustJumpFrom.r][this.mustJumpFrom.c];
       if (piece) {
         return this.getValidJumps(this.mustJumpFrom.r, this.mustJumpFrom.c, piece);
       }
    }

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r][c];
        if (piece && piece.toLowerCase() === player) {
          const pieceJumps = this.getValidJumps(r, c, piece);
          if (pieceJumps.length > 0) {
            jumpMoves.push(...pieceJumps);
          } else if (jumpMoves.length === 0) {
            moves.push(...this.getNormalMoves(r, c, piece));
          }
        }
      }
    }

    return jumpMoves.length > 0 ? jumpMoves : moves;
  }

  getNormalMoves(r, c, piece) {
    const moves = [];
    const dirs = this.getDirections(piece);

    for (let dir of dirs) {
      const nr = r + dir.dr;
      const nc = c + dir.dc;
      if (this.isValidSquare(nr, nc) && !this.board[nr][nc]) {
        moves.push({ from: { r, c }, to: { r: nr, c: nc }, isJump: false });
      }
    }
    return moves;
  }

  getValidJumps(r, c, piece) {
    const jumps = [];
    const dirs = this.getDirections(piece);

    for (let dir of dirs) {
      const nr = r + dir.dr;
      const nc = c + dir.dc;
      const jmpR = r + dir.dr * 2;
      const jmpC = c + dir.dc * 2;

      if (this.isValidSquare(jmpR, jmpC)) {
        const midPiece = this.board[nr][nc];
        const destPiece = this.board[jmpR][jmpC];
        
        if (midPiece && midPiece.toLowerCase() !== piece.toLowerCase() && !destPiece) {
           jumps.push({ from: { r, c }, to: { r: jmpR, c: jmpC }, isJump: true, captured: { r: nr, c: nc } });
        }
      }
    }
    return jumps;
  }

  getDirections(piece) {
    if (piece === 'w') return [{ dr: -1, dc: -1 }, { dr: -1, dc: 1 }];
    if (piece === 'b') return [{ dr: 1, dc: -1 }, { dr: 1, dc: 1 }];
    return [{ dr: -1, dc: -1 }, { dr: -1, dc: 1 }, { dr: 1, dc: -1 }, { dr: 1, dc: 1 }];
  }

  isValidSquare(r, c) {
    return r >= 0 && r <= 7 && c >= 0 && c <= 7;
  }

  move(fromR, fromC, toR, toC) {
    const allMoves = this.getAllValidMoves();
    const move = allMoves.find(m => m.from.r === fromR && m.from.c === fromC && m.to.r === toR && m.to.c === toC);
    
    if (!move) return false;

    const piece = this.board[fromR][fromC];
    this.board[toR][toC] = piece;
    this.board[fromR][fromC] = null;

    if (move.isJump) {
      this.board[move.captured.r][move.captured.c] = null;
    }

    let madeKing = false;
    if (piece === 'w' && toR === 0) {
      this.board[toR][toC] = 'W';
      madeKing = true;
    } else if (piece === 'b' && toR === 7) {
      this.board[toR][toC] = 'B';
      madeKing = true;
    }

    this.mustJumpFrom = null;

    let hasAnotherJump = false;
    if (move.isJump && !madeKing) {
      const moreJumps = this.getValidJumps(toR, toC, this.board[toR][toC]);
      if (moreJumps.length > 0) {
        hasAnotherJump = true;
        this.mustJumpFrom = { r: toR, c: toC };
      }
    }

    if (!hasAnotherJump) {
      this.turn = this.turn === 'w' ? 'b' : 'w';
    }

    const colToChar = (c) => String.fromCharCode(97 + c).toUpperCase();
    const rowToChar = (r) => (8 - r).toString();
    const notation = `${colToChar(fromC)}${rowToChar(fromR)}${move.isJump ? 'x' : '-'}${colToChar(toC)}${rowToChar(toR)}`;

    this.history.push({ from: move.from, to: move.to, piece, isJump: move.isJump, madeKing, notation });
    this.checkWinner();

    return true;
  }

  checkWinner() {
    const nextMoves = this.getAllValidMoves(this.turn);
    if (nextMoves.length === 0) {
       this.winner = this.turn === 'w' ? 'b' : 'w';
    }
  }

  isGameOver() {
    return this.winner !== null;
  }

  // Very simple evaluation function for Checkers
  evaluate(player) {
    let score = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r][c];
        if (piece) {
           const val = (piece === 'W' || piece === 'B') ? 3 : 1;
           if (piece.toLowerCase() === player) {
              score += val;
           } else {
              score -= val;
           }
        }
      }
    }
    return score;
  }

  // Simple Minimax
  getBestMove(depth, player) {
    let bestScore = -Infinity;
    let bestMove = null;
    
    const moves = this.getAllValidMoves(player);
    if (moves.length === 0) return null;

    // To prevent playing the same move predictably, shuffle moves
    moves.sort(() => Math.random() - 0.5);

    for (let move of moves) {
      const stateBackup = this.getState();
      
      this.move(move.from.r, move.from.c, move.to.r, move.to.c);
      
      let score;
      if (this.mustJumpFrom) {
         // Multi-jump, keep going on same turn (depth doesn't decrease)
         const nextJump = this.getBestMove(depth, player);
         if (nextJump) {
            score = nextJump.score;
         } else {
            score = this.minimax(depth - 1, false, player);
         }
      } else {
         score = this.minimax(depth - 1, false, player);
      }

      this.load(stateBackup);

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    return bestMove ? { move: bestMove, score: bestScore } : null;
  }

  minimax(depth, isMaximizing, player) {
    if (depth === 0 || this.isGameOver()) {
       return this.evaluate(player);
    }

    if (isMaximizing) {
       let bestScore = -Infinity;
       const moves = this.getAllValidMoves(this.turn);
       for (let move of moves) {
          const stateBackup = this.getState();
          this.move(move.from.r, move.from.c, move.to.r, move.to.c);
          
          let score;
          if (this.mustJumpFrom) {
            score = this.minimax(depth, true, player);
          } else {
            score = this.minimax(depth - 1, false, player);
          }
          
          this.load(stateBackup);
          bestScore = Math.max(bestScore, score);
       }
       return bestScore;
    } else {
       let bestScore = Infinity;
       const moves = this.getAllValidMoves(this.turn);
       for (let move of moves) {
          const stateBackup = this.getState();
          this.move(move.from.r, move.from.c, move.to.r, move.to.c);
          
          let score;
          if (this.mustJumpFrom) {
            score = this.minimax(depth, false, player);
          } else {
            score = this.minimax(depth - 1, true, player);
          }
          
          this.load(stateBackup);
          bestScore = Math.min(bestScore, score);
       }
       return bestScore;
    }
  }
}
