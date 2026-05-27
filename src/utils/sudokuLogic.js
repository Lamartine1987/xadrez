export class SudokuGame {
  constructor(difficulty = 1, state = null) {
    if (state) {
      this.load(state);
    } else {
      this.reset(difficulty);
    }
  }

  reset(difficulty) {
    this.board = Array(9).fill(null).map(() => Array(9).fill(0));
    this.initialBoard = Array(9).fill(null).map(() => Array(9).fill(0));
    this.fillValues();
    this.removeKDigits(difficulty);
    this.isOver = false;
    this.winner = null;
    this.history = [];
  }

  // Sudoku Generator Logic
  fillValues() {
    this.fillDiagonal();
    this.fillRemaining(0, 3);
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        this.initialBoard[i][j] = this.board[i][j];
      }
    }
  }

  fillDiagonal() {
    for (let i = 0; i < 9; i = i + 3) {
      this.fillBox(i, i);
    }
  }

  unUsedInBox(rowStart, colStart, num) {
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if (this.board[rowStart + i][colStart + j] === num) return false;
      }
    }
    return true;
  }

  fillBox(rowStart, colStart) {
    let num;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        do {
          num = Math.floor(Math.random() * 9) + 1;
        } while (!this.unUsedInBox(rowStart, colStart, num));
        this.board[rowStart + i][colStart + j] = num;
      }
    }
  }

  checkIfSafe(i, j, num) {
    return (
      this.unUsedInRow(i, num) &&
      this.unUsedInCol(j, num) &&
      this.unUsedInBox(i - (i % 3), j - (j % 3), num)
    );
  }

  unUsedInRow(i, num) {
    for (let j = 0; j < 9; j++) {
      if (this.board[i][j] === num) return false;
    }
    return true;
  }

  unUsedInCol(j, num) {
    for (let i = 0; i < 9; i++) {
      if (this.board[i][j] === num) return false;
    }
    return true;
  }

  fillRemaining(i, j) {
    if (j >= 9 && i < 8) {
      i = i + 1;
      j = 0;
    }
    if (i >= 9 && j >= 9) return true;
    if (i < 3) {
      if (j < 3) j = 3;
    } else if (i < 6) {
      if (j === Math.floor(i / 3) * 3) j = j + 3;
    } else {
      if (j === 6) {
        i = i + 1;
        j = 0;
        if (i >= 9) return true;
      }
    }

    for (let num = 1; num <= 9; num++) {
      if (this.checkIfSafe(i, j, num)) {
        this.board[i][j] = num;
        if (this.fillRemaining(i, j + 1)) return true;
        this.board[i][j] = 0;
      }
    }
    return false;
  }

  removeKDigits(difficulty) {
    // difficulty 1-5
    let count = 20; 
    if (difficulty === 1) count = 30;
    if (difficulty === 2) count = 40;
    if (difficulty === 3) count = 50;
    if (difficulty === 4) count = 60;
    if (difficulty === 5) count = 65;

    while (count !== 0) {
      let cellId = Math.floor(Math.random() * 81);
      let i = Math.floor(cellId / 9);
      let j = cellId % 9;
      if (this.board[i][j] !== 0) {
        count--;
        this.board[i][j] = 0;
        this.initialBoard[i][j] = 0;
      }
    }
  }

  getState() {
    return {
      board: this.board.map(row => [...row]),
      initialBoard: this.initialBoard.map(row => [...row]),
      isOver: this.isOver,
      winner: this.winner,
      history: [...this.history]
    };
  }

  load(state) {
    if (typeof state === 'string') state = JSON.parse(state);
    this.board = state.board;
    this.initialBoard = state.initialBoard;
    this.isOver = state.isOver;
    this.winner = state.winner;
    this.history = state.history;
  }

  playMove(player, r, c, val) {
    if (this.isOver) return false;
    if (this.initialBoard[r][c] !== 0) return false;

    this.board[r][c] = val;
    this.history.push({ player, action: 'play', r, c, val });

    this.checkGameOver(player);
    return true;
  }

  getConflicts() {
    let conflicts = [];
    let rows = Array(9).fill(null).map(() => new Map());
    let cols = Array(9).fill(null).map(() => new Map());
    let boxes = Array(9).fill(null).map(() => new Map());

    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        let val = this.board[i][j];
        if (val !== 0) {
          let boxIndex = Math.floor(i / 3) * 3 + Math.floor(j / 3);
          
          if (rows[i].has(val)) conflicts.push([i, j], rows[i].get(val));
          if (cols[j].has(val)) conflicts.push([i, j], cols[j].get(val));
          if (boxes[boxIndex].has(val)) conflicts.push([i, j], boxes[boxIndex].get(val));

          rows[i].set(val, [i, j]);
          cols[j].set(val, [i, j]);
          boxes[boxIndex].set(val, [i, j]);
        }
      }
    }
    // Return unique conflicting cells
    const unique = [];
    const seen = new Set();
    conflicts.forEach(c => {
       const key = `${c[0]}-${c[1]}`;
       if (!seen.has(key)) {
          seen.add(key);
          unique.push(c);
       }
    });
    return unique;
  }

  checkGameOver(player) {
    let complete = true;
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        if (this.board[i][j] === 0) complete = false;
      }
    }

    if (complete) {
       const conflicts = this.getConflicts();
       if (conflicts.length === 0) {
          this.isOver = true;
          this.winner = player;
       }
    }
  }
}
