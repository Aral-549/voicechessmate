// ============================================================
// VoiceChessmate — TypeScript Type Definitions
// ============================================================

import { Chess, Square, Move, Color, PieceSymbol } from 'chess.js';

// --- Voice Agent Types ---

export interface SessionConfig {
  system_prompt: string;
  greeting: string;
  input?: {
    format?: { encoding: string };
    keyterms?: string[];
    turn_detection?: {
      vad_threshold?: number;
      min_silence?: number;
      max_silence?: number;
      interrupt_response?: boolean;
    };
  };
  output?: {
    voice?: string;
    format?: { encoding: string };
  };
  tools?: ToolDefinition[];
}

export interface ToolDefinition {
  type: 'function';
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required?: string[];
  };
}

export interface VoiceAgentEvent {
  type: string;
  [key: string]: unknown;
}

export interface SessionReadyEvent extends VoiceAgentEvent {
  type: 'session.ready';
  session_id: string;
}

export interface UserTranscriptEvent extends VoiceAgentEvent {
  type: 'user.transcript';
  transcript: string;
  end_of_turn: boolean;
}

export interface ReplyAudioEvent extends VoiceAgentEvent {
  type: 'reply.audio';
  data: string; // base64
}

export interface ReplyDoneEvent extends VoiceAgentEvent {
  type: 'reply.done';
  status: 'completed' | 'interrupted';
}

export interface ToolCallEvent extends VoiceAgentEvent {
  type: 'tool.call';
  tool_call_id: string;
  name: string;
  arguments: string; // JSON string
}

export interface AgentTextEvent extends VoiceAgentEvent {
  type: 'agent.text';
  text: string;
  end_of_text: boolean;
}

// --- Chess Types ---

export interface GameState {
  fen: string;
  pgn: string;
  turn: Color;
  moveNumber: number;
  isCheck: boolean;
  isCheckmate: boolean;
  isDraw: boolean;
  isStalemate: boolean;
  isGameOver: boolean;
  lastMove: Move | null;
  legalMoves: Move[];
  capturedPieces: { white: PieceSymbol[]; black: PieceSymbol[] };
}

export interface MoveResult {
  success: boolean;
  move?: Move;
  error?: string;
  gameState: GameState;
  narration: string;
}

export interface BoardDescription {
  focus: 'full' | 'kingside' | 'queenside' | 'center' | 'threats' | 'my_pieces' | 'captures';
  description: string;
}

export interface EngineEvaluation {
  bestMove: string;
  evaluation: string;
  explanation: string;
}

// --- Tool Call Argument Types ---

export interface ValidateMoveArgs {
  move: string;
}

export interface GetBoardStateArgs {
  focus?: string;
}

export interface GetLegalMovesArgs {
  piece_or_square?: string;
}

export interface GetEngineSuggestionArgs {
  depth?: number;
}

// --- Transcript Types ---

export interface TranscriptEntry {
  id: string;
  speaker: 'user' | 'agent';
  text: string;
  timestamp: number;
  isFinal: boolean;
}

// --- Game Mode ---

export type GameMode = 'play' | 'training' | 'analysis';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'master';

export interface GameConfig {
  mode: GameMode;
  difficulty: Difficulty;
  playerColor: Color;
}

export type { Chess, Square, Move, Color, PieceSymbol };
