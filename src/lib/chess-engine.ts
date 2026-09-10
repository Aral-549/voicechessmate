// ============================================================
// VoiceChessmate — Chess Engine (chess.js wrapper)
// Manages game state, move validation, and board narration
// ============================================================

import { Chess, Square, Move, Color, PieceSymbol } from 'chess.js';
import type { GameState, MoveResult, BoardDescription, Difficulty } from '@/types';

const PIECE_NAMES: Record<PieceSymbol, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
};

const FILE_NAMES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANK_NAMES = ['1', '2', '3', '4', '5', '6', '7', '8'];

// Official FIDE and International Braille Chess Association (IBCA) standard phonetic files
export const IBCA_FILE_NAMES: Record<string, string> = {
  a: 'Anna',
  b: 'Bella',
  c: 'Cesar',
  d: 'David',
  e: 'Eva',
  f: 'Felix',
  g: 'Gustav',
  h: 'Hector',
};

export function squareToIBCA(square: string): string {
  if (!square || square.length < 2) return square;
  const file = square[0].toLowerCase();
  const rank = square[1];
  const name = IBCA_FILE_NAMES[file];
  return name ? `${name} ${rank}` : square;
}

export class ChessEngine {
  private game: Chess;
  private moveHistory: Move[] = [];
  private capturedPieces: { white: PieceSymbol[]; black: PieceSymbol[] } = {
    white: [],
    black: [],
  };

  constructor(fen?: string) {
    this.game = new Chess(fen);
  }

  // --- State ---

  getGameState(): GameState {
    const history = this.game.history({ verbose: true });
    const lastMove = history.length > 0 ? history[history.length - 1] : null;

    return {
      fen: this.game.fen(),
      pgn: this.game.pgn(),
      turn: this.game.turn(),
      moveNumber: Math.ceil(history.length / 2) + 1,
      isCheck: this.game.isCheck(),
      isCheckmate: this.game.isCheckmate(),
      isDraw: this.game.isDraw(),
      isStalemate: this.game.isStalemate(),
      isGameOver: this.game.isGameOver(),
      lastMove,
      legalMoves: this.game.moves({ verbose: true }),
      capturedPieces: { ...this.capturedPieces },
    };
  }

  // --- Move Execution ---

  makeMove(moveInput: string): MoveResult {
    const state = this.getGameState();
    if (state.isGameOver) {
      return {
        success: false,
        error: this.describeGameOver(),
        gameState: state,
        narration: this.describeGameOver(),
      };
    }

    try {
      // chess.js accepts SAN ("Nf3"), UCI ("g1f3"), and object notation
      const move = this.game.move(moveInput);
      if (!move) {
        return {
          success: false,
          error: `Invalid move: "${moveInput}". It's ${state.turn === 'w' ? "white" : "black"}'s turn.`,
          gameState: this.getGameState(),
          narration: `That move is not legal. ${this.suggestSimilarMoves(moveInput)}`,
        };
      }

      // Track captures
      if (move.captured) {
        const capturingColor = move.color;
        if (capturingColor === 'w') {
          this.capturedPieces.white.push(move.captured);
        } else {
          this.capturedPieces.black.push(move.captured);
        }
      }

      this.moveHistory.push(move);
      const narration = this.narrateMove(move);
      return {
        success: true,
        move,
        gameState: this.getGameState(),
        narration,
      };
    } catch {
      return {
        success: false,
        error: `Could not parse move: "${moveInput}".`,
        gameState: this.getGameState(),
        narration: `I couldn't understand that move. Try something like "knight to f3" or "e4". ${this.suggestSimilarMoves(moveInput)}`,
      };
    }
  }

  // --- Move Narration ---

  private narrateMove(move: Move): string {
    const piece = PIECE_NAMES[move.piece];
    const color = move.color === 'w' ? 'White' : 'Black';
    const toSquare = squareToIBCA(move.to);
    let narration = '';

    if (move.san === 'O-O') {
      narration = `${color} castles kingside.`;
    } else if (move.san === 'O-O-O') {
      narration = `${color} castles queenside.`;
    } else if (move.captured) {
      const captured = PIECE_NAMES[move.captured];
      narration = `${color} ${piece} takes ${captured} on ${toSquare}.`;
    } else {
      narration = `${color} ${piece} to ${toSquare}.`;
    }

    // Check/checkmate/draw annotations
    const newState = this.getGameState();
    if (newState.isCheckmate) {
      narration += ` Checkmate! ${color} wins the game.`;
    } else if (newState.isCheck) {
      narration += ' Check!';
    } else if (newState.isStalemate) {
      narration += ' Stalemate. The game is a draw.';
    } else if (newState.isDraw) {
      narration += ' The game is a draw.';
    }

    if (move.promotion) {
      narration += ` Promoted to ${PIECE_NAMES[move.promotion]}.`;
    }

    return narration;
  }

  // --- Board Description ---

  describeBoardState(focus: string = 'full'): BoardDescription {
    const board = this.game.board();
    const turn = this.game.turn();
    const playerColor = turn; // describe from current player's perspective

    switch (focus) {
      case 'threats':
        return { focus: 'threats', description: this.describeThreats(playerColor) };
      case 'kingside':
        return { focus: 'kingside', description: this.describeRegion(board, playerColor, 4, 7) };
      case 'queenside':
        return { focus: 'queenside', description: this.describeRegion(board, playerColor, 0, 3) };
      case 'center':
        return { focus: 'center', description: this.describeCenter(board) };
      case 'my_pieces':
        return { focus: 'my_pieces', description: this.describePlayerPieces(board, playerColor) };
      case 'captures':
        return { focus: 'captures', description: this.describeCapturedPieces() };
      case 'full':
      default:
        return { focus: 'full', description: this.describeFullBoard(board, playerColor) };
    }
  }

  // Official IBCA tournament standard: scan rank 1 through rank 8 in fixed order,
  // announcing occupied squares using full piece name + phonetic file + rank number.
  private describeFullBoard(board: ReturnType<Chess['board']>, perspective: Color): string {
    const lines: string[] = [];
    const colorName = perspective === 'w' ? 'White' : 'Black';

    lines.push(`Board position, scanning rank 1 through rank 8. It's ${colorName}'s turn.`);

    for (let r = 1; r <= 8; r++) {
      const rankIdx = 8 - r; // rank 1 is board[7], rank 8 is board[0]
      const piecesOnRank: string[] = [];

      for (let fileIdx = 0; fileIdx < 8; fileIdx++) {
        const piece = board[rankIdx]?.[fileIdx];
        if (piece) {
          const color = piece.color === 'w' ? 'White' : 'Black';
          const pieceName = PIECE_NAMES[piece.type];
          const fileName = IBCA_FILE_NAMES[FILE_NAMES[fileIdx]];
          piecesOnRank.push(`${color} ${pieceName} ${fileName} ${r}`);
        }
      }

      if (piecesOnRank.length > 0) {
        lines.push(`Rank ${r}: ${piecesOnRank.join(', ')}.`);
      }
    }

    if (this.game.isCheck()) {
      lines.push(`${colorName} is in check!`);
    }

    return lines.join(' ');
  }

  private describeRegion(board: ReturnType<Chess['board']>, perspective: Color, fileStart: number, fileEnd: number): string {
    const pieces: string[] = [];
    const regionName = fileStart < 4 ? 'queenside' : 'kingside';

    for (let rank = 0; rank < 8; rank++) {
      for (let file = fileStart; file <= fileEnd; file++) {
        const piece = board[rank][file];
        if (piece) {
          const square = `${FILE_NAMES[file]}${RANK_NAMES[7 - rank]}`;
          const color = piece.color === perspective ? 'your' : "opponent's";
          pieces.push(`${color} ${PIECE_NAMES[piece.type]} on ${squareToIBCA(square)}`);
        }
      }
    }

    if (pieces.length === 0) {
      return `The ${regionName} is empty.`;
    }
    return `On the ${regionName}: ${pieces.join(', ')}.`;
  }

  private describeCenter(board: ReturnType<Chess['board']>): string {
    const centerSquares = [
      [3, 3], [3, 4], [4, 3], [4, 4], // d4, e4, d5, e5
      [2, 3], [2, 4], [5, 3], [5, 4], // extended center
    ];

    const pieces: string[] = [];
    for (const [rank, file] of centerSquares) {
      const piece = board[rank][file];
      if (piece) {
        const square = `${FILE_NAMES[file]}${RANK_NAMES[7 - rank]}`;
        const color = piece.color === 'w' ? 'White' : 'Black';
        pieces.push(`${color} ${PIECE_NAMES[piece.type]} on ${squareToIBCA(square)}`);
      }
    }

    if (pieces.length === 0) {
      return 'The center is open with no pieces occupying it.';
    }
    return `In the center: ${pieces.join(', ')}.`;
  }

  private describePlayerPieces(board: ReturnType<Chess['board']>, color: Color): string {
    const pieces: string[] = [];

    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = board[rank][file];
        if (piece && piece.color === color) {
          const square = `${FILE_NAMES[file]}${RANK_NAMES[7 - rank]}`;
          pieces.push(`${PIECE_NAMES[piece.type]} on ${squareToIBCA(square)}`);
        }
      }
    }

    return `Your pieces: ${pieces.join(', ')}.`;
  }

  private describeThreats(perspective: Color): string {
    const threats: string[] = [];
    const opponentMoves = this.getOpponentAttacks(perspective);

    // Find our pieces that are under attack
    const board = this.game.board();
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = board[rank][file];
        if (piece && piece.color === perspective) {
          const square = `${FILE_NAMES[file]}${RANK_NAMES[7 - rank]}` as Square;
          if (opponentMoves.some(m => m.to === square)) {
            threats.push(`Your ${PIECE_NAMES[piece.type]} on ${squareToIBCA(square)} is under attack`);
          }
        }
      }
    }

    if (threats.length === 0) {
      return 'None of your pieces are currently under direct attack.';
    }
    return `Threats: ${threats.join('. ')}.`;
  }

  private describeCapturedPieces(): string {
    const parts: string[] = [];
    if (this.capturedPieces.white.length > 0) {
      parts.push(`White has captured: ${this.capturedPieces.white.map(p => PIECE_NAMES[p]).join(', ')}`);
    }
    if (this.capturedPieces.black.length > 0) {
      parts.push(`Black has captured: ${this.capturedPieces.black.map(p => PIECE_NAMES[p]).join(', ')}`);
    }
    if (parts.length === 0) {
      return 'No pieces have been captured yet.';
    }
    return parts.join('. ') + '.';
  }

  // --- Legal Moves ---

  getLegalMoves(pieceOrSquare?: string): string {
    let moves: Move[];

    if (!pieceOrSquare || pieceOrSquare === 'all') {
      moves = this.game.moves({ verbose: true });
      const grouped = new Map<string, string[]>();
      for (const move of moves) {
        const fromIBCA = squareToIBCA(move.from);
        const toIBCA = squareToIBCA(move.to);
        const key = `${PIECE_NAMES[move.piece]} on ${fromIBCA}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(`${toIBCA}`);
      }
      const parts: string[] = [];
      for (const [piece, sans] of grouped) {
        parts.push(`${piece} can play to: ${sans.join(', ')}`);
      }
      return parts.join('. ') + '.';
    }

    // Normalize IBCA phonetic files in query e.g. "eva 4" -> "e4"
    let normalized = pieceOrSquare.toLowerCase().trim();
    for (const [file, name] of Object.entries(IBCA_FILE_NAMES)) {
      normalized = normalized.replace(new RegExp(`\\b${name.toLowerCase()}\\s*([1-8])\\b`, 'g'), `${file}$1`);
    }

    // Try as square first
    const square = normalized as Square;
    if (/^[a-h][1-8]$/.test(square)) {
      moves = this.game.moves({ square, verbose: true });
      const sqIBCA = squareToIBCA(square);
      if (moves.length === 0) {
        return `No legal moves from ${sqIBCA}.`;
      }
      const piece = this.game.get(square);
      const pieceName = piece ? PIECE_NAMES[piece.type] : 'piece';
      const moveDescs = moves.map(m => squareToIBCA(m.to));
      return `Your ${pieceName} on ${sqIBCA} can play to: ${moveDescs.join(', ')}.`;
    }

    // Try as piece name
    const pieceMap: Record<string, PieceSymbol> = {
      pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k',
    };
    const pieceType = pieceMap[normalized];
    if (pieceType) {
      moves = this.game.moves({ verbose: true }).filter(m => m.piece === pieceType);
      if (moves.length === 0) {
        return `Your ${pieceOrSquare} has no legal moves.`;
      }
      const moveDescs = moves.map(m => `${squareToIBCA(m.from)} to ${squareToIBCA(m.to)}`);
      return `Your ${pieceOrSquare} can play: ${moveDescs.join(', ')}.`;
    }

    return `I don't understand "${pieceOrSquare}". Try a square like "Eva 4" or a piece name like "knight".`;
  }

  // --- Engine Suggestion (simple evaluation without Stockfish) ---

  getSimpleEvaluation(): { bestMove: string; evaluation: string; explanation: string } {
    const moves = this.game.moves({ verbose: true });
    if (moves.length === 0) {
      return { bestMove: 'none', evaluation: 'Game over', explanation: this.describeGameOver() };
    }

    // Simple heuristic: prioritize checkmate > checks > captures > center control
    let bestMove = moves[0];
    let bestScore = -Infinity;

    for (const move of moves) {
      let score = 0;

      // Checkmate is instant win
      this.game.move(move.san);
      if (this.game.isCheckmate()) score += 10000;
      if (this.game.isCheck()) score += 50;
      this.game.undo();

      // Captures (MVV-LVA style)
      if (move.captured) {
        const victimValues: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
        const attackerValues: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
        score += victimValues[move.captured] * 10 - attackerValues[move.piece];
      }

      // Center control
      const centerSquares = ['d4', 'd5', 'e4', 'e5'];
      if (centerSquares.includes(move.to)) score += 5;

      // Development (moving pieces off back rank)
      if ((move.piece === 'n' || move.piece === 'b') &&
          ((move.color === 'w' && move.from[1] === '1') ||
           (move.color === 'b' && move.from[1] === '8'))) {
        score += 3;
      }

      // Castling bonus
      if (move.san === 'O-O' || move.san === 'O-O-O') score += 8;

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    const pieceName = PIECE_NAMES[bestMove.piece];
    const toIBCA = squareToIBCA(bestMove.to);
    let explanation = `I'd suggest ${pieceName} to ${toIBCA}.`;
    if (bestMove.captured) {
      explanation += ` This captures their ${PIECE_NAMES[bestMove.captured]}.`;
    }
    if (bestMove.san === 'O-O' || bestMove.san === 'O-O-O') {
      explanation = `I'd suggest castling to get your king to safety.`;
    }

    return {
      bestMove: bestMove.san,
      evaluation: bestScore > 100 ? 'winning' : bestScore > 10 ? 'good' : 'equal',
      explanation,
    };
  }

  // --- Opponent Auto-Move (for solo play against engine) ---

  makeEngineMove(difficulty: Difficulty = 'intermediate'): MoveResult {
    const moves = this.game.moves({ verbose: true });
    if (moves.length === 0) {
      return {
        success: false,
        error: 'No legal moves available.',
        gameState: this.getGameState(),
        narration: this.describeGameOver(),
      };
    }

    let selectedMove: Move;

    switch (difficulty) {
      case 'beginner':
        // Random move
        selectedMove = moves[Math.floor(Math.random() * moves.length)];
        break;
      case 'intermediate': {
        // Prefer captures and checks, but mix in random
        const good = moves.filter(m => m.captured || this.moveCausesCheck(m));
        if (good.length > 0 && Math.random() > 0.3) {
          selectedMove = good[Math.floor(Math.random() * good.length)];
        } else {
          selectedMove = moves[Math.floor(Math.random() * moves.length)];
        }
        break;
      }
      case 'advanced':
      case 'master': {
        // Use simple eval to pick best move
        const eval_ = this.getSimpleEvaluation();
        const best = moves.find(m => m.san === eval_.bestMove);
        selectedMove = best || moves[0];
        break;
      }
      default:
        selectedMove = moves[Math.floor(Math.random() * moves.length)];
    }

    return this.makeMove(selectedMove.san);
  }

  // --- Helpers ---

  private moveCausesCheck(move: Move): boolean {
    this.game.move(move.san);
    const inCheck = this.game.isCheck();
    this.game.undo();
    return inCheck;
  }

  private getOpponentAttacks(perspective: Color): Move[] {
    // Temporarily switch turns to see opponent's moves
    const fen = this.game.fen();
    const parts = fen.split(' ');
    parts[1] = perspective === 'w' ? 'b' : 'w';
    try {
      const tempGame = new Chess(parts.join(' '));
      return tempGame.moves({ verbose: true });
    } catch {
      return [];
    }
  }

  private suggestSimilarMoves(input: string): string {
    const moves = this.game.moves();
    const lower = input.toLowerCase();
    const similar = moves.filter(m =>
      m.toLowerCase().includes(lower) || lower.includes(m.toLowerCase())
    );
    if (similar.length > 0) {
      return `Did you mean: ${similar.slice(0, 3).join(', ')}?`;
    }
    return `Legal moves include: ${moves.slice(0, 5).join(', ')}, and more.`;
  }

  private describeGameOver(): string {
    if (this.game.isCheckmate()) {
      const winner = this.game.turn() === 'w' ? 'Black' : 'White';
      return `Checkmate! ${winner} wins the game.`;
    }
    if (this.game.isStalemate()) return 'Stalemate — the game is a draw.';
    if (this.game.isDraw()) return 'The game is a draw.';
    return 'The game is over.';
  }

  // --- Reset ---

  reset(fen?: string): void {
    this.game = new Chess(fen);
    this.moveHistory = [];
    this.capturedPieces = { white: [], black: [] };
  }

  // --- Undo ---

  undoMove(): MoveResult {
    const undone = this.game.undo();
    if (!undone) {
      return {
        success: false,
        error: 'No moves to undo.',
        gameState: this.getGameState(),
        narration: 'There are no moves to take back.',
      };
    }
    this.moveHistory.pop();
    return {
      success: true,
      move: undone,
      gameState: this.getGameState(),
      narration: `Took back the last move: ${PIECE_NAMES[undone.piece]} from ${undone.to} back to ${undone.from}.`,
    };
  }
}
