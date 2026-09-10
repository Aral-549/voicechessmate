// ============================================================
// VoiceChessmate — Main Application Page
// Wires together: Voice Agent + Chess Engine + UI Components
// ============================================================

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
  // --- State ---
  const [agentStatus, setAgentStatus] = useState<VoiceAgentStatus>('disconnected');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [isStarted, setIsStarted] = useState(false);
  const [isPushToTalk, setIsPushToTalk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Refs (persist across renders without triggering re-render) ---
  const engineRef = useRef<ChessEngine>(new ChessEngine());
  const agentRef = useRef<VoiceAgentManager>(new VoiceAgentManager());
  const partialTranscriptRef = useRef<string>('');
  const agentTextRef = useRef<string>('');

  // Initialize game state
  useEffect(() => {
    setGameState(engineRef.current.getGameState());
  }, []);

  // --- Transcript Helpers ---
  const addTranscriptEntry = useCallback((
    speaker: 'user' | 'agent',
    text: string,
    isFinal: boolean
  ) => {
    setTranscript(prev => {
      // If updating a partial entry from same speaker, replace the last one
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

  // --- Start Game ---
  const startGame = useCallback(async () => {
    setError(null);
    setIsStarted(true);

    try {
      const agent = agentRef.current;
      const engine = engineRef.current;

      // Reset game
      engine.reset();
      setGameState(engine.getGameState());
      setTranscript([]);

      // Clear any stale handlers from a previous game session
      agent.clearHandlers();

      // Set up agent event handlers
      agent.onStatusChange((status) => {
        setAgentStatus(status);
      });

      const sessionStartTime = Date.now();
      let lastUserFinalTime = 0;

      agent.on('*', (event) => {
        const type = event.type as string;
        const elapsed = Date.now() - sessionStartTime;
        console.log(`[AAI +${elapsed}ms]`, type, JSON.stringify(event).slice(0, 300));

        // --- Session ready (no need to add greeting here — it arrives via agent deltas + reply.done) ---
        if (type === 'session.ready') {
          console.log('[VoiceAgent] Session ready, waiting for greeting audio...');
        }

        // --- Reply started: reset agent text accumulator for this new reply ---
        if (type === 'reply.started') {
          agentTextRef.current = '';
        }

        // --- Agent speech streaming (ONLY match the real event type) ---
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

        // --- User transcript (partial & final) ---
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

        // --- Reply done: finalize agent text in transcript ---
        if (type === 'reply.done') {
          if (agentTextRef.current) {
            addTranscriptEntry('agent', agentTextRef.current, true);
            agentTextRef.current = '';
          }
        }

        // --- Tool calls ---
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

          // Show narration in transcript panel immediately (don't wait for agent audio)
          try {
            const parsed = JSON.parse(result);
            const displayText = parsed.narration || parsed.description || parsed.moves || parsed.explanation || parsed.error;
            if (displayText) {
              addTranscriptEntry('agent', typeof displayText === 'string' ? displayText : JSON.stringify(displayText), true);
            }
          } catch { /* ignore parse errors */ }

          // Send tool result to agent — the agent's audio stream will speak the response.
          // Do NOT also use browser TTS here; dual audio causes garbled/delayed opponent moves.
          agent.sendToolResult(toolCallId, result);
        }
      });

      // Connect to AssemblyAI
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

  // --- Push-to-Listen Handlers ---
  const startListening = useCallback(() => {
    stopSpeaking();
    agentRef.current.setListening(true);
    setIsPushToTalk(true);
  }, []);

  const stopListening = useCallback(() => {
    agentRef.current.setListening(false);
    setIsPushToTalk(false);
  }, []);

  // --- Stop Game ---
  const stopGame = useCallback(() => {
    stopSpeaking();
    agentRef.current.disconnect();
    setIsStarted(false);
    setIsPushToTalk(false);
    setAgentStatus('disconnected');
  }, []);

  // --- New Game ---
  const newGame = useCallback(() => {
    stopSpeaking();
    engineRef.current.reset();
    setGameState(engineRef.current.getGameState());
    setTranscript([]);
  }, []);

  // --- Describe Board (instant, with voice playback for blind accessibility) ---
  const describeBoard = useCallback((focus: string = 'full') => {
    const engine = engineRef.current;
    const description = engine.describeBoardState(focus);
    addTranscriptEntry('agent', `📋 ${description.description}`, true);
    setGameState(engine.getGameState());
    // Flush agent audio so TTS doesn't compete, then speak immediately
    agentRef.current.flushAudio();
    speakText(description.description);
  }, [addTranscriptEntry]);

  // --- Keyboard Shortcuts & Push-to-Talk (Hold L) ---
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

  // --- Render ---
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
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

      {/* Game Status Bar */}
      <GameStatus gameState={gameState} agentStatus={agentStatus} />

      {/* Error Banner */}
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

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-6">
        {!isStarted ? (
          // Landing / Pre-game Screen
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
          // Game Screen
          <div className="grid grid-cols-12 gap-6 h-[calc(100vh-180px)]">
            {/* Left: Transcript */}
            <div className="col-span-3 bg-gray-800/30 rounded-xl border border-gray-700 overflow-hidden flex flex-col">
              <TranscriptPanel entries={transcript} />
            </div>

            {/* Center: Chess Board */}
            <div className="col-span-6 flex flex-col items-center justify-center">
              <ChessBoard
                fen={gameState?.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'}
                lastMove={gameState?.lastMove || null}
              />
              {/* Push-to-Talk / Hold L to Speak Button */}
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

              {/* Quick Actions (Speaks Aloud) */}
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

            {/* Right: Move History */}
            <div className="col-span-3 bg-gray-800/30 rounded-xl border border-gray-700 overflow-hidden flex flex-col">
              <MoveHistory pgn={gameState?.pgn || ''} />
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 px-6 py-3 text-center text-xs text-gray-500">
        Built for the AssemblyAI Voice Agent Hackathon 2026 · ♔ VoiceChessmate · MIT License
      </footer>
    </div>
  );
}
