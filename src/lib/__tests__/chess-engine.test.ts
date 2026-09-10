import { describe, it, expect, beforeEach } from 'vitest';
import { ChessEngine, squareToIBCA } from '../chess-engine';

describe('ChessEngine', () => {
  let engine: ChessEngine;

  beforeEach(() => {
    engine = new ChessEngine();
  });

  it('Constructor creates starting position', () => {
    const state = engine.getGameState();
    expect(state.fen).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    expect(state.turn).toBe('w');
  });

  it('makeMove() with valid SAN moves (e4, Nf3)', () => {
    let result = engine.makeMove('e4');
    expect(result.success).toBe(true);
    expect(result.gameState.turn).toBe('b');

    result = engine.makeMove('Nf6');
    expect(result.success).toBe(true);
    expect(result.gameState.turn).toBe('w');
  });

  it('makeMove() with invalid moves returns error', () => {
    const result = engine.makeMove('invalid_move');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('Game state tracking (turn, check, checkmate)', () => {
    // Scholar's mate
    engine.makeMove('e4');
    engine.makeMove('e5');
    engine.makeMove('Bc4');
    engine.makeMove('Nc6');
    engine.makeMove('Qh5');
    engine.makeMove('Nf6');
    const result = engine.makeMove('Qxf7#');
    
    expect(result.success).toBe(true);
    const state = engine.getGameState();
    expect(state.isCheck).toBe(true);
    expect(state.isCheckmate).toBe(true);
    expect(state.isGameOver).toBe(true);
  });

  it('describeBoardState() returns descriptions for all focus types', () => {
    const focuses = ['full', 'threats', 'kingside', 'queenside', 'center', 'my_pieces', 'captures'];
    for (const focus of focuses) {
      const desc = engine.describeBoardState(focus);
      expect(desc.focus).toBe(focus);
      expect(typeof desc.description).toBe('string');
      expect(desc.description.length).toBeGreaterThan(0);
    }
  });

  it('getLegalMoves() returns formatted strings', () => {
    const movesAll = engine.getLegalMoves('all');
    expect(typeof movesAll).toBe('string');
    expect(movesAll.length).toBeGreaterThan(0);

    const movesPiece = engine.getLegalMoves('knight');
    expect(typeof movesPiece).toBe('string');

    const movesSquare = engine.getLegalMoves('e2');
    expect(typeof movesSquare).toBe('string');
  });

  it('undoMove() works correctly', () => {
    engine.makeMove('e4');
    const stateBeforeUndo = engine.getGameState();
    expect(stateBeforeUndo.turn).toBe('b');

    const undoResult = engine.undoMove();
    expect(undoResult.success).toBe(true);
    
    const stateAfterUndo = engine.getGameState();
    expect(stateAfterUndo.turn).toBe('w');
    expect(stateAfterUndo.fen).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  });

  it('makeEngineMove() produces valid opponent moves', () => {
    const result = engine.makeEngineMove('beginner');
    expect(result.success).toBe(true);
    expect(engine.getGameState().turn).toBe('b');
  });

  it('squareToIBCA() converts correctly', () => {
    expect(squareToIBCA('e4')).toBe('Eva 4');
    expect(squareToIBCA('a1')).toBe('Anna 1');
    expect(squareToIBCA('h8')).toBe('Hector 8');
  });
});
