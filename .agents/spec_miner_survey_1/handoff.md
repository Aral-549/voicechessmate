# Handoff Report — Specification Mining & Survey

> **Agent:** `spec_miner_survey_1`  
> **Working Directory:** `/home/h3r0-k1ll3r/Downloads/assemblyai/voicechessmate/.agents/spec_miner_survey_1/`  
> **Date:** 2026-09-13T10:37:00Z  
> **Status:** Completed (Hard Handoff)

---

## 1. Observation

Direct observations and empirical evidence gathered from the codebase, test executions, and runtime probes:

### 1.1 Test Suite Status
- Command: `npm test`
- Tool output:
  ```
  ✓ src/lib/__tests__/tool-handlers.test.ts (9 tests) 83ms
  ✓ src/lib/__tests__/chess-engine.test.ts (9 tests) 93ms
  Test Files  2 passed (2)
  Tests  18 passed (18)
  ```
- File `src/lib/__tests__/chess-engine.test.ts` (97 lines): 9 tests covering constructor, basic SAN moves, invalid move rejection, Scholar's mate, `describeBoardState` focus types, `getLegalMoves`, `undoMove`, beginner `makeEngineMove`, and `squareToIBCA`.
- File `src/lib/__tests__/tool-handlers.test.ts` (81 lines): 9 tests covering tool routing, IBCA "Eva 4", natural language "knight to Felix 3", homophone "night to f3", low confidence clarification, `describe_board`, `get_hint`, `undo_move`, unknown tool error.
- **Deficiency:** Total test count is 18 tests. The acceptance criteria in `ORIGINAL_REQUEST.md:36` requires at least 30 distinct tests covering IBCA notation, standard algebraic notation, castling ("castle kingside/queenside"), pawn promotion, en passant, and resignation.

### 1.2 Linting Status
- Command: `npm run lint`
- Verbatim tool output:
  ```
  /home/h3r0-k1ll3r/Downloads/assemblyai/voicechessmate/src/app/api/token/route.ts
    40:9  warning  'referer' is assigned a value but never used  @typescript-eslint/no-unused-vars

  /home/h3r0-k1ll3r/Downloads/assemblyai/voicechessmate/src/lib/tool-handlers.ts
    11:3  warning  'ValidateMoveArgs' is defined but never used  @typescript-eslint/no-unused-vars
    15:3  warning  'Move' is defined but never used              @typescript-eslint/no-unused-vars

  ✖ 3 problems (0 errors, 3 warnings)
  ```
- **Deficiency:** Acceptance criteria in `ORIGINAL_REQUEST.md:52` requires zero ESLint errors or warnings.

### 1.3 Build Status
- Command: `npm run build`
- Tool output:
  ```
  ▲ Next.js 16.3.4 (Turbopack)
  ✓ Compiled successfully in 116ms
  Finished TypeScript in 989ms
  Collecting page data using 6 workers in 371ms
  ✓ Generating static pages using 6 workers (5/5) in 308ms
  ```
- Build succeeds with zero errors.

### 1.4 Move Parsing & Speech Ambiguity Probes
- Runtime probe command executed:
  `npx tsx -e "import { handleToolCall } from './src/lib/tool-handlers.ts'; ..."`
- Direct probe outputs:
  - **Homophone "before":** `[Move] "before" → "a3" (confidence: 0.2)` $\implies$ Fails to map to `b4`.
  - **Pawn promotion:** In FEN `8/4P3/8/8/8/8/8/4K2k w - - 0 1`, spoken input `"Eva 8 Queen"` or `"e8 queen"` produces:
    `[Move] "Eva 8 Queen" → "e8=N" (confidence: 0.9)` $\implies$ Promotes to Knight instead of Queen because `fuzzyMatchMove` does not score `move.promotion`, defaulting to first generated move.
  - **Resignation:** Spoken `"I resign"` or `"resign"` produces:
    `[Move] "I resign" → "a3" (confidence: 0.2)` $\implies$ No resignation handling in `handleToolCall` or `chess-engine.ts`.
  - **Ambiguity threshold in code:** In `src/lib/tool-handlers.ts:278`:
    `if (confidence < 0.5) { ... }`
    Whereas acceptance criteria requires `< 0.6`.
  - **Ambiguous piece input:** Spoken `"knight"` at initial position scores `Na3` with `confidence: 0.9` despite four legal knight moves ($Na3, Nc3, Nf3, Nh3$).

### 1.5 Opponent Engine Latency & Difficulty
- Benchmark probe output across 20 iterations per phase:
  - Opening: Beginner avg 4.93ms (max 14.64ms); Intermediate avg 4.45ms (max 5.27ms); Advanced avg 4.94ms (max 5.95ms).
  - Middlegame: Beginner avg 5.07ms (max 5.76ms); Intermediate avg 7.33ms (max 8.14ms); Advanced avg 9.96ms (max 17.81ms).
  - Endgame: Beginner avg 2.17ms (max 7.15ms); Intermediate avg 1.67ms (max 2.14ms); Advanced avg 2.19ms (max 4.98ms).
- Max observed latency is 17.81ms, well below the 1500ms ceiling.
- Intermediate move hardcoding: In `src/lib/tool-handlers.ts:291`:
  `const opponentResult = engine.makeEngineMove('intermediate');`
  Difficulty level is hardcoded and cannot be toggled by player.

### 1.6 Accessibility & Audio Pipeline
- In `src/app/page.tsx:346-361`: Keyboard shortcuts only bind `l`, `d`, `t`, `o`, `c`.
- In `src/app/page.tsx:308-312`: `startListening` calls `stopSpeaking()` but fails to call `agentRef.current.flushAudio()`.
- In `src/app/page.tsx`, `src/components/GameStatus.tsx`, `src/components/TranscriptPanel.tsx`: No `aria-live` or `role="status"` regions exist.
- In `src/lib/__tests__/`: No mock audio / headless CI test harness exists.

---

## 2. Logic Chain

1. **Test Count Gap:** `ORIGINAL_REQUEST.md:36` mandates at least 30 tests covering IBCA, SAN, castling, promotion, en passant, and resignation. Observation 1.1 proves only 18 tests exist across 2 test files, omitting promotion to queen, en passant verification, and resignation tests.
2. **Linting Failure:** `ORIGINAL_REQUEST.md:52` mandates zero ESLint warnings. Observation 1.2 demonstrates 3 unused variable warnings exist in `route.ts` and `tool-handlers.ts`.
3. **Move Parser Flaws:** Observation 1.4 confirms three severe defects:
   - "before" is unrecognized as "b4" because `normalizeIBCASpeech` lacks a token rule for "before".
   - "Eva 8 Queen" promotes to a knight because `fuzzyMatchMove` ignores `move.promotion`.
   - "I resign" triggers an unrecognized move clarification because no resignation logic exists in `ChessEngine` or `handleToolCall`.
   - Confidence threshold is checked against `0.5` instead of `0.6` as specified in `ORIGINAL_REQUEST.md:37`.
4. **Engine Difficulty Configuration:** Observation 1.5 shows all three difficulty algorithms are fast and exhibit distinct move selection in `chess-engine.ts`, but `handleToolCall:291` hardcodes `'intermediate'`, preventing the user from playing at Beginner or Advanced levels.
5. **Accessibility & Audio Gaps:** Observation 1.6 reveals that interactive buttons (Start Game, New Game, Stop Game) cannot be triggered via keyboard, screen readers receive no `aria-live` announcements for turn changes or checks, and push-to-talk activation fails to flush the streaming audio buffer.
6. **CI Headless Harness:** Observation 1.1 & 1.6 confirm that without a mock audio/agent harness, voice interactions cannot be verified headlessly in CI without a live `ASSEMBLYAI_API_KEY`.

---

## 3. Caveats

- **No Live WebSocket Test:** Probing was conducted locally using Vitest and Node/TSX execution. Live connection to `wss://agents.assemblyai.com/v1/ws` requires a real `ASSEMBLYAI_API_KEY` and active microphone session.
- **Read-Only Constraint:** Per specification miner instructions, no implementation modifications were made to `src/`. All findings are documented in `spec_report.md` for subsequent implementation agents.

---

## 4. Conclusion

The specification mining survey is complete. The system's chess engine core and visual layout are well-structured, and engine response latency is excellent ($< 18\text{ms}$). However, the project currently violates several critical acceptance criteria:
1. Unresolved homophone "before" $\rightarrow$ "b4".
2. Broken pawn promotion in fuzzy matching (promotes to Knight instead of Queen).
3. Missing resignation handling.
4. Ambiguity confidence threshold set at $0.5$ instead of $0.6$, with insufficient multi-move tie detection.
5. Hardcoded intermediate difficulty.
6. Missing audio buffer flush upon push-to-talk activation.
7. Missing ARIA live regions and incomplete keyboard shortcut coverage.
8. 3 ESLint warnings failing zero-warning requirement.
9. Missing mock audio / agent headless test harness and deficit of 12+ tests to satisfy the $\ge 30$ test threshold.

All architectural contracts, input/output specifications, edge case tables, and remediation requirements have been cataloged in `spec_report.md`.

---

## 5. Verification Method

To independently verify all findings and validate the remediation:

1. **Verify Test Count & Failures:**
   ```bash
   cd /home/h3r0-k1ll3r/Downloads/assemblyai/voicechessmate
   npm test
   ```
   *Expected:* Confirms currently only 18 tests run.

2. **Verify ESLint Warnings:**
   ```bash
   npm run lint
   ```
   *Expected:* Confirms 3 warnings in `src/app/api/token/route.ts` and `src/lib/tool-handlers.ts`.

3. **Verify Promotion Bug & Homophone Failure via TSX:**
   ```bash
   npx tsx -e "
   import { ChessEngine } from './src/lib/chess-engine.ts';
   import { handleToolCall } from './src/lib/tool-handlers.ts';
   const e = new ChessEngine('8/4P3/8/8/8/8/8/4K2k w - - 0 1');
   console.log(handleToolCall(e, 'apply_move', { move_description: 'Eva 8 Queen' }));
   console.log(handleToolCall(new ChessEngine(), 'apply_move', { move_description: 'before' }));
   "
   ```
   *Expected:* Confirms "Eva 8 Queen" produces `e8=N` (knight) and "before" produces `success: false` with confidence 0.2.

4. **Verify Engine Latency Benchmark:**
   ```bash
   npx tsx -e "
   import { ChessEngine } from './src/lib/chess-engine.ts';
   const e = new ChessEngine();
   const t0 = performance.now();
   e.makeEngineMove('advanced');
   console.log('Latency:', performance.now() - t0, 'ms');
   "
   ```
   *Expected:* Latency $< 20\text{ms}$.

