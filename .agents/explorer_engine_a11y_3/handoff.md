# Handoff Report — explorer_engine_a11y_3
**Role**: Engine & Accessibility Explorer  
**Working Directory**: `/home/h3r0-k1ll3r/Downloads/assemblyai/voicechessmate/.agents/explorer_engine_a11y_3/`  
**Target Milestone**: Phase 1 — Comprehensive Engine, Voice Parser, Accessibility & Test Harness Investigation  
**Date**: September 13, 2026

---

## 1. Observation

Direct observations from codebase inspection, static analysis, command execution, and test runs:

1. **Chess Engine Opponent Execution & Difficulty**:
   - In `src/lib/tool-handlers.ts:291`:
     `const opponentResult = engine.makeEngineMove('intermediate');`
     Opponent difficulty is hardcoded to `'intermediate'`. The caller (`page.tsx`) passes no difficulty parameter.
   - In `src/lib/chess-engine.ts:462-487`:
     - `'beginner'` uses `Math.random()` across all legal moves.
     - `'intermediate'` checks for captures/checks and uses `Math.random() > 0.3` to pick one, else uniform random.
     - `'advanced'` and `'master'` execute identical logic calling `getSimpleEvaluation()`.
   - In `src/lib/chess-engine.ts:384-445`:
     `getSimpleEvaluation()` is a 1-ply greedy static heuristic (checkmate: +10000, check: +50, MVV-LVA capture: +10*victim - attacker, center control: +5, development: +3, castling: +8). It does not search depth 2 or 3 (no minimax lookahead, no alpha-beta pruning).
   - In `src/app/page.tsx`:
     Zero UI elements or state exist for selecting or displaying difficulty level.
   - Engine move execution is completely synchronous on the main JavaScript thread within `handleToolCall()`.

2. **Voice Parser & Homophone Resolution**:
   - In `src/lib/tool-handlers.ts:138-172`:
     `normalizeIBCASpeech(raw)` maps `NUMBER_WORDS` and `IBCA_FILES` (e.g. `see: 'c'`, `four: '4'`).
   - "night" -> "knight": `PIECE_ALIASES` maps `'night': 'n'` (`tool-handlers.ts:103`). Test passes.
   - "see four" -> "c4": `see` maps to `c`, `four` maps to `4`. Direct SAN match succeeds.
   - **"before" -> "b4" FAILS**: `normalizeIBCASpeech("before")` produces `"before"`. In `fuzzyMatchMove`, `"before"` does not match `b4` SAN, UCI, or destination square (`s.includes(move.to)` is false). Best score is `0`, confidence is `0.2`. At line 278, `if (confidence < 0.5)` triggers clarification error rather than playing `b4`.
   - Confidence threshold in `src/lib/tool-handlers.ts:278`:
     `if (confidence < 0.5)`
     The Acceptance Criteria specifically requires: *"flags ambiguous moves with confidence < 0.6 for verbal clarification."*
   - Ambiguity detection: `fuzzyMatchMove` selects the first move where `score > bestScore`. If multiple legal moves tie for the highest score (e.g. two knights that can move to the same square), it silently executes the first move and returns confidence 0.9 rather than detecting an ambiguous move.
   - In `src/lib/chess-engine.ts:194-224`:
     `describeFullBoard` loops `for (let r = 1; r <= 8; r++)` and announces squares using `IBCA_FILE_NAMES` ("Anna 1", etc.). Strict Rank 1 through Rank 8 ordering is observed in code, but lacks automated test assertion.

3. **Accessibility (A11y) & Audio Pipeline**:
   - `grep_search` across `src/` for `aria-` and `role=` returned **0 matches**.
     There are no ARIA live regions (`aria-live="polite"` or `aria-live="assertive"`), no `role="status"`, no `role="alert"`, and no `role="log"` anywhere in the app.
   - In `src/app/page.tsx:300-334`:
     Keyboard shortcuts (`L`, `D`, `T`, `O`, `C`) only attach when `isStarted === true`. There is no keyboard shortcut to start the game, no shortcut to reset/start a new game, no shortcut for undo, and no shortcut for hint.
   - Focus management: No focus shifting occurs when the game starts, leaving screen reader users without orientation.
   - **Critical Audio Interruption / Muting Bug**:
     In `src/app/page.tsx:259-263`:
     ```typescript
     const startListening = useCallback(() => {
       stopSpeaking();
       agentRef.current.setListening(true);
       setIsPushToTalk(true);
     }, []);
     ```
     `stopSpeaking()` in `src/lib/speech.ts:41-43` only cancels `window.speechSynthesis`.
     Incoming AssemblyAI agent audio is streamed via WebSocket into `VoiceAgentManager.speakerBuffer` (a 30-second ring buffer) and played via `AudioContext`.
     `startListening()` **fails to call `agentRef.current.flushAudio()`**! When the user initiates listening by holding `L` or clicking push-to-talk, the agent continues speaking aloud from the speaker buffer, causing speech collision.

4. **Test Harness & Headless CI**:
   - `npm test` runs 18 tests (9 in `chess-engine.test.ts`, 9 in `tool-handlers.test.ts`).
   - Acceptance Criteria mandates at least 30 tests covering IBCA notation, standard algebraic, castling, promotion, en passant, and resignation.
   - `VoiceAgentManager` depends directly on `window.AudioContext`, `navigator.mediaDevices.getUserMedia`, and native `WebSocket`. No mock voice agent test harness exists for headless CI testing without `ASSEMBLYAI_API_KEY`.

5. **Linter & Build**:
   - `npm run build` succeeds cleanly in ~1s.
   - `npm run lint` generates 3 unused-variable warnings:
     - `src/app/api/token/route.ts:40:9`: `'referer' is assigned a value but never used`
     - `src/lib/tool-handlers.ts:11:3`: `'ValidateMoveArgs' is defined but never used`
     - `src/lib/tool-handlers.ts:15:3`: `'Move' is defined but never used`

---

## 2. Logic Chain

1. **Premise**: Hackathon Acceptance Criteria (`ORIGINAL_REQUEST.md`) requires full IBCA phonetic support, homophone resilience ("night", "see four", "before"), confidence < 0.6 ambiguity flagging, 3 distinct engine difficulty levels (< 1500ms without blocking UI), ARIA live announcements, audio interruption muting, clean lint with zero warnings, and >= 30 automated tests in a headless CI mock harness.
2. **Analysis of Engine**:
   - Because `tool-handlers.ts:291` hardcodes `'intermediate'`, the user cannot experience difficulty scaling.
   - Because `'advanced'` and `'master'` both call 1-ply `getSimpleEvaluation()`, they are functionally identical and lack tactical depth (cannot detect mate-in-2 or hanging pieces after recapture).
   - Because minimax depth 2–3 in pure JS requires 25–250ms, synchronous execution would freeze audio worklets; wrapping in an asynchronous promise or yielding task ensures UI/audio smoothness within the 1500ms budget.
3. **Analysis of Voice Parser**:
   - Because `normalizeIBCASpeech` contains no mapping for the single word `"before"`, it fails to produce `"b4"`.
   - Because the threshold at line 278 is `< 0.5`, moves with confidence 0.5 or 0.55 bypass clarification, violating the `< 0.6` rule.
   - Because `fuzzyMatchMove` does not compare the top 2 move scores, tied legal moves are executed blindly without user clarification.
4. **Analysis of Accessibility & Audio**:
   - Screen reader accessibility is non-functional without ARIA live regions.
   - Because `startListening` does not flush `VoiceAgentManager.speakerBuffer`, barge-in / push-to-talk fails to mute agent audio playback.
5. **Analysis of CI & Test Harness**:
   - 18 tests is 12 short of the 30-test requirement.
   - Direct browser API coupling in `VoiceAgentManager` blocks CI execution; a mock event dispatcher is required.

---

## 3. Caveats

1. **Browser Speech Fallback vs Cloud Audio**: On Linux environments, `window.speechSynthesis` may produce no sound if `speech-dispatcher` or `espeak-ng` is not installed; however, AssemblyAI Voice Agent audio uses Web Audio PCM16 playback (`AudioContext`), which works natively.
2. **Stockfish WASM**: Stockfish WASM requires large binary assets (~5–10MB) and multi-threading SharedArrayBuffer headers that may fail on generic hosting. A custom Minimax algorithm with Piece-Square Tables is more portable, lightweight (<50KB), runs < 150ms, and satisfies all hackathon requirements.
3. **Network Mode**: The investigation was conducted in local read-only mode without modifying source code files.

---

## 4. Conclusion

The application has an excellent base architecture, but requires five critical fixes to achieve full hackathon submission readiness:
1. **Fix Homophone & Confidence Parser**: Add `"before"` -> `"b4"`, update threshold to `< 0.6`, and add tie-detection for ambiguous moves.
2. **Fix Audio Interruption**: Call `agentRef.current.flushAudio()` inside `startListening()`.
3. **Implement ARIA Live Regions & Global Shortcuts**: Add `role="status"` and `role="alert"` regions; add global keyboard shortcuts (`S`, `R`, `U`, `H`, `1-3`).
4. **Implement 3 Distinct Engine Difficulties & UI Selector**: 1-ply greedy + jitter (Beginner), 2-ply Minimax (Intermediate), 3-ply Alpha-Beta Minimax with PST (Advanced); expose difficulty in UI and async engine runner.
5. **Implement Headless Mock Agent CI Harness & Expand to 30+ Tests**: Add `mock-voice-agent.ts` to test event sequences and rules without live API keys, resolving all 3 ESLint warnings.

Detailed technical analysis and proposed code structures are documented in:
`/home/h3r0-k1ll3r/Downloads/assemblyai/voicechessmate/.agents/explorer_engine_a11y_3/deep_dive_report.md`

---

## 5. Verification Method

To independently verify all findings and test proposals:
1. **Run Current Test Suite**:
   ```bash
   cd /home/h3r0-k1ll3r/Downloads/assemblyai/voicechessmate && npm test
   ```
   *Expected*: Exactly 18 tests pass across 2 files.
2. **Verify ESLint Warnings**:
   ```bash
   cd /home/h3r0-k1ll3r/Downloads/assemblyai/voicechessmate && npm run lint
   ```
   *Expected*: 3 warnings reported (0 errors).
3. **Verify Next.js Production Build**:
   ```bash
   cd /home/h3r0-k1ll3r/Downloads/assemblyai/voicechessmate && npm run build
   ```
   *Expected*: Build completes successfully.
4. **Inspect Source Code Locations**:
   - `src/lib/tool-handlers.ts:278` — Verify confidence threshold is `< 0.5`.
   - `src/lib/tool-handlers.ts:291` — Verify hardcoded `'intermediate'`.
   - `src/app/page.tsx:259-263` — Verify absence of `flushAudio()` call in `startListening()`.
   - `src/app/page.tsx` & `src/components/` — Verify 0 occurrences of `aria-live`.
