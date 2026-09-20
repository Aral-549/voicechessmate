# Project: VoiceChessmate

## Architecture
VoiceChessmate is an accessible, conversational voice-first chess companion for blind and visually impaired players powered by AssemblyAI's Voice Agent API and FIDE/IBCA phonetic standards.

### System Architecture
1. **Chess Core (`src/lib/chess-engine.ts`)**:
   - Manages game state via `chess.js`.
   - Generates natural language narration, blind-chess spatial models, board scan (strictly Rank 1 to Rank 8).
   - Computes opponent moves across 3 selectable difficulty levels ('beginner', 'intermediate', 'advanced'/'master') within 1500ms latency.
   - Manages stateful move history and capture history with reversible undo.
   - Handles resignation and game-over states.

2. **Voice Command & Tool Dispatching (`src/lib/tool-handlers.ts`)**:
   - Normalizes IBCA phonetic notation (Anna through Hector) and standard algebraic notation.
   - Resolves ASR homophones ("night" -> "knight", "see four" -> "c4", "before" -> "b4").
   - Computes fuzzy move confidence and flags ambiguity with confidence < 0.6 for verbal clarification.
   - Scores pawn promotion candidate moves to match requested promotion piece.
   - Dispatches tools (`apply_move`, `describe_board`, `get_hint`, `undo_move`, `resign_game`, `set_difficulty`).

3. **Accessibility & Audio UI (`src/components/`, `src/app/page.tsx`)**:
   - Full keyboard navigation covering all interactive controls without requiring mouse input.
   - ARIA live regions announcing turn changes, check, game-over states, and agent speech responses.
   - Push-to-talk / push-to-listen state machine with instant audio stream muting and flush on interruption.
   - Web Audio synthesized sound cues for move, capture, check, victory, and error.

4. **Mock Test Harness & Verification (`src/lib/__tests__/`, `src/lib/mock-voice-agent.ts`)**:
   - Headless mock agent test harness for CI execution without live `ASSEMBLYAI_API_KEY`.
   - Comprehensive test suite with >= 30 tests covering IBCA, SAN, castling, promotion, en passant, resignation, board scan, engine difficulty, homophones, and tool dispatching.

---

## Feature Inventory
Every feature from the Survey phase appears here with its assigned milestone.
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | IBCA Phonetic Notation | Support Anna, Bella, Cesar, David, Eva, Felix, Gustav, Hector ("Eva 4", "Felix 3", "Cesar 4") | M2, E2E | ORIGINAL_REQUEST §R1 |
| 2 | Standard Algebraic Notation | Standard SAN moves parsing and execution (e.g. "Nf3", "e4", "O-O") | M1, E2E | ORIGINAL_REQUEST §R1 |
| 3 | Castling Moves | Kingside and queenside castling voice commands and notation | M1, E2E | ORIGINAL_REQUEST §R1 |
| 4 | Pawn Promotion | Support voice pawn promotion with piece selection (Queen, Rook, Bishop, Knight) | M1, M2, E2E | ORIGINAL_REQUEST §R1 |
| 5 | En Passant Capture | Execution and narration of en passant captures | M1, E2E | ORIGINAL_REQUEST §R1 |
| 6 | Resignation | Verbal resignation ("I resign") and resignation tool handling | M1, M2, E2E | ORIGINAL_REQUEST §R1 |
| 7 | Homophone Resolution | ASR homophones: "night"->"knight", "see four"->"c4", "before"->"b4" | M2, E2E | ORIGINAL_REQUEST §R3 |
| 8 | Ambiguity Handling | Confidence threshold < 0.6 flags for verbal clarification; tie detection | M2, E2E | ORIGINAL_REQUEST §R3 |
| 9 | Board Scan Rank 1-8 | Occupied squares strictly ordered from Rank 1 to Rank 8 with piece identity & coords | M1, E2E | ORIGINAL_REQUEST §R1 |
| 10 | Opponent Engine Latency | Legal engine responses within 1500ms without blocking UI | M1, E2E | ORIGINAL_REQUEST §R2 |
| 11 | 3 Selectable Difficulties | Distinct move selection characteristics in automated tests | M1, M2, E2E | ORIGINAL_REQUEST §R2 |
| 12 | Move Undo & History | Undo move properly reverts board state and captured pieces history | M1, E2E | ORIGINAL_REQUEST §R1 |
| 13 | Move Error Handling | Invalid moves rejected with verbal explanation and state preservation | M1, M2, E2E | ORIGINAL_REQUEST §R1 |
| 14 | Keyboard Shortcuts | All interactive elements operable via keyboard shortcuts | M3, E2E | ORIGINAL_REQUEST §R4 |
| 15 | ARIA Live Regions | Screen-reader announcements for turn changes, check, game-over, and agent speech | M3, E2E | ORIGINAL_REQUEST §R4 |
| 16 | Audio Interruption Muting | Push-to-talk flushes audio buffer (`flushAudio()`) on interruption | M3, E2E | ORIGINAL_REQUEST §R4 |
| 17 | Audio Sound Cues | Sound feedback for game events (move, capture, check, win, error) | M3, E2E | ORIGINAL_REQUEST §R4 |
| 18 | Mock Test Harness | Headless mock audio/agent test harness running in CI without API key | M4, E2E | ORIGINAL_REQUEST §R5 |
| 19 | Zero ESLint Warnings | `npm run lint` passes with zero errors and zero warnings | M2, Final | ORIGINAL_REQUEST §Build |
| 20 | Zero Build Errors | `npm run build` compiles with zero Next.js or TypeScript errors | Final | ORIGINAL_REQUEST §Build |
| 21 | Comprehensive Test Suite | `npm test` passes cleanly with >= 30 distinct tests | E2E, Final | ORIGINAL_REQUEST §R5 |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E | E2E Testing Track | Independent opaque-box test harness and test cases (Tiers 1-4, >=30 tests), TEST_READY.md | none | DONE |
| M1 | Core Chess Engine & Rules | Fix undo capture state corruption, implement resignation, distinct 3 difficulty levels, rank 1-8 board scan, verify latency < 1500ms | none | DONE |
| M2 | Speech Robustness & Tools | Fix homophone "before"->b4, pawn promotion scoring, ambiguity threshold < 0.6, tie detection, resign/difficulty tools, fix ESLint warnings | M1 | DONE |
| M3 | Accessibility & Audio Polish | Keyboard shortcuts for all controls, ARIA live regions, sound cues, flushAudio on interrupt | M2 | DONE |
| M4 | Mock CI Audio/Agent Harness | Headless mock agent test harness for CI execution without live credentials | M2 | DONE |
| M_FINAL | Final Milestone | Pass 100% of E2E test suite (Tiers 1-4), Tier 5 Adversarial Hardening, clean lint, clean build, Forensic Integrity Audit | E2E, M1, M2, M3, M4 | DONE |

---

## Interface Contracts
### ChessEngine (`src/lib/chess-engine.ts`)
- `constructor(fen?: string)`
- `makeMove(moveInput: string | { from: string; to: string; promotion?: string }): MoveResult`
- `undoMove(): MoveResult` — reverts both `game.undo()` and `capturedPieces`
- `resign(color?: 'w' | 'b'): GameState` — sets game-over resignation state
- `makeEngineMove(difficulty: 'beginner' | 'intermediate' | 'advanced' | 'master'): MoveResult` — returns within 1500ms with distinct move characteristics
- `describeBoardState(type: 'full' | 'mine' | 'threats' | 'captures' | 'scan'): string` — 'scan' outputs Rank 1 to Rank 8 strictly
- `getGameState(): GameState`

### Tool Handlers (`src/lib/tool-handlers.ts`)
- `handleToolCall(engine: ChessEngine, toolName: string, args: Record<string, unknown>, difficulty?: DifficultyLevel): ToolResult`
- `normalizeIBCASpeech(text: string): string` — includes "before" -> "b4"
- `fuzzyMatchMove(legalMoves: Move[], speechText: string): FuzzyMatchResult` — confidence < 0.6 flags clarification, handles promotion piece

### Audio & Accessibility
- Global keyboard event listeners (`useKeyboardShortcuts`) for all interactive actions
- Live regions (`role="status"`, `aria-live="polite"` / `assertive`) in GameStatus and TranscriptPanel
- Sound feedback synthesized via Web Audio API or audio elements
- `flushAudio()` invoked synchronously when speech input begins

---

## Code Layout
- `src/lib/chess-engine.ts` — Owned by M1 Worker
- `src/lib/tool-handlers.ts` — Owned by M2 Worker
- `src/app/api/token/route.ts` — Owned by M2 Worker (fix unused var)
- `src/components/`, `src/app/page.tsx` — Owned by M3 Worker
- `src/lib/mock-voice-agent.ts`, `src/lib/__tests__/mock-harness.test.ts` — Owned by M4 Worker
- `src/lib/__tests__/e2e-suite.test.ts`, `tests/` — Owned by E2E Testing Track

