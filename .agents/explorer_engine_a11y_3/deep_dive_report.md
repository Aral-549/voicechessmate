# VoiceChessmate — Deep-Dive Investigation Report
**Explorer**: `explorer_engine_a11y_3` (Engine & Accessibility Explorer)  
**Date**: September 13, 2026  
**Target Repository**: `/home/h3r0-k1ll3r/Downloads/assemblyai/voicechessmate`  
**Reference Directives**: `ORIGINAL_REQUEST.md`, `PROJECT_CONTEXT.md`, `ASSEMBLYAI_VOICE_AGENT_HACKATHON.md`

---

## Executive Summary

VoiceChessmate has a strong architectural foundation pairing AssemblyAI's Voice Agent API with `chess.js` and an IBCA phonetic narration layer. The project builds cleanly with Next.js Turbopack (`npm run build` succeeds in ~1s).

However, an exhaustive code and test audit reveals several **critical gaps, functional bugs, and accessibility omissions** against the requirements in `ORIGINAL_REQUEST.md`:

1. **Chess Engine & Difficulty Scaling**: Opponent move difficulty is hardcoded to `'intermediate'` in `src/lib/tool-handlers.ts:291`. The UI has zero controls to select difficulty. The engine uses a 1-ply greedy heuristic rather than minimax, causing `'advanced'` and `'master'` to behave identically, while `'intermediate'` relies on 30% uniform randomness. Calculation is synchronous on the main JavaScript UI thread.
2. **Voice Parser & Homophone Resolution**: While "night" -> "knight" and "see four" -> "c4" are handled, **"before" -> "b4" completely fails**, scoring 0 and resulting in an unrecognized move. Furthermore, `tool-handlers.ts:278` uses `confidence < 0.5` instead of the mandated `< 0.6` threshold. When two distinct legal moves tie for the highest score, the parser silently plays the first one instead of flagging ambiguity for clarification.
3. **Accessibility (A11y) & Audio UI**: **Zero ARIA live regions exist anywhere in `src/`** (0 matches for `aria-` or `role=`). Screen readers cannot detect turn changes, check/checkmate, or agent responses. Keyboard shortcuts only function after game start (no shortcut to start or reset). A **critical audio muting bug** was uncovered: `startListening()` calls `stopSpeaking()` (cancelling only browser Web Speech synthesis) but **fails to call `agentRef.current.flushAudio()`**, causing agent WebSocket playback to talk over the user during barge-in.
4. **Mock Test Harness & Headless CI**: Currently only 18 tests exist (9 in `chess-engine.test.ts`, 9 in `tool-handlers.test.ts`), falling short of the required 30+ tests. There is no mock voice agent test harness for headless CI execution without an `ASSEMBLYAI_API_KEY`.
5. **Code Quality**: `npm run lint` yields 3 unused variable warnings (`referer` in `src/app/api/token/route.ts:40`, `ValidateMoveArgs` and `Move` in `src/lib/tool-handlers.ts:11,15`).

---

## Section 1: Chess Engine & Difficulty Scaling

### 1.1 Current Opponent Engine Implementation
The chess engine layer is implemented in `src/lib/chess-engine.ts` using `chess.js` (v1.4.0):
- **Opponent Move Trigger**: In `src/lib/tool-handlers.ts:289-293`:
  ```typescript
  if (result.success && !result.gameState.isGameOver) {
    const opponentResult = engine.makeEngineMove('intermediate');
    if (onOpponentMove) onOpponentMove(opponentResult);
  ```
  `makeEngineMove` is called with hardcoded `'intermediate'`. The caller (`page.tsx`) passes no difficulty parameter, and the tool router does not inspect session state for difficulty.
- **Evaluation Heuristic (`getSimpleEvaluation()`, `chess-engine.ts:384-445`)**:
  Opponent move selection evaluates candidate moves using a 1-ply greedy static score:
  - Checkmate: `+10000`
  - Check: `+50`
  - MVV-LVA (Most Valuable Victim - Least Valuable Attacker) capture: `victimValues[captured] * 10 - attackerValues[piece]`
  - Center control (`d4, d5, e4, e5`): `+5`
  - Minor piece development from back rank: `+3`
  - Castling (`O-O`, `O-O-O`): `+8`

### 1.2 Analysis of Current 3 Difficulty Levels
The engine defines four enum values in `src/types/index.ts`: `'beginner' | 'intermediate' | 'advanced' | 'master'`. In `chess-engine.ts:462-487`:
| Level | Implementation in Code | Behavior & Deficiencies |
|---|---|---|
| **Beginner** | `moves[Math.floor(Math.random() * moves.length)]` | 100% uniform random selection. Plays suicidal blunders, ignores checkmate opportunities, hangs queens. |
| **Intermediate** | Filters moves with captures or checks; if found and `Math.random() > 0.3`, picks one at random; else uniform random. | 70% chance of random capture/check, 30% completely random move. If no captures/checks exist, plays 100% randomly. Completely non-deterministic and lacks positional play. |
| **Advanced** | Calls `this.getSimpleEvaluation()` and picks highest scored move. | 1-ply greedy heuristic. Does not look ahead to opponent's response. Cannot detect forks, pins, skewers, or mate-in-2. |
| **Master** | Identical fall-through to Advanced. | No distinction from Advanced. |

**Acceptance Criteria Gap**:
The requirement demands:
> "Engine supports at least 3 selectable difficulty levels that exhibit demonstrably distinct move selection characteristics in automated tests."

Currently:
1. Difficulty is hardcoded to `'intermediate'`.
2. Tests cannot verify distinct characteristics deterministically due to `Math.random()` in intermediate and identical logic in advanced/master.
3. No UI or tool command allows the player to switch difficulty.

### 1.3 Execution Timing & Asynchronous Architecture
- **Performance Benchmark**: On current 1-ply search, move computation takes **1–5ms**.
- **Timing Requirement**: `< 1500ms` across all game phases (opening, middlegame, endgame).
- **Concurrency Issue**: `engine.makeEngineMove` runs **synchronously on the main JavaScript thread** during `handleToolCall()`.
  If search depth is increased to 2 or 3 plies using Minimax with Alpha-Beta pruning (evaluating ~1,000 to ~20,000 nodes in JavaScript), execution will take between **25ms and 250ms**. Running this synchronously blocks the browser event loop, causing dropped frames and audio buffer underruns in `AudioWorkletNode` or `ScriptProcessorNode`.
- **Recommended Architectural Solution**:
  1. Add an asynchronous engine interface:
     ```typescript
     async makeEngineMoveAsync(difficulty: Difficulty): Promise<MoveResult>
     ```
  2. For browser execution without blocking the UI, execute via macrotask yielding (`new Promise(resolve => setTimeout(() => resolve(this.makeEngineMove(difficulty)), 0))`) or a lightweight Web Worker (`chess-worker.ts`).
  3. Implement a clean 2–3 ply Minimax with Alpha-Beta pruning and Piece-Square Tables (PST):
     - **Beginner**: 1-ply greedy heuristic with 30% blunder jitter (or depth 1).
     - **Intermediate**: 2-ply Minimax (material + basic piece mobility). Never hangs a piece to direct 1-ply recapture.
     - **Advanced**: 3-ply Alpha-Beta Minimax with Piece-Square Tables (PST) + king safety + center control. Detects simple tactics and mate-in-2.

---

## Section 2: Voice Parser & ASR Error Resilience

### 2.1 Spoken Move Normalization Pipeline
Spoken moves are received via `apply_move` tool calls with argument `move_description`. In `src/lib/tool-handlers.ts`:
1. `normalizeIBCASpeech(raw)` cleans filler words, replaces written numbers with digits, converts IBCA phonetic names (`Eva 4` -> `e4`), and collapses spaces.
2. `fuzzyMatchMove(description, engine)` checks:
   - Direct SAN match (`m.san.toLowerCase() === s`)
   - UCI coordinate match (`${m.from}${m.to} === uciClean`)
   - Castling regex (`castle`, `short castle`, `castle kingside`, `long castle`, etc.)
   - Heuristic legal-move scoring (destination: +10, source: +5, piece: +8, capture: +6, pawn: +2).

### 2.2 Homophone Matching & ASR Mis-Hearing Analysis
Let us trace the three mandatory test cases from the Acceptance Criteria:
> "Fuzzy move parser correctly resolves common chess homophones and ASR errors ('night' -> 'knight', 'see four' -> 'c4', 'before' -> 'b4')"

1. **"night" -> "knight"** (`night to f3`):
   - **Observed Result**: **PASSES (Confidence 0.9)**.
   - Trace: `PIECE_ALIASES` in `tool-handlers.ts:103` explicitly maps `'night': 'n'`.
2. **"see four" -> "c4"**:
   - **Observed Result**: **PASSES (Confidence 1.0)**.
   - Trace: `NUMBER_WORDS` maps `'four'` -> `'4'`. `IBCA_FILES` maps `'see': 'c'`. `\bsee\s*([1-8])\b` converts `'see 4'` -> `'c4'`. Direct SAN match resolves `c4`.
3. **"before" -> "b4"**:
   - **Observed Result**: **FAILS COMPLETELY (Confidence 0.2, Rejected)**.
   - Trace:
     - `raw = "before"`.
     - `NUMBER_WORDS` matches `\bfour\b`, which does NOT match `"before"` (bounded by word boundary `\b`).
     - `IBCA_FILES` has `'bee': 'b'`, but not `'before'`.
     - Output of `normalizeIBCASpeech` remains `"before"`.
     - In `fuzzyMatchMove`: `"before"` does not contain `"b4"`. `s.includes(move.to)` evaluates to `false`.
     - `bestScore` is `0` (or `-1`), `confidence` is `0.2`.
     - `handleToolCall` executes:
       `if (confidence < 0.5) return {"success": false, "narration": "I'm not sure which move you mean by \"before\"..."}`.
     - **Defect**: The parser fails to recognize "before" as a move to `b4`.
     - **Required Fix**: Add explicit phonetic contractions to `normalizeIBCASpeech`:
       - `\bbefore\b` -> `'b4'`
       - `\b(be|bee|b)\s+(four|for|fore)\b` -> `'b4'`
       - `\b(see|sea|c)\s+(four|for|fore)\b` -> `'c4'`
       - `\b(day|de|d)\s+(four|for|fore)\b` -> `'d4'`
       - `\b(eva|eve|e)\s+(four|for|fore)\b` -> `'e4'`

### 2.3 Confidence Scoring & Ambiguity Clarification
- **Threshold Discrepancy**:
  - Requirement:
    > "flags ambiguous moves with confidence < 0.6 for verbal clarification."
  - Current Code (`tool-handlers.ts:278`):
    ```typescript
    if (confidence < 0.5) {
      const suggestions = engine.getGameState().legalMoves.slice(0, 5).map(m => m.san);
      return JSON.stringify({
        success: false,
        narration: `I'm not sure which move you mean by "${rawMove}". Some options are: ${suggestions.join(', ')}. Could you be more specific?`,
      });
    }
    ```
    If an ambiguous move scores `confidence = 0.5` (or a future scoring adjustment yields `0.55`), it bypasses clarification because `0.5 < 0.5` is false! The threshold must be strictly `< 0.6`.
- **Tie-Breaking Blindspot (Multi-Piece Ambiguity)**:
  In `fuzzyMatchMove`, when iterating through legal moves:
  ```typescript
  for (const move of legalMoves) {
    ...
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  ```
  If two distinct legal moves tie with the exact same high score (e.g. user says `"knight to d4"` when both `Nbd4` and `Nfd4` can reach `d4`), `bestScore` is updated on the first move. The second move has `score === bestScore`, so `score > bestScore` is `false`.
  The parser **silently selects the first knight** with `confidence: 0.9` without detecting ambiguity!
  **Required Fix**: Count top-scoring moves. If `topMatches.length > 1` with identical or close scores, set `confidence = 0.4` and return a disambiguation prompt specifying the source squares: `"Did you mean knight on b1 to d4, or knight on f3 to d4?"`.

### 2.4 Special Moves Coverage
- **Castling**: Handled for "castle kingside" (`O-O`) and "castle queenside" (`O-O-O`).
- **En Passant**: `chess.js` handles `exf6` if en passant is legal, but spoken input like "pawn takes on f6 en passant" needs fuzzy capture matching to recognize the source and destination squares properly.
- **Pawn Promotion**: If a player reaches rank 8 and says "Eva 8 Queen" or "pawn to e8", `chess.js` `game.move(moveInput)` requires a promotion piece (e.g., `{ from: 'e7', to: 'e8', promotion: 'q' }`). Currently, `apply_move` does not extract the promotion piece symbol, defaulting or failing on rank 8 pushes.
- **Resignation**: Currently unhandled in `CHESS_TOOLS`. If player says "I resign", `apply_move` attempts to match it against legal moves and fails. A `resign_game` tool or voice command recognition is needed.

### 2.5 Board Scan Rank Ordering & IBCA Formatting
In `src/lib/chess-engine.ts:194-224`, `describeFullBoard` implements:
- Scan loops `for (let r = 1; r <= 8; r++)` (Rank 1 through Rank 8).
- Square conversion uses `IBCA_FILE_NAMES` (`Anna` through `Hector`) and rank number `r`.
- Outputs format: `Rank ${r}: White pawn Anna 2, White pawn Bella 2...`
- **Result**: Complies with the IBCA tournament standard and Acceptance Criteria requirement. However, test coverage verifying strict Rank 1 to 8 ordering is currently absent from `chess-engine.test.ts`.

---

## Section 3: Accessibility & Audio UI

### 3.1 ARIA Live Regions Audit
A full regex search across `src/` confirmed:
**There are zero `aria-live`, `role="status"`, or `role="alert"` regions anywhere in the codebase.**
For a blind or visually impaired user running a screen reader (JAWS, NVDA, VoiceOver, Orca):
- The screen reader announces **nothing** when the game starts.
- The screen reader announces **nothing** when a move is made or turn changes ("White to move" / "Black to move").
- The screen reader announces **nothing** when the King is placed in Check or Checkmate occurs.
- The screen reader announces **nothing** when the AssemblyAI voice agent returns transcript deltas or game narrations.

**Required ARIA Implementation**:
1. **Status Live Region (`role="status" aria-live="polite" aria-atomic="true"`)**:
   Announces turn changes, piece captures, move numbers, and agent connectivity ("Connected", "Ready", "Listening").
2. **Alert Live Region (`role="alert" aria-live="assertive" aria-atomic="true"`)**:
   Announces high-priority events immediately: "Check!", "Checkmate! White wins", "Error: Microphone disconnected".
3. **Agent Narration Live Region (`role="log" aria-live="polite" aria-relevant="additions"`)**:
   Announces incoming agent speech narrations for screen readers.

### 3.2 Keyboard Navigation & Focus Management
- **Current Keyboard Handlers (`src/app/page.tsx:300-334`)**:
  - `L`: Push-to-listen (`startListening` on keydown, `stopListening` on keyup).
  - `D`: Describe board (`full`).
  - `T`: Describe board (`threats`).
  - `O`: Describe board (`my_pieces`).
  - `C`: Describe board (`captures`).
- **Gaps**:
  1. Shortcuts are disabled before game start (`if (!isStarted) return;`). A blind user cannot press a key (e.g. `Enter` or `S`) to start the game!
  2. No keyboard shortcuts exist for:
     - `N` or `R`: New game / Reset.
     - `Escape` or `X`: Stop game.
     - `U`: Undo move.
     - `H`: Get hint / coaching advice.
     - `1`, `2`, `3`: Switch difficulty (Beginner, Intermediate, Advanced).
  3. **Focus Management**:
     - On page load, document focus is `<body>`.
     - When "Start Game" is activated, focus is not shifted to the primary voice interaction control or chessboard landmark.
     - Interactive elements lack visible high-contrast focus rings (`focus-visible:ring-2 focus-visible:ring-amber-400`).

### 3.3 Audio Pipeline, Push-to-Talk & Interruption (Barge-In) Muting
In `src/app/page.tsx:259-269`:
```typescript
const startListening = useCallback(() => {
  stopSpeaking();
  agentRef.current.setListening(true);
  setIsPushToTalk(true);
}, []);
```
And in `src/lib/speech.ts:41-43`:
```typescript
export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
```

**CRITICAL AUDIO MUTING BUG DISCOVERED**:
- `stopSpeaking()` ONLY cancels the browser's built-in `window.speechSynthesis`.
- But AssemblyAI's voice audio does NOT use `speechSynthesis`! It streams 24kHz PCM16 audio chunks over WebSocket (`reply.audio`), which are queued in `VoiceAgentManager.speakerBuffer` (a 30-second ring buffer) and played through Web Audio (`ScriptProcessorNode` / `AudioContext.destination`).
- When the user presses `L` to speak while the agent is talking:
  - `startListening()` does NOT call `agentRef.current.flushAudio()`.
  - The buffered agent speech **continues playing out of the computer speakers** while the user attempts to speak their move!
  - This results in audio collision, confusion, and microphone echo pickup into the AudioWorklet stream.
- **Immediate Fix**:
  ```typescript
  const startListening = useCallback(() => {
    stopSpeaking();
    agentRef.current.flushAudio(); // <--- Instantly silences and empties speaker ring buffer
    agentRef.current.setListening(true);
    setIsPushToTalk(true);
  }, []);
  ```

---

## Section 4: Mock Test Harness & Headless CI Testing

### 4.1 Current Test Suite Status
- Running `npm test` executes Vitest across 2 files with **18 total tests**:
  - `src/lib/__tests__/chess-engine.test.ts`: 9 tests.
  - `src/lib/__tests__/tool-handlers.test.ts`: 9 tests.
- Execution duration: ~250ms.
- **Shortfall**: The Acceptance Criteria mandates:
  > "Automated test suite includes at least 30 distinct tests covering IBCA notation ('Eva 4', 'Felix 3', 'Cesar 4'), standard algebraic notation, castling ('castle kingside/queenside'), pawn promotion, en passant, and resignation."
  > "Mock audio/agent test harness runs headless in CI/test scripts without requiring a live `ASSEMBLYAI_API_KEY`."

### 4.2 Why Current Architecture Prevents Agent Testing
`VoiceAgentManager` in `src/lib/voice-agent.ts` directly instantiates browser-only APIs:
- `window.AudioContext`
- `navigator.mediaDevices.getUserMedia`
- `AudioWorkletNode`
- Native browser `WebSocket`
- `fetch('/api/token')`

In headless CI (Node.js test environment), running `new VoiceAgentManager().connect(...)` throws `ReferenceError: window is not defined` or `ReferenceError: navigator is not defined`. Consequently, **zero tests currently exercise WebSocket event handling, tool invocation from agent messages, or speech conversation loops**.

### 4.3 Architecture of the Mock Test Harness for CI
A clean, modular mock harness should be constructed in `src/lib/__tests__/mock-voice-agent.ts` (or alongside the existing test suites):

```
+-----------------------------------------------------------------------------+
|                           Mock Voice Agent Harness                          |
|                                                                             |
|   +--------------------------+               +--------------------------+   |
|   | Synthetic Event Emitter  |               |  Mock WebSocket Pipeline |   |
|   |  - session.ready         |               |  - Buffers sent events   |   |
|   |  - transcript.user       | <-----------> |  - Emits server replies  |   |
|   |  - tool.call             |               |  - Zero network calls    |   |
|   |  - reply.audio / done    |               |  - No API keys required  |   |
|   +--------------------------+               +--------------------------+   |
|                 |                                          |                |
|                 v                                          v                |
|   +---------------------------------------------------------------------+   |
|   |                 Tool Dispatcher & Assertion Harness                 |   |
|   |  - Dispatches tool.call ('apply_move', 'describe_board', etc.)      |   |
|   |  - Verifies tool.result narration and game state updates            |   |
|   |  - Tests interruption / buffer flushing on reply.done (interrupted) |   |
|   +---------------------------------------------------------------------+   |
+-----------------------------------------------------------------------------+
```

**Key Test Scenarios to Implement in the CI Harness**:
1. **IBCA Full Notation Suite**:
   - Tests for "Anna 4", "Bella 4", "Cesar 4", "David 4", "Eva 4", "Felix 3", "Gustav 3", "Hector 4".
2. **Homophones & Mis-hearings**:
   - "night" -> "knight"
   - "see four" -> "c4"
   - "before" -> "b4"
   - "see five" -> "c5"
   - "be three" -> "b3"
   - "day four" -> "d4"
3. **Special Chess Moves**:
   - Castling kingside ("castle kingside", "short castle")
   - Castling queenside ("castle queenside", "long castle")
   - Pawn promotion ("Eva 8 Queen", "e8=Q")
   - En Passant ("exf6 en passant")
   - Resignation ("I resign")
4. **Ambiguity & Low Confidence (< 0.6)**:
   - Unrecognized words return clarification prompt with confidence < 0.6.
   - Ambiguous moves (two knights moving to same square) flag clarification.
5. **Opponent Engine Difficulty Differentiation**:
   - Beginner vs Intermediate vs Advanced on specific tactical positions (e.g. mate-in-1, hanging queen trap).
   - Execution timing benchmark verifying move selection completes in < 1500ms.
6. **Board Scan Ordering**:
   - Verifies Rank 1 through Rank 8 sequential output.
7. **Mock Voice Agent Conversation Lifecycle**:
   - Simulates complete user move -> tool call -> tool result -> agent narration without live credentials.

---

## Section 5: Code Quality & Lint Audit

Running `npm run lint` identifies 3 ESLint warnings:
```
src/app/api/token/route.ts:40:9  warning  'referer' is assigned a value but never used  @typescript-eslint/no-unused-vars
src/lib/tool-handlers.ts:11:3   warning  'ValidateMoveArgs' is defined but never used  @typescript-eslint/no-unused-vars
src/lib/tool-handlers.ts:15:3   warning  'Move' is defined but never used              @typescript-eslint/no-unused-vars
```
The Acceptance Criteria requires:
> "`npm run lint` passes with zero ESLint errors or warnings."

**Fixes**:
1. In `src/app/api/token/route.ts`: Remove `const referer = ...` or use it in the origin check.
2. In `src/lib/tool-handlers.ts`: Remove `ValidateMoveArgs` and `Move` from imports.

---

## Section 6: Actionable Implementation Recommendations

### Priority 1: Fix Homophone & Confidence Parser Bugs (`src/lib/tool-handlers.ts`)
1. In `normalizeIBCASpeech`, add explicit pattern mappings for:
   - `"before"` -> `"b4"`
   - `"see four"` / `"sea four"` -> `"c4"`
   - `"for"` after a file letter -> `"4"`
2. Update ambiguity threshold from `< 0.5` to `< 0.6` at line 278.
3. Add tie-detection in `fuzzyMatchMove` to reduce confidence when multiple legal moves share the highest score.

### Priority 2: Fix Audio Interruption & Muting Bug (`src/app/page.tsx`)
In `startListening()`, invoke `agentRef.current.flushAudio()` to instantly flush the 30s Web Audio speaker ring buffer when the user presses `L` or clicks push-to-talk.

### Priority 3: Implement ARIA Live Regions & Accessible Shortcuts (`src/app/page.tsx`, `GameStatus.tsx`)
1. Insert `aria-live="polite"` region for game status/turn announcements.
2. Insert `aria-live="assertive"` region for check and game over announcements.
3. Add global keyboard shortcuts (`S` to start, `R` for new game, `U` to undo, `H` for hint).
4. Add focus management shifting focus to the voice action button upon start.

### Priority 4: Upgrade Engine & Expose Difficulty Setting
1. Add difficulty state in `ChessEngine` or pass difficulty through `handleToolCall`.
2. Implement 2-ply / 3-ply Minimax with Alpha-Beta pruning and Piece-Square Tables.
3. Expose difficulty selection buttons in the UI with keyboard shortcuts `1`, `2`, `3`.

### Priority 5: Expand Automated Test Harness to 30+ Tests (`vitest`)
1. Create `src/lib/__tests__/voice-agent-mock.test.ts` to test simulated Voice Agent events and tool roundtrips.
2. Add comprehensive test cases in `chess-engine.test.ts` and `tool-handlers.test.ts` for all IBCA files, homophones, castling, promotion, en passant, resignation, board scan order, and difficulty differentiation.
3. Eliminate ESLint warnings.

