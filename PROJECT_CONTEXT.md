# VoiceChessmate — Comprehensive Project Context & Codebase Snapshot

> Generated on September 11, 2026.
> Complete technical context, architecture documentation, and source code reference for **VoiceChessmate**.

---

## 1. Project Overview & Objective

**VoiceChessmate** is a conversational voice-first chess application built for blind and visually impaired players for the **AssemblyAI Voice Agent Hackathon 2026**.

### Primary Value Proposition
- Visually impaired players cannot easily see standard chessboards or digital interfaces.
- VoiceChessmate enables full tournament-grade chess play using **natural voice conversation** and the **official FIDE & IBCA (International Braille Chess Association) phonetic standard** (Anna, Bella, Cesar, David, Eva, Felix, Gustav, Hector).
- The player speaks naturally (e.g., "Eva 4", "Knight to Felix 3", "castle kingside", or "what's on the board?").
- The AssemblyAI Voice Agent processes speech, extracts intent, triggers local chess engine tools, and **immediately announces moves including opponent responses**.

---

## 2. Architecture & Communication Lifecycle

```
 +-------------------------------------------------------------------------------+
 |                                BROWSER CLIENT                                 |
 |                                                                               |
 |   +------------------------+             +--------------------------------+   |
 |   |     Microphone         |             |   Gapless Audio Playback       |   |
 |   | AudioWorklet (24kHz)   |             | ScriptProcessor Ring Buffer    |   |
 |   +-----------+------------+             +---------------+----------------+   |
 |               | (PCM16 chunks)                           ^ (24kHz PCM16 audio)|
 |               v                                          |                    |
 |   +------------------------------------------------------+----------------+   |
 |   |                   VoiceAgentManager (voice-agent.ts)                  |   |
 |   |       - Manages WebSocket to wss://agents.assemblyai.com/v1/ws        |   |
 |   |       - Push-to-Listen (Hold 'L' key) state gating                   |   |
 |   +-----------+------------------------------------------+----------------+   |
 |               |                                          ^                    |
 |               | tool.call                                | tool.result        |
 |               v                                          |                    |
 |   +------------------------------------------------------+----------------+   |
 |   |                    Tool Router (tool-handlers.ts)                     |   |
 |   |       - Fuzzy Move Matcher (IBCA + SAN + Aliases)                     |   |
 |   |       - Tools: apply_move, describe_board, get_legal_moves,           |   |
 |   |                get_hint, undo_move                                    |   |
 |   +-----------+-----------------------------------------------------------+   |
 |               |                                                               |
 |               v                                                               |
 |   +-----------------------------------------------------------------------+   |
 |   |                    ChessEngine (chess-engine.ts)                      |   |
 |   |       - chess.js state management & validation                        |   |
 |   |       - Built-in heuristic engine opponent (makeEngineMove)           |   |
 |   |       - Rank 1-8 IBCA board scanner & threat analyzer                 |   |
 |   +-----------------------------------------------------------------------+   |
 +-------------------------------------------------------------------------------+
                                 |                          ^
                     fetch token |                          | WebSocket
                                 v                          v
 +-------------------------------------+      +----------------------------------+
 |       Next.js API Route             |      |         AssemblyAI Cloud         |
 |       /api/token                    |      |         Voice Agent API          |
 |  Mints short-lived session token    |      | STT + Turn Detection (VAD) + LLM |
 +-------------------------------------+      +----------------------------------+
```

---

## 3. Directory & File Structure

```
voicechessmate/
├── .env.local                          # AssemblyAI API credentials
├── package.json                        # Dependencies (Next.js 16, React 19, chess.js 1.4)
├── tsconfig.json                       # TypeScript compiler options & aliases
├── next.config.ts                      # Next.js configuration
├── public/
│   └── audio-processor.js              # AudioWorkletProcessor: 24kHz PCM16 capture
└── src/
    ├── app/
    │   ├── api/
    │   │   └── token/
    │   │       └── route.ts            # Secure token minting route (Bearer API key)
    │   ├── globals.css                 # Custom scrollbar and styling
    │   ├── layout.tsx                  # Root HTML metadata and layout
    │   └── page.tsx                    # Main client UI & WebSocket orchestration
    ├── components/
    │   ├── ChessBoard.tsx              # Board rendering with IBCA labels (for spectators)
    │   ├── GameStatus.tsx              # Status banner (turns, check, captures, agent state)
    │   ├── MoveHistory.tsx             # Two-column move ledger
    │   └── TranscriptPanel.tsx         # Real-time streaming conversation log
    ├── lib/
    │   ├── chess-engine.ts             # chess.js wrapper, IBCA narration, engine AI
    │   ├── speech.ts                   # Web Speech API fallback for local shortcuts
    │   ├── system-prompt.ts            # LLM System prompt & extensive chess vocabulary
    │   ├── tool-handlers.ts            # Tool dispatch & fuzzy spoken-move parser
    │   └── voice-agent.ts              # WebSocket & AudioContext Web Audio pipeline
    └── types/
        └── index.ts                    # Full TypeScript types & interfaces
```

---

## 4. Complete Codebase Files

### 4.1 `src/app/page.tsx`
The primary page component managing the chess game, voice connection, user keyboard shortcuts, and live streaming transcript.

```typescript
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { ChessBoard } from '@/components/ChessBoard';
import { TranscriptPanel } from '@/components/TranscriptPanel';
import { MoveHistory } from '@/components/MoveHistory';
import { GameStatus } from '@/components/GameStatus';
import { ChessEngine } from '@/lib/chess-engine';
import { VoiceAgentManager, VoiceAgentStatus } from '@/lib/voice-agent';
import { handleToolCall, CHESS_TOOLS } from '@/lib/tool-handlers';
import { SYSTEM_PROMPT, GREETING, CHESS_KEYTERMS } from '@/lib/system-prompt';
import { speakText, stopSpeaking } from '@/lib/speech';
import type { GameState, TranscriptEntry } from '@/types';

export default function Home() {
  const [agentStatus, setAgentStatus] = useState<VoiceAgentStatus>('disconnected');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [isStarted, setIsStarted] = useState(false);
  const [isPushToTalk, setIsPushToTalk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const engineRef = useRef<ChessEngine>(new ChessEngine());
  const agentRef = useRef<VoiceAgentManager>(new VoiceAgentManager());
  const partialTranscriptRef = useRef<string>('');
  const agentTextRef = useRef<string>('');

  useEffect(() => {
    setGameState(engineRef.current.getGameState());
  }, []);

  const addTranscriptEntry = useCallback((
    speaker: 'user' | 'agent',
    text: string,
    isFinal: boolean
  ) => {
    setTranscript(prev => {
      if (!isFinal && prev.length > 0) {
        const last = prev[prev.length - 1];
        if (last.speaker === speaker && !last.isFinal) {
          return [
            ...prev.slice(0, -1),
            { ...last, text, timestamp: Date.now() },
          ];
        }
      }

      return [
        ...prev,
        {
          id: `${speaker}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          speaker,
          text,
          timestamp: Date.now(),
          isFinal,
        },
      ];
    });
  }, []);

  const startGame = useCallback(async () => {
    setError(null);
    setIsStarted(true);

    try {
      const agent = agentRef.current;
      const engine = engineRef.current;

      engine.reset();
      setGameState(engine.getGameState());
      setTranscript([]);
      agent.clearHandlers();

      agent.onStatusChange((status) => {
        setAgentStatus(status);
      });

      const sessionStartTime = Date.now();
      let lastUserFinalTime = 0;

      agent.on('*', (event) => {
        const type = event.type as string;
        const elapsed = Date.now() - sessionStartTime;
        console.log(`[AAI +${elapsed}ms]`, type, JSON.stringify(event).slice(0, 300));

        if (type === 'session.ready') {
          console.log('[VoiceAgent] Session ready, waiting for greeting audio...');
        }

        if (type === 'reply.started') {
          agentTextRef.current = '';
        }

        if (type === 'transcript.agent.delta') {
          const delta = (event.delta || '') as string;
          if (delta) {
            if (lastUserFinalTime > 0) {
              console.log(`[Latency] First agent text: ${Date.now() - lastUserFinalTime}ms after user speech`);
              lastUserFinalTime = 0;
            }
            agentTextRef.current = agentTextRef.current ? `${agentTextRef.current} ${delta.trim()}` : delta.trim();
            addTranscriptEntry('agent', agentTextRef.current, false);
          }
        }

        if (type.startsWith('transcript.user')) {
          const text = (event.transcript || event.delta || event.text || '') as string;
          const isFinal = !!(type.includes('final') || event.end_of_turn || event.is_final || event.final);
          if (text) {
            if (isFinal) {
              lastUserFinalTime = Date.now();
              partialTranscriptRef.current = '';
              addTranscriptEntry('user', text, true);
            } else {
              partialTranscriptRef.current = text;
              addTranscriptEntry('user', text, false);
            }
          }
        }

        if (type === 'reply.done') {
          if (agentTextRef.current) {
            addTranscriptEntry('agent', agentTextRef.current, true);
            agentTextRef.current = '';
          }
        }

        if (
          type === 'tool.call' ||
          type === 'tool_call' ||
          (event.name !== undefined && (event.tool_call_id !== undefined || event.id !== undefined) && type !== 'session.ready' && type !== 'session.updated')
        ) {
          const toolCallId = (event.tool_call_id || event.id) as string;
          const toolName = (event.name || event.function_name) as string;

          let result: string;
          try {
            const rawArgs = event.arguments || event.parameters || {};
            const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : (rawArgs as Record<string, unknown>);

            const t0 = Date.now();
            console.log(`[Tool Call] ${toolName}`, args);
            addTranscriptEntry('agent', `⚙️ ${toolName}...`, false);

            result = handleToolCall(
              engine,
              toolName,
              args,
              () => { setGameState(engine.getGameState()); }
            );

            console.log(`[Tool Done] ${toolName} in ${Date.now() - t0}ms`);
          } catch (toolErr) {
            console.error(`[Tool Error] ${toolName} threw:`, toolErr);
            result = JSON.stringify({ error: `Tool "${toolName}" failed: ${toolErr instanceof Error ? toolErr.message : String(toolErr)}` });
          }

          setGameState(engine.getGameState());

          // Show narration in transcript panel immediately
          try {
            const parsed = JSON.parse(result);
            const displayText = parsed.narration || parsed.description || parsed.moves || parsed.explanation || parsed.error;
            if (displayText) {
              addTranscriptEntry('agent', typeof displayText === 'string' ? displayText : JSON.stringify(displayText), true);
            }
          } catch { /* ignore parse errors */ }

          // Send tool result back to AssemblyAI agent
          agent.sendToolResult(toolCallId, result);
        }
      });

      await agent.connect({
        system_prompt: SYSTEM_PROMPT,
        greeting: GREETING,
        input: {
          format: { encoding: 'audio/pcm' },
          keyterms: CHESS_KEYTERMS,
          turn_detection: {
            vad_threshold: 0.45,
            min_silence: 200,
            max_silence: 1200,
            interrupt_response: true,
          },
        },
        output: {
          voice: 'anna',
          format: { encoding: 'audio/pcm' },
        },
        tools: CHESS_TOOLS,
      });
    } catch (err) {
      console.error('Failed to start:', err);
      setIsStarted(false);
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setAgentStatus('error');
    }
  }, [addTranscriptEntry]);

  const startListening = useCallback(() => {
    stopSpeaking();
    agentRef.current.setListening(true);
    setIsPushToTalk(true);
  }, []);

  const stopListening = useCallback(() => {
    agentRef.current.setListening(false);
    setIsPushToTalk(false);
  }, []);

  const stopGame = useCallback(() => {
    stopSpeaking();
    agentRef.current.disconnect();
    setIsStarted(false);
    setIsPushToTalk(false);
    setAgentStatus('disconnected');
  }, []);

  const newGame = useCallback(() => {
    stopSpeaking();
    engineRef.current.reset();
    setGameState(engineRef.current.getGameState());
    setTranscript([]);
  }, []);

  const describeBoard = useCallback((focus: string = 'full') => {
    const engine = engineRef.current;
    const description = engine.describeBoardState(focus);
    addTranscriptEntry('agent', `📋 ${description.description}`, true);
    setGameState(engine.getGameState());
    agentRef.current.flushAudio();
    speakText(description.description);
  }, [addTranscriptEntry]);

  useEffect(() => {
    if (!isStarted) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const key = e.key.toLowerCase();
      if (key === 'l' && !e.repeat) {
        startListening();
      } else if (key === 'd') {
        describeBoard('full');
      } else if (key === 't') {
        describeBoard('threats');
      } else if (key === 'o') {
        describeBoard('my_pieces');
      } else if (key === 'c') {
        describeBoard('captures');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key.toLowerCase() === 'l') {
        stopListening();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isStarted, describeBoard, startListening, stopListening]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">♔</span>
            <div>
              <h1 className="text-xl font-bold tracking-tight">VoiceChessmate</h1>
              <p className="text-xs text-gray-400">Accessible chess through conversation</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!isStarted ? (
              <button
                onClick={startGame}
                className="px-6 py-2.5 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-green-900/30"
              >
                <span>🎤</span> Start Game
              </button>
            ) : (
              <>
                <button
                  onClick={newGame}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
                >
                  New Game
                </button>
                <button
                  onClick={stopGame}
                  className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-sm rounded-lg transition-colors"
                >
                  ⏹ Stop
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <GameStatus gameState={gameState} agentStatus={agentStatus} />

      {error && (
        <div className="bg-red-900/50 border-b border-red-800 px-6 py-3 text-sm text-red-200">
          <strong>Error:</strong> {error}
          <button
            onClick={() => setError(null)}
            className="ml-4 text-red-400 hover:text-red-300 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <main className="flex-1 max-w-7xl mx-auto w-full p-6">
        {!isStarted ? (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center">
            <div className="text-7xl mb-6">♔</div>
            <h2 className="text-3xl font-bold mb-4">Welcome to VoiceChessmate</h2>
            <p className="text-gray-400 max-w-lg mb-8 leading-relaxed">
              A conversational chess companion for blind and visually impaired players.
              Play chess entirely through voice — make moves, ask about the board,
              get coaching tips, all by talking naturally.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mb-10">
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <div className="text-2xl mb-2">🗣️</div>
                <h3 className="font-semibold text-sm mb-1">Speak Naturally</h3>
                <p className="text-xs text-gray-400">&quot;Eva 4&quot; or &quot;knight to Felix 3&quot;</p>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <div className="text-2xl mb-2">🧠</div>
                <h3 className="font-semibold text-sm mb-1">Get Coaching</h3>
                <p className="text-xs text-gray-400">&quot;What should I do?&quot; or &quot;Any threats?&quot;</p>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <div className="text-2xl mb-2">👁️</div>
                <h3 className="font-semibold text-sm mb-1">See the Board</h3>
                <p className="text-xs text-gray-400">&quot;Describe the position&quot; or &quot;Where&apos;s my rook?&quot;</p>
              </div>
            </div>
            <button
              onClick={startGame}
              className="px-8 py-3 bg-green-600 hover:bg-green-500 text-white font-bold text-lg rounded-xl transition-colors flex items-center gap-3 shadow-xl shadow-green-900/40"
            >
              <span className="text-2xl">🎤</span> Start Playing
            </button>
            <p className="text-xs text-gray-500 mt-4">
              Requires microphone access · Powered by AssemblyAI Voice Agent API
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-6 h-[calc(100vh-180px)]">
            <div className="col-span-3 bg-gray-800/30 rounded-xl border border-gray-700 overflow-hidden flex flex-col">
              <TranscriptPanel entries={transcript} />
            </div>

            <div className="col-span-6 flex flex-col items-center justify-center">
              <ChessBoard
                fen={gameState?.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'}
                lastMove={gameState?.lastMove || null}
              />

              <div className="mt-4 flex flex-col items-center">
                <button
                  onMouseDown={startListening}
                  onMouseUp={stopListening}
                  onTouchStart={startListening}
                  onTouchEnd={stopListening}
                  className={`px-8 py-3.5 rounded-2xl font-bold text-sm flex items-center gap-3 transition-all shadow-lg select-none cursor-pointer ${
                    isPushToTalk
                      ? 'bg-red-600 text-white animate-pulse shadow-red-900/50 scale-105 ring-4 ring-red-400/40'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'
                  }`}
                  title="Hold 'L' key or hold this button while speaking"
                >
                  <span className="text-xl">{isPushToTalk ? '🔴' : '🎙️'}</span>
                  <span>
                    {isPushToTalk
                      ? 'Listening... (Release to Send)'
                      : 'Hold "L" to Speak Move'}
                  </span>
                  <kbd className={`px-2 py-0.5 text-xs rounded font-mono ${isPushToTalk ? 'bg-red-800 text-white' : 'bg-emerald-800 text-emerald-200'}`}>L</kbd>
                </button>
                <p className="text-[11px] text-gray-400 mt-1.5">
                  Hold <kbd className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-300 font-mono">L</kbd> while speaking (e.g. &quot;Eva 4&quot;), release when done
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                <button
                  onClick={() => describeBoard('full')}
                  className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-xs rounded-lg transition-colors cursor-pointer"
                  title="Keyboard: D"
                >
                  📋 Describe Board <kbd className="ml-1 text-gray-400">D</kbd>
                </button>
                <button
                  onClick={() => describeBoard('threats')}
                  className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-xs rounded-lg transition-colors cursor-pointer"
                  title="Keyboard: T"
                >
                  ⚠️ Threats <kbd className="ml-1 text-gray-400">T</kbd>
                </button>
                <button
                  onClick={() => describeBoard('my_pieces')}
                  className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-xs rounded-lg transition-colors cursor-pointer"
                  title="Keyboard: O"
                >
                  ♟ My Pieces <kbd className="ml-1 text-gray-400">O</kbd>
                </button>
                <button
                  onClick={() => describeBoard('captures')}
                  className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-xs rounded-lg transition-colors cursor-pointer"
                  title="Keyboard: C"
                >
                  💀 Captures <kbd className="ml-1 text-gray-400">C</kbd>
                </button>
              </div>
            </div>

            <div className="col-span-3 bg-gray-800/30 rounded-xl border border-gray-700 overflow-hidden flex flex-col">
              <MoveHistory pgn={gameState?.pgn || ''} />
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-gray-800 px-6 py-3 text-center text-xs text-gray-500">
        Built for the AssemblyAI Voice Agent Hackathon 2026 · ♔ VoiceChessmate · MIT License
      </footer>
    </div>
  );
}
```

---

### 4.2 `src/lib/tool-handlers.ts`
Defines agent tools and executes fuzzy scoring to resolve noisy spoken move inputs.

```typescript
import { ChessEngine } from './chess-engine';
import type {
  ValidateMoveArgs,
  GetBoardStateArgs,
  GetLegalMovesArgs,
  ToolDefinition,
  Move,
} from '@/types';

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

const PIECE_NAMES: Record<string, string> = {
  n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king', p: 'pawn',
};

const PIECE_ALIASES: Record<string, string> = {
  knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k', pawn: 'p',
  night: 'n', nights: 'n', horse: 'n', nite: 'n', lite: 'n', kite: 'n',
  bish: 'b', fish: 'b', dish: 'b',
  castle: 'r', tower: 'r', rock: 'r', brook: 'r', roque: 'r',
  cream: 'q', keen: 'q', green: 'q', clean: 'q',
  'the knight': 'n', 'the bishop': 'b', 'the rook': 'r', 'the queen': 'q', 'the king': 'k', 'the pawn': 'p',
  'my knight': 'n', 'my bishop': 'b', 'my rook': 'r', 'my queen': 'q', 'my king': 'k', 'my pawn': 'p',
};

const IBCA_FILES: Record<string, string> = {
  anna: 'a', ana: 'a', honour: 'a', honor: 'a', 'on a': 'a',
  bella: 'b', bela: 'b',
  cesar: 'c', caesar: 'c', ceasar: 'c', sees: 'c', 'sees are': 'c', 'c sir': 'c',
  david: 'd', dave: 'd', 'they would': 'd',
  eva: 'e', eve: 'e', ever: 'e', ava: 'e',
  felix: 'f', feel: 'f', phelix: 'f', phoenix: 'f',
  gustav: 'g', gustave: 'g', gust: 'g', goose: 'g',
  hector: 'h', 'heck tour': 'h', 'heck to': 'h', heater: 'h',
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

  s = s.replace(/\b(please|play|move|go|put|place|make|do|try|let's|let me|i want|i'll|i will|wanna|gonna|um|uh|like|okay|ok|so|then|the|my|a|an)\b/g, ' ');

  const sortedNumbers = Object.entries(NUMBER_WORDS).sort((a, b) => b[0].length - a[0].length);
  for (const [word, digit] of sortedNumbers) {
    s = s.replace(new RegExp(`\\b${word.replace(/\s+/g, '\\s+')}\\b`, 'g'), digit);
  }

  const sortedIBCA = Object.entries(IBCA_FILES).sort((a, b) => b[0].length - a[0].length);
  for (const [name, file] of sortedIBCA) {
    const pattern = new RegExp(`\\b${name.replace(/\s+/g, '\\s+')}\\s*([1-8])\\b`, 'g');
    s = s.replace(pattern, `${file}$1`);
  }

  for (const [name, file] of sortedIBCA) {
    if (name.length <= 1) continue;
    s = s.replace(new RegExp(`\\b${name.replace(/\s+/g, '\\s+')}\\b`, 'g'), file);
  }

  s = s.replace(/\b([a-h])\s+([1-8])\b/g, '$1$2');
  s = s.replace(/\s+/g, ' ').trim();

  return s;
}

function fuzzyMatchMove(description: string, engine: ChessEngine): { move: string; confidence: number } {
  const s = normalizeIBCASpeech(description);
  const legalMoves = engine.getGameState().legalMoves;

  if (legalMoves.length === 0) {
    return { move: '', confidence: 0 };
  }

  const directMatch = legalMoves.find(
    m => m.san.toLowerCase() === s || m.san === description.trim()
  );
  if (directMatch) return { move: directMatch.san, confidence: 1.0 };

  const uciClean = s.replace(/\s/g, '');
  const uciMatch = legalMoves.find(
    m => `${m.from}${m.to}` === uciClean
  );
  if (uciMatch) return { move: uciMatch.san, confidence: 1.0 };

  if (/castl\w*\s*(king|short)/i.test(s) || s === 'castle' || s === 'short castle') {
    const m = legalMoves.find(m => m.san === 'O-O');
    if (m) return { move: m.san, confidence: 1.0 };
  }
  if (/castl\w*\s*(queen|long)/i.test(s) || s === 'long castle') {
    const m = legalMoves.find(m => m.san === 'O-O-O');
    if (m) return { move: m.san, confidence: 1.0 };
  }

  let bestMove = legalMoves[0];
  let bestScore = -1;

  for (const move of legalMoves) {
    let score = 0;

    if (s.includes(move.to)) score += 10;
    if (s.includes(move.from)) score += 5;

    const pieceName = PIECE_NAMES[move.piece];
    if (pieceName && s.includes(pieceName)) score += 8;

    for (const [alias, type] of Object.entries(PIECE_ALIASES)) {
      if (s.includes(alias) && move.piece === type) score += 8;
    }

    const captureWords = ['take', 'takes', 'capture', 'captures', 'x'];
    const mentionsCapture = captureWords.some(w => s.includes(w));
    if (mentionsCapture && move.captured) score += 6;
    if (mentionsCapture && !move.captured) score -= 3;

    if (move.captured) {
      const capturedName = PIECE_NAMES[move.captured];
      if (capturedName && s.includes(capturedName)) score += 4;
    }

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
        const suggestions = engine.getGameState().legalMoves.slice(0, 5).map(m => m.san);
        return JSON.stringify({
          success: false,
          narration: `I'm not sure which move you mean by "${rawMove}". Some options are: ${suggestions.join(', ')}. Could you be more specific?`,
        });
      }

      const result = engine.makeMove(move);

      if (result.success && !result.gameState.isGameOver) {
        const opponentResult = engine.makeEngineMove('intermediate');
        if (onOpponentMove) onOpponentMove(opponentResult);

        const fullNarration = opponentResult.success
          ? `${result.narration} Opponent responds: ${opponentResult.narration}`
          : `${result.narration} Opponent has no legal moves.`;

        const response = {
          success: true,
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
      engine.undoMove();
      const result = engine.undoMove();
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
```

---

### 4.3 `src/lib/system-prompt.ts`
Guides the LLM's role, constraints, and vocabulary.

```typescript
export const SYSTEM_PROMPT = `You are VoiceChessmate, a dedicated chess companion for blind and visually impaired players using the official FIDE and IBCA (International Braille Chess Association) tournament standard.

FIDE/IBCA PHONETIC FILE STANDARD:
Files are always referred to by their official substitute names to prevent audio ambiguity:
A = Anna | B = Bella | C = Cesar | D = David | E = Eva | F = Felix | G = Gustav | H = Hector
Examples: e4 is "Eva 4", f3 is "Felix 3", g1 is "Gustav 1", c4 is "Cesar 4".

CRITICAL RULE — OPPONENT MOVE ANNOUNCEMENT:
After calling apply_move, the tool returns a JSON with a "narration" field. This narration contains BOTH the player's move AND the opponent's response move. You MUST read the ENTIRE narration field aloud immediately, word for word. The opponent's move is the most important thing to announce — the player already knows their own move but cannot see the opponent's.
Example narration: "White pawn to Eva 4. Black pawn to Eva 5." — read ALL of this aloud.
NEVER skip, summarize, or rephrase the opponent's move. NEVER say just "done" or "okay". Always read the full narration.

MOVES & COMMUNICATION:
- Keep responses to one or two sentences during active play.
- When the player says a move, pass their exact words to apply_move. The tool handles parsing. It accepts standard notation ("e4"), IBCA phonetic ("Eva 4"), natural language ("knight to f3", "take his bishop"), and even rough speech.
- After receiving the tool result, read the "narration" field aloud COMPLETELY — it contains your move confirmation AND the opponent's response.
- If the tool returns success:false with a narration asking for clarification, ask the player concisely.

BOARD DESCRIPTIONS:
- When the player says ANYTHING like "describe", "what's on the board", "where is everything", "position", "board", "layout", "setup", "what do you see", "scan", "read the board" — call describe_board immediately with focus "full".
- When asked about specific areas, use: "threats", "kingside", "queenside", "center", "my_pieces", "captures".
- Read the description result aloud completely — the player depends on hearing every detail.

HELP & RULES:
- The player plays White, the engine plays Black.
- Only give advice when asked ("what should I do?", "hint"). Call get_hint.
- "Take back" / "undo" -> call undo_move.
- "Options" / "what can I do?" / "what are my moves?" -> call get_legal_moves.
- Keep responses brief, crisp, and focused.
- Be forgiving of speech — the player may say "night" for "knight", "e for" for "e4", etc. Always pass their words to the tool and let it figure out the best match.`;

export const GREETING = "Board is set. You're White. Hold 'L' to speak your move — like 'Eva 4' or 'knight to Felix 3'.";

export const CHESS_KEYTERMS = [
  'Anna', 'Bella', 'Cesar', 'Caesar', 'David', 'Eva', 'Felix', 'Gustav', 'Hector',
  'Anna 1', 'Anna 2', 'Anna 3', 'Anna 4', 'Anna 5', 'Anna 6', 'Anna 7', 'Anna 8',
  'Bella 1', 'Bella 2', 'Bella 3', 'Bella 4', 'Bella 5', 'Bella 6', 'Bella 7', 'Bella 8',
  'Cesar 1', 'Cesar 2', 'Cesar 3', 'Cesar 4', 'Cesar 5', 'Cesar 6', 'Cesar 7', 'Cesar 8',
  'David 1', 'David 2', 'David 3', 'David 4', 'David 5', 'David 6', 'David 7', 'David 8',
  'Eva 1', 'Eva 2', 'Eva 3', 'Eva 4', 'Eva 5', 'Eva 6', 'Eva 7', 'Eva 8',
  'Felix 1', 'Felix 2', 'Felix 3', 'Felix 4', 'Felix 5', 'Felix 6', 'Felix 7', 'Felix 8',
  'Gustav 1', 'Gustav 2', 'Gustav 3', 'Gustav 4', 'Gustav 5', 'Gustav 6', 'Gustav 7', 'Gustav 8',
  'Hector 1', 'Hector 2', 'Hector 3', 'Hector 4', 'Hector 5', 'Hector 6', 'Hector 7', 'Hector 8',
  'e4', 'e5', 'd4', 'd5', 'c4', 'c5', 'f3', 'f6', 'g1', 'g8', 'b5', 'a3', 'h3', 'h6',
  'knight', 'bishop', 'rook', 'queen', 'king', 'pawn',
  'night', 'horse', 'tower', 'castle',
  'knight to', 'bishop to', 'rook to', 'queen to', 'king to', 'pawn to',
  'move knight', 'move bishop', 'move rook', 'move queen', 'move king', 'move pawn',
  'takes', 'captures', 'take', 'capture',
  'castles', 'castle kingside', 'castle queenside', 'kingside', 'queenside', 'en passant',
  'check', 'checkmate', 'stalemate',
  'describe', 'describe the board', 'describe board', 'describe position',
  'position', 'board', 'what do you see', 'where is everything',
  'read the board', 'scan the board', 'layout', 'setup',
  'threats', 'options', 'what can I do', 'what are my moves',
  'undo', 'take back', 'undo move',
  'hint', 'what should I do', 'help', 'suggest',
  'my pieces', 'captures', 'captured pieces',
];
```

---

### 4.4 `public/audio-processor.js`
Runs in the browser's AudioWorklet thread to package PCM16 chunks without UI stutter.

```javascript
class PCMProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.chunkSize = options.processorOptions?.chunkSize || 1200;
    this.buffer = new Float32Array(0);
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0];

    const newBuffer = new Float32Array(this.buffer.length + channelData.length);
    newBuffer.set(this.buffer);
    newBuffer.set(channelData, this.buffer.length);
    this.buffer = newBuffer;

    while (this.buffer.length >= this.chunkSize) {
      const chunk = this.buffer.slice(0, this.chunkSize);
      this.buffer = this.buffer.slice(this.chunkSize);

      const pcm16 = new Int16Array(chunk.length);
      for (let i = 0; i < chunk.length; i++) {
        const s = Math.max(-1, Math.min(1, chunk[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      this.port.postMessage(pcm16);
    }

    return true;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
```

---

### 4.5 `src/app/api/token/route.ts`
Server-side security bridge ensuring credentials stay private.

```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.ASSEMBLYAI_API_KEY;

  console.log(`[Token Route] API key present: ${!!apiKey}, length: ${apiKey?.length || 0}, starts with: ${apiKey?.slice(0, 4) || 'N/A'}...`);

  if (!apiKey || apiKey === 'your_api_key_here') {
    return NextResponse.json(
      { error: 'ASSEMBLYAI_API_KEY not configured. Edit .env.local and restart the dev server.' },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      'https://agents.assemblyai.com/v1/token?expires_in_seconds=300&max_session_duration_seconds=3600',
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token minting failed:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to mint token' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Token minting error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

---

## 5. Critical Fixes Implemented

1. **Dual-Audio Collisions Resolved:**
   - Previously, the client triggered browser `speakText()` alongside AssemblyAI's voice audio return.
   - We separated responsibilities: AssemblyAI's agent voice strictly handles tool results and moves; browser TTS is reserved solely for instantaneous keyboard shortcuts (D, T, O, C).
2. **Opponent Move Announcement Ensured:**
   - Tool `apply_move` outputs a consolidated `narration` field: `"White pawn to Eva 4. Opponent responds: Black pawn to Eva 5."`
   - The LLM prompt enforces reading this entire field aloud verbatim without omitting the opponent response.
3. **Robust Speech Parsing & IBCA Support:**
   - Strips conversational fillers ("please play", "move to", "can you").
   - Resolves words like "night" -> "knight", "see 4" -> "c4", "Eva 4" -> "e4".
   - Excluded ambiguous substitutions (e.g. mapping "to" to "2" was removed because it broke "knight to f3").
4. **VAD (Voice Activity Detection) Calibration:**
   - Extended `max_silence` from 700ms to 1200ms so players can pause naturally between piece and coordinate names without premature cutoff.

---
