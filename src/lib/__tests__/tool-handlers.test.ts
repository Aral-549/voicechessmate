import { describe, it, expect, beforeEach } from 'vitest';
import { ChessEngine } from '../chess-engine';
import { handleToolCall } from '../tool-handlers';

describe('Tool Handlers', () => {
  let engine: ChessEngine;

  beforeEach(() => {
    engine = new ChessEngine();
  });

  it('handleToolCall() dispatches to correct tool', () => {
    const resultJson = handleToolCall(engine, 'get_legal_moves', { piece_or_square: 'all' });
    const result = JSON.parse(resultJson);
    expect(result.moves).toBeDefined();
  });

  it('apply_move with IBCA speech ("Eva 4" -> e4)', () => {
    const resultJson = handleToolCall(engine, 'apply_move', { move_description: 'Eva 4' });
    const result = JSON.parse(resultJson);
    expect(result.success).toBe(true);
    expect(result.your_move).toContain('Eva 4');
  });

  it('apply_move with natural language ("knight to Felix 3")', () => {
    const resultJson = handleToolCall(engine, 'apply_move', { move_description: 'knight to Felix 3' });
    const result = JSON.parse(resultJson);
    expect(result.success).toBe(true);
    expect(result.your_move).toContain('Felix 3');
  });

  it('Fuzzy matcher handles ASR mis-hearings ("night" -> knight)', () => {
    const resultJson = handleToolCall(engine, 'apply_move', { move_description: 'night to f3' });
    const result = JSON.parse(resultJson);
    expect(result.success).toBe(true);
    expect(result.your_move).toContain('Felix 3');
  });

  it('Low confidence moves return clarification', () => {
    const resultJson = handleToolCall(engine, 'apply_move', { move_description: 'blabla xyz' });
    const result = JSON.parse(resultJson);
    expect(result.success).toBe(false);
    expect(result.narration).toContain('not sure which move you mean');
  });

  it('describe_board returns board description', () => {
    const resultJson = handleToolCall(engine, 'describe_board', { focus: 'full' });
    const result = JSON.parse(resultJson);
    expect(result.description).toBeDefined();
    expect(typeof result.description).toBe('string');
  });

  it('get_hint returns evaluation', () => {
    const resultJson = handleToolCall(engine, 'get_hint', {});
    const result = JSON.parse(resultJson);
    expect(result.bestMove).toBeDefined();
    expect(result.evaluation).toBeDefined();
  });

  it('undo_move undoes two moves (player + opponent)', () => {
    // Manually push two moves
    engine.makeMove('e4');
    engine.makeMove('e5');
    
    expect(engine.getGameState().moveNumber).toBe(2);
    
    const resultJson = handleToolCall(engine, 'undo_move', {});
    const result = JSON.parse(resultJson);
    
    expect(result.success).toBe(true);
    expect(engine.getGameState().moveNumber).toBe(1);
    expect(engine.getGameState().turn).toBe('w');
  });

  it('Unknown tool returns error', () => {
    const resultJson = handleToolCall(engine, 'unknown_tool', {});
    const result = JSON.parse(resultJson);
    expect(result.error).toBeDefined();
  });
});
