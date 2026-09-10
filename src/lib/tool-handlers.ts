// ============================================================
// VoiceChessmate — Tool Call Handlers
// Maps AssemblyAI tool_call events to chess engine operations
//
// Move matching: scores every legal move against the spoken
// description instead of parsing strings. Much more robust.
// ============================================================

import { ChessEngine } from './chess-engine';
import type {
  ValidateMoveArgs,
  GetBoardStateArgs,
  GetLegalMovesArgs,
  ToolDefinition,
  Move,
} from '@/types';

// --- Tool Definitions (sent in session.update) ---

export const CHESS_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    name: 'apply_move',
    description:
      'Apply a player\'s move to the board. Pass the move exactly as the player described it — the tool handles parsing. Returns a "narration" field that you MUST read aloud verbatim. The narration contains the player\'s confirmed move AND the opponent\'s responding move. Always read the full narration — the player cannot see the opponent\'s move.',
    parameters: {
      type: 'object',
      properties: {
        move_description: {
          type: 'string',
          description:
            'The move as the player described it, e.g. "knight to f3", "e4", "Eva 4", "take his bishop", "castle kingside". Pass the player\'s words directly, do not try to convert to SAN.',
        },
      },
      required: ['move_description'],
    },
  },
  {
    type: 'function',
    name: 'describe_board',
    description:
      'Describe the current board position for the player. Call this whenever the player asks to hear about the board — e.g. "describe", "describe the board", "position", "what do you see", "where is everything", "read the board", "scan", "layout", "setup", "where is my rook", "where are the pieces". Read the result aloud completely.',
    parameters: {
      type: 'object',
      properties: {
        focus: {
          type: 'string',
          description:
            'Area to focus on: "full" (default, complete board scan), "kingside", "queenside", "center", "threats", "my_pieces", "captures".',
          enum: ['full', 'kingside', 'queenside', 'center', 'threats', 'my_pieces', 'captures'],
        },
      },
    },
  },
  {
    type: 'function',
    name: 'get_legal_moves',
    description:
      'List legal moves for a piece or all pieces. Use when the player asks "what can I do?" or "where can my knight go?"',
    parameters: {
      type: 'object',
      properties: {
        piece_or_square: {
          type: 'string',
          description: 'A piece name ("knight"), a square ("e4"), or "all".',
        },
      },
    },
  },
  {
    type: 'function',
    name: 'get_hint',
    description:
      'Get a move suggestion. Use only when the player explicitly asks for help.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    type: 'function',
    name: 'undo_move',
    description: 'Take back the last move pair (player + opponent).',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
];

// --- Fuzzy Move Matcher ---
// Instead of parsing natural language into SAN, score every legal move
// against the spoken description and pick the best match.

const PIECE_NAMES: Record<string, string> = {
  n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king', p: 'pawn',
};

const PIECE_ALIASES: Record<string, string> = {
  // Standard names
  knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k', pawn: 'p',
  // Common ASR mis-hearings
  night: 'n', nights: 'n', horse: 'n', nite: 'n', lite: 'n', kite: 'n',
  bish: 'b', fish: 'b', dish: 'b',
  castle: 'r', tower: 'r', rock: 'r', brook: 'r', roque: 'r',
  cream: 'q', keen: 'q', green: 'q', clean: 'q',
  // Abbreviations
  'the knight': 'n', 'the bishop': 'b', 'the rook': 'r', 'the queen': 'q', 'the king': 'k', 'the pawn': 'p',
  'my knight': 'n', 'my bishop': 'b', 'my rook': 'r', 'my queen': 'q', 'my king': 'k', 'my pawn': 'p',
};

// FIDE & International Braille Chess Association (IBCA) official phonetic file names
// Expanded with common ASR mis-transcriptions
const IBCA_FILES: Record<string, string> = {
  anna: 'a', ana: 'a', honour: 'a', honor: 'a', 'on a': 'a',
  bella: 'b', bela: 'b',
  cesar: 'c', caesar: 'c', ceasar: 'c', sees: 'c', 'sees are': 'c', 'c sir': 'c',
  david: 'd', dave: 'd', 'they would': 'd',
  eva: 'e', eve: 'e', ever: 'e', ava: 'e',
  felix: 'f', feel: 'f', phelix: 'f', phoenix: 'f',
  gustav: 'g', gustave: 'g', gust: 'g', goose: 'g',
  hector: 'h', 'heck tour': 'h', 'heck to': 'h', heater: 'h',
  // Direct letter names (ASR sometimes just outputs the letter)
  ay: 'a', bee: 'b', see: 'c', dee: 'd', ef: 'f', gee: 'g', aitch: 'h',
};

const NUMBER_WORDS: Record<string, string> = {
  one: '1', won: '1',
  two: '2', too: '2', tu: '2',
  three: '3', tree: '3', free: '3',
  four: '4', fore: '4', 'for a': '4',
  five: '5', hive: '5', fife: '5',
  six: '6', sic: '6',
  seven: '7',
  eight: '8', ate: '8', ait: '8',
};

function normalizeIBCASpeech(raw: string): string {
  let s = raw.trim().toLowerCase();

  // Strip common filler/command words that add no chess meaning
  s = s.replace(/\b(please|play|move|go|put|place|make|do|try|let's|let me|i want|i'll|i will|wanna|gonna|um|uh|like|okay|ok|so|then|the|my|a|an)\b/g, ' ');

  // Convert number words e.g. "four" -> "4" (must come before IBCA to handle "Eva four")
  // Sort by length descending to match longer phrases first (e.g. "for a" before "for")
  const sortedNumbers = Object.entries(NUMBER_WORDS).sort((a, b) => b[0].length - a[0].length);
  for (const [word, digit] of sortedNumbers) {
    s = s.replace(new RegExp(`\\b${word.replace(/\s+/g, '\\s+')}\\b`, 'g'), digit);
  }

  // Convert IBCA file + rank (e.g. "eva 4" -> "e4", "felix 3" -> "f3", "gustav 1" -> "g1")
  // Sort IBCA entries by key length descending to prefer longer matches
  const sortedIBCA = Object.entries(IBCA_FILES).sort((a, b) => b[0].length - a[0].length);
  for (const [name, file] of sortedIBCA) {
    const pattern = new RegExp(`\\b${name.replace(/\s+/g, '\\s+')}\\s*([1-8])\\b`, 'g');
    s = s.replace(pattern, `${file}$1`);
  }

  // Convert isolated IBCA file names (e.g. "knight on felix" -> "knight on f")
  for (const [name, file] of sortedIBCA) {
    if (name.length <= 1) continue; // Skip single letters to avoid false matches
    s = s.replace(new RegExp(`\\b${name.replace(/\s+/g, '\\s+')}\\b`, 'g'), file);
  }

  // Handle "letter space digit" → "letter+digit" (e.g. "e 4" → "e4", "f 3" → "f3")
  s = s.replace(/\b([a-h])\s+([1-8])\b/g, '$1$2');

  // Collapse excess whitespace
  s = s.replace(/\s+/g, ' ').trim();

  return s;
}

function fuzzyMatchMove(description: string, engine: ChessEngine): { move: string; confidence: number } {
  // Normalize both IBCA phonetic speech ("Eva 4", "Felix 3") and standard algebraic speech ("e4", "f3")
  const s = normalizeIBCASpeech(description);
  const legalMoves = engine.getGameState().legalMoves;

  if (legalMoves.length === 0) {
    return { move: '', confidence: 0 };
  }

  // --- Direct SAN/UCI match first ---
  const directMatch = legalMoves.find(
    m => m.san.toLowerCase() === s || m.san === description.trim()
  );
  if (directMatch) return { move: directMatch.san, confidence: 1.0 };

  // UCI match (e.g., "e2e4", "g1f3")
  const uciClean = s.replace(/\s/g, '');
  const uciMatch = legalMoves.find(
    m => `${m.from}${m.to}` === uciClean
  );
  if (uciMatch) return { move: uciMatch.san, confidence: 1.0 };

  // --- Castling ---
  if (/castl\w*\s*(king|short)/i.test(s) || s === 'castle' || s === 'short castle') {
    const m = legalMoves.find(m => m.san === 'O-O');
    if (m) return { move: m.san, confidence: 1.0 };
  }
  if (/castl\w*\s*(queen|long)/i.test(s) || s === 'long castle') {
    const m = legalMoves.find(m => m.san === 'O-O-O');
    if (m) return { move: m.san, confidence: 1.0 };
  }

  // --- Score every legal move against the description ---
  let bestMove = legalMoves[0];
  let bestScore = -1;

  for (const move of legalMoves) {
    let score = 0;

    // Destination square mentioned? (+10)
    if (s.includes(move.to)) score += 10;

    // Source square mentioned? (+5)
    if (s.includes(move.from)) score += 5;

    // Piece name mentioned? (+8)
    const pieceName = PIECE_NAMES[move.piece];
    if (pieceName && s.includes(pieceName)) score += 8;

    // Check piece aliases
    for (const [alias, type] of Object.entries(PIECE_ALIASES)) {
      if (s.includes(alias) && move.piece === type) score += 8;
    }

    // Capture mentioned and this is a capture? (+6)
    const captureWords = ['take', 'takes', 'capture', 'captures', 'x'];
    const mentionsCapture = captureWords.some(w => s.includes(w));
    if (mentionsCapture && move.captured) score += 6;
    if (mentionsCapture && !move.captured) score -= 3; // penalize non-captures when capture is mentioned

    // Captured piece type mentioned? (+4)
    if (move.captured) {
      const capturedName = PIECE_NAMES[move.captured];
      if (capturedName && s.includes(capturedName)) score += 4;
    }

    // Pawn moves: if no piece name is mentioned and destination is there, slight bonus (+2)
    if (move.piece === 'p' && !Object.keys(PIECE_ALIASES).some(a => s.includes(a))) {
      if (s.includes(move.to)) score += 2;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return { move: bestMove.san, confidence: bestScore >= 10 ? 0.9 : bestScore >= 5 ? 0.6 : 0.2 };
}

// --- Tool Call Router ---

export function handleToolCall(
  engine: ChessEngine,
  toolName: string,
  args: Record<string, unknown>,
  onOpponentMove?: (result: ReturnType<ChessEngine['makeEngineMove']>) => void
): string {
  const t0 = Date.now();

  switch (toolName) {
    case 'apply_move':
    case 'validate_and_play_move': {
      const rawMove = (args.move_description || args.move || '') as string;
      const { move, confidence } = fuzzyMatchMove(rawMove, engine);
      console.log(`[Move] "${rawMove}" → "${move}" (confidence: ${confidence}) [${Date.now() - t0}ms]`);

      if (!move) {
        return JSON.stringify({
          success: false,
          narration: 'No legal moves available. The game may be over.',
        });
      }

      if (confidence < 0.5) {
        // Low confidence — ask for clarification instead of guessing
        const suggestions = engine.getGameState().legalMoves.slice(0, 5).map(m => m.san);
        return JSON.stringify({
          success: false,
          narration: `I'm not sure which move you mean by "${rawMove}". Some options are: ${suggestions.join(', ')}. Could you be more specific?`,
        });
      }

      const result = engine.makeMove(move);

      if (result.success && !result.gameState.isGameOver) {
        // Opponent responds immediately
        const opponentResult = engine.makeEngineMove('intermediate');
        if (onOpponentMove) onOpponentMove(opponentResult);

        // Build a clear narration that the agent MUST read aloud.
        // The narration includes both the player's confirmed move and the opponent's response.
        const fullNarration = opponentResult.success
          ? `${result.narration} Opponent responds: ${opponentResult.narration}`
          : `${result.narration} Opponent has no legal moves.`;

        const response = {
          success: true,
          // narration is the PRIMARY field — the system prompt tells the agent to read this verbatim
          narration: fullNarration,
          your_move: result.narration,
          opponent_move: opponentResult.success ? opponentResult.narration : 'Opponent has no moves.',
          fen: engine.getGameState().fen,
        };

        console.log(`[Move complete] [${Date.now() - t0}ms]`);
        return JSON.stringify(response);
      }

      return JSON.stringify({
        success: result.success,
        narration: result.narration,
        error: result.error,
        fen: engine.getGameState().fen,
      });
    }

    case 'describe_board':
    case 'get_board_state': {
      const { focus = 'full' } = args as unknown as GetBoardStateArgs;
      const description = engine.describeBoardState(focus);
      return JSON.stringify({ description: description.description });
    }

    case 'get_legal_moves': {
      const { piece_or_square = 'all' } = args as unknown as GetLegalMovesArgs;
      const moves = engine.getLegalMoves(piece_or_square);
      return JSON.stringify({ moves });
    }

    case 'get_hint':
    case 'get_engine_suggestion': {
      const evaluation = engine.getSimpleEvaluation();
      return JSON.stringify(evaluation);
    }

    case 'undo_move':
    case 'undo_last_move': {
      engine.undoMove(); // undo opponent
      const result = engine.undoMove(); // undo player
      return JSON.stringify({
        success: result.success,
        narration: result.narration,
        fen: engine.getGameState().fen,
      });
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}
