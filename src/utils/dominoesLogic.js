export class DominoesGame {
  constructor() {
    this.reset();
  }

  reset() {
    this.boneyard = this.generateTiles();
    this.shuffle(this.boneyard);
    
    this.hands = {
      w: this.boneyard.splice(0, 7),
      b: this.boneyard.splice(0, 7)
    };
    
    this.board = []; // Array of { left, right }
    this.leftValue = null;
    this.rightValue = null;
    
    this.turn = this.determineStartingPlayer();
    this.winner = null;
    this.isOver = false;
    this.history = [];
  }

  generateTiles() {
    const tiles = [];
    for (let i = 0; i <= 6; i++) {
      for (let j = i; j <= 6; j++) {
        tiles.push([i, j]);
      }
    }
    return tiles;
  }

  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  determineStartingPlayer() {
    let wMax = -1;
    let bMax = -1;
    for (const t of this.hands.w) {
      if (t[0] === t[1] && t[0] > wMax) wMax = t[0];
    }
    for (const t of this.hands.b) {
      if (t[0] === t[1] && t[0] > bMax) bMax = t[0];
    }
    if (wMax > -1 || bMax > -1) {
      return wMax > bMax ? 'w' : 'b';
    }
    let wSum = Math.max(...this.hands.w.map(t => t[0]+t[1]));
    let bSum = Math.max(...this.hands.b.map(t => t[0]+t[1]));
    return wSum >= bSum ? 'w' : 'b';
  }

  getState() {
    return {
      boneyard: [...this.boneyard],
      hands: {
        w: [...this.hands.w.map(t => [...t])],
        b: [...this.hands.b.map(t => [...t])]
      },
      board: [...this.board],
      leftValue: this.leftValue,
      rightValue: this.rightValue,
      turn: this.turn,
      winner: this.winner,
      isOver: this.isOver,
      history: [...this.history]
    };
  }

  load(state) {
    this.boneyard = state.boneyard;
    this.hands = state.hands;
    this.board = state.board;
    this.leftValue = state.leftValue;
    this.rightValue = state.rightValue;
    this.turn = state.turn;
    this.winner = state.winner;
    this.isOver = state.isOver;
    this.history = state.history;
  }

  getValidMoves(player) {
    if (this.isOver || this.turn !== player) return [];
    const hand = this.hands[player];
    
    if (this.board.length === 0) {
      return hand.map(t => ({ tile: t, end: 'first' }));
    }

    const moves = [];
    hand.forEach(t => {
      if (t[0] === this.leftValue || t[1] === this.leftValue) {
        moves.push({ tile: t, end: 'left' });
      }
      if (t[0] === this.rightValue || t[1] === this.rightValue) {
        moves.push({ tile: t, end: 'right' });
      }
    });
    return moves;
  }

  canPlay(player) {
    return this.getValidMoves(player).length > 0;
  }

  drawTile(player) {
    if (this.isOver || this.turn !== player) return false;
    if (this.boneyard.length === 0) return false;
    if (this.canPlay(player)) return false;

    const tile = this.boneyard.shift();
    this.hands[player].push(tile);
    this.history.push({ player, action: 'draw', tile });
    return true;
  }

  passTurn(player) {
    if (this.isOver || this.turn !== player) return false;
    if (this.canPlay(player) || this.boneyard.length > 0) return false;

    this.history.push({ player, action: 'pass' });
    this.turn = player === 'w' ? 'b' : 'w';
    this.checkGameOver();
    return true;
  }

  playTile(player, tileIndex, end) {
    if (this.isOver || this.turn !== player) return false;
    const hand = this.hands[player];
    const tile = hand[tileIndex];
    if (!tile) return false;

    if (this.board.length === 0) {
      this.board.push({ left: tile[0], right: tile[1] });
      this.leftValue = tile[0];
      this.rightValue = tile[1];
    } else {
      if (end === 'left') {
        if (tile[0] === this.leftValue) {
          this.board.unshift({ left: tile[1], right: tile[0] });
          this.leftValue = tile[1];
        } else if (tile[1] === this.leftValue) {
          this.board.unshift({ left: tile[0], right: tile[1] });
          this.leftValue = tile[0];
        } else {
          return false;
        }
      } else if (end === 'right') {
         if (tile[0] === this.rightValue) {
          this.board.push({ left: tile[0], right: tile[1] });
          this.rightValue = tile[1];
        } else if (tile[1] === this.rightValue) {
          this.board.push({ left: tile[1], right: tile[0] });
          this.rightValue = tile[0];
        } else {
          return false;
        }
      } else {
        return false;
      }
    }

    hand.splice(tileIndex, 1);
    
    // Add notation string to history for UI
    let notation = `[${tile[0]}|${tile[1]}]`;
    if (end === 'left') notation = '← ' + notation;
    if (end === 'right') notation = notation + ' →';
    
    this.history.push({ player, action: 'play', tile: [...tile], end, notation });
    
    if (hand.length === 0) {
      this.isOver = true;
      this.winner = player;
    } else {
      this.turn = player === 'w' ? 'b' : 'w';
      this.checkGameOver();
    }
    
    return true;
  }

  checkGameOver() {
    if (this.isOver) return;

    const wCanPlay = this.canPlay('w');
    const bCanPlay = this.canPlay('b');
    
    if (!wCanPlay && !bCanPlay && this.boneyard.length === 0) {
      this.isOver = true;
      const wSum = this.hands.w.reduce((acc, t) => acc + t[0] + t[1], 0);
      const bSum = this.hands.b.reduce((acc, t) => acc + t[0] + t[1], 0);
      
      if (wSum < bSum) this.winner = 'w';
      else if (bSum < wSum) this.winner = 'b';
      else this.winner = 'draw';
    }
  }

  isGameOver() {
    return this.isOver;
  }

  getBotAction(difficulty, player) {
    if (this.turn !== player || this.isOver) return null;
    
    const validMoves = this.getValidMoves(player);
    if (validMoves.length > 0) {
      if (difficulty > 3) {
         validMoves.sort((a, b) => (b.tile[0]+b.tile[1]) - (a.tile[0]+a.tile[1]));
      } else {
         this.shuffle(validMoves);
      }
      return { action: 'play', tileIndex: this.hands[player].findIndex(t => t[0]===validMoves[0].tile[0] && t[1]===validMoves[0].tile[1]), end: validMoves[0].end };
    }
    
    if (this.boneyard.length > 0) {
      return { action: 'draw' };
    }
    
    return { action: 'pass' };
  }
}
