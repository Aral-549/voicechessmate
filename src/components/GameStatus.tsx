// ============================================================
// VoiceChessmate — Game Status Bar
// Shows turn, check/checkmate, captures, and voice agent status
// ============================================================

'use client';

import type { GameState } from '@/types';
import type { VoiceAgentStatus } from '@/lib/voice-agent';

interface GameStatusProps {
  gameState: GameState | null;
  agentStatus: VoiceAgentStatus;
}

const PIECE_UNICODE: Record<string, string> = {
  p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚',
};

const STATUS_CONFIG: Record<VoiceAgentStatus, { label: string; color: string; icon: string }> = {
  disconnected: { label: 'Offline · Click "Start Playing" to begin', color: 'text-gray-400', icon: '⭘' },
  connecting: { label: 'Connecting to voice agent...', color: 'text-yellow-400', icon: '◌' },
  ready: { label: 'Connected', color: 'text-green-400', icon: '●' },
  listening: { label: 'Listening — speak your move', color: 'text-green-400', icon: '●' },
  error: { label: 'Connection Error', color: 'text-red-400', icon: '✕' },
};

export function GameStatus({ gameState, agentStatus }: GameStatusProps) {
  const status = STATUS_CONFIG[agentStatus];

  return (
    <div className="flex items-center justify-between px-6 py-3 bg-gray-800/50 border-b border-gray-700">
      {/* Left: Agent status */}
      <div className={`flex items-center gap-2 text-sm ${status.color}`}>
        <span className={agentStatus === 'listening' ? 'animate-pulse' : ''}>
          {status.icon}
        </span>
        <span>{status.label}</span>
      </div>

      {/* Center: Game info */}
      {gameState && (
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-300">
            Move {gameState.moveNumber}
          </span>
          <span className={gameState.turn === 'w' ? 'text-white font-bold' : 'text-gray-400'}>
            {gameState.turn === 'w' ? '⬜ White to move' : '⬛ Black to move'}
          </span>
          {gameState.isCheck && (
            <span className="text-red-400 font-bold animate-pulse">⚠ CHECK</span>
          )}
          {gameState.isCheckmate && (
            <span className="text-red-500 font-bold">♚ CHECKMATE</span>
          )}
          {gameState.isDraw && (
            <span className="text-yellow-400 font-bold">½ DRAW</span>
          )}
        </div>
      )}

      {/* Right: Captured pieces */}
      {gameState && (
        <div className="flex items-center gap-3 text-lg">
          <div className="flex gap-0.5" title="Captured by White">
            {gameState.capturedPieces.white.map((p, i) => (
              <span key={i} className="text-gray-400">{PIECE_UNICODE[p]}</span>
            ))}
          </div>
          <span className="text-gray-600">|</span>
          <div className="flex gap-0.5" title="Captured by Black">
            {gameState.capturedPieces.black.map((p, i) => (
              <span key={i} className="text-gray-400">{PIECE_UNICODE[p]}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
