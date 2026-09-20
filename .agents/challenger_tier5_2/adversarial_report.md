# Tier 5.2 Adversarial Review & Stress-Test Report: VoiceChessmate

**Evaluator**: challenger_tier5_2 (Empirical Challenger / Critic / Specialist)  
**Date**: 2026-09-13  
**Target Codebase**: `/home/h3r0-k1ll3r/Downloads/assemblyai/voicechessmate`  
**Overall Risk Assessment**: **LOW** (System is robust, resilient to ASR/homophone variations, strictly gates ambiguous moves, fully accessible, and passes 100% CI builds with zero warnings)

---

## 1. Challenge Summary

We conducted adversarial probing and stress-testing across four critical functional areas:
1. **Fuzzy Move Parsing & Homophones**: ASR phonetic mis-hearings ("night", "see four", "before"), case/whitespace irregularities, filler-word resilience, ambiguous move gating (< 0.6 confidence), state preservation on low confidence, and pawn promotion voice piece selection.
2. **Resignation & Difficulty Tools**: Tool dispatch (`resign_game`, `set_difficulty`) and natural verbal commands ("I resign", "set difficulty to master"), state transition to game over, move immutability post-resignation, and engine difficulty adherence.
3. **Accessibility & Audio UI**: Keyboard navigation coverage for all interactive controls (100% mouse-free operable), dual ARIA live regions (`role="status"` polite and `role="alert"` assertive), and instant audio stream muting + WebSocket buffer flushing (`flushAudio()`) on user interruption.
4. **Headless Mock CI Harness & Build Integrity**: Complete headless operation without `ASSEMBLYAI_API_KEY`, zero AudioContext dependency in tests, and clean execution of `npm test` (166 tests passing), `npx eslint --max-warnings=0`, `npx tsc --noEmit`, and `npm run build`.

All verification was conducted **empirically** by executing live tests and build tools. 52 dedicated adversarial probe test cases were implemented in `src/lib/__tests__/adversarial-tier5-2.test.ts`. Combined with the existing 114 tests, a total of **166 tests passed cleanly with 0 failures**.

---

## 2. Identified Nuances & Adversarial Findings

### [Low Risk] Finding 1: Filler-Word Filter Strips Isolated "a" in File Disambiguation
- **Observation**:
  In `src/lib/tool-handlers.ts:185`, `normalizeIBCASpeech` strips filler words and English indefinite articles:
  `s = s.replace(/\b(please|play|move|...|the|my|a|an)\b/g, ' ');`
  When a user phrases an ambiguous move as `"rook on a to d1"` or `"a rook to d1"` (where two rooks can reach d1, e.g. `Rad1` and `Red1`), the letter `"a"` is matched as the English word `"a"` and replaced with whitespace (`"rook on to d1"`). As a result, the source file `"a"` is not detected, both rooks remain tied at score 18, and confidence evaluates to `0.5` (< 0.6), triggering a clarification request.
- **Attack Scenario**:
  A player with two rooks on a1 and e1 saying `"rook on a to d1"` expecting it to execute `Rad1`.
- **System Defense / Blast Radius**:
  The system safely rejects the move with `confidence: 0.5` and asks for verbal clarification (`"I'm not sure which move you mean by 'rook on a to d1'. Some options are: Rad1, Red1..."`). The board state is preserved strictly unchanged.
- **Recommended User Phrasing / Mitigation**:
  Users following official IBCA tournament standards (`"rook on Anna to d1"`, `"Anna rook to d1"`), square coordinates (`"rook from a1 to d1"`), or standard SAN (`"Rad1"`) successfully disambiguate with confidence 0.9–1.0. Future enhancement could retain `"a"` when immediately preceded by `"on"`, `"from"`, or `"file"`.

---

## 3. Detailed Stress-Test Probes & Empirical Evidence

### Area 1: Fuzzy Move Parser & Homophones
- **Homophone "night" -> "knight"**:
  - Spoken `"night to f3"` -> Resolves to `Nf3` (confidence 0.9).
  - Spoken `"nite to f3"` -> Resolves to `Nf3` (confidence 0.9).
  - Spoken `"night to Felix 3"` -> Resolves to `Nf3` (confidence 0.9).
  - Mixed casing and spacing: `"  NiGhT   tO   F3  "` -> Resolves to `Nf3` (confidence 0.9).
  - Conversational: `"please move my night to c3"` -> Resolves to `Nc3` (confidence 0.9).
- **Homophone "see four" -> "c4"**:
  - Spoken `"see four"` -> Direct match to `c4` (confidence 1.0).
  - Spoken `"SEE FOUR"` -> Resolves to `c4` (confidence 1.0).
  - Irregular spacing/case: `"   sEe    FouR   "` -> Resolves to `c4` (confidence 1.0).
  - Spoken `"see 4"` -> Resolves to `c4` (confidence 1.0).
  - Conversational: `"play see four please"` -> Resolves to `c4` (confidence 1.0).
- **Homophone "before" -> "b4"**:
  - Spoken `"before"` -> Resolves to `b4` (confidence 1.0).
  - Spoken `"BEFORE"` -> Resolves to `b4` (confidence 1.0).
  - Spoken `"  BeFoRe  "` -> Resolves to `b4` (confidence 1.0).
  - Spoken `"play before"` -> Resolves to `b4` (confidence 1.0).
  - IBCA phonetic `"bella 4"` -> Resolves to `b4` (confidence 1.0).
- **Ambiguous Moves & Origin Gating (< 0.6 Confidence)**:
  - **Two Knights**: Position with White knights on c3 and e3 (`r1bqkb1r/pppp1ppp/2n5/4p3/4n3/2N1N3/PPPP1PPP/R1BQKB1R w KQkq - 0 4`).
    - Spoken `"knight to d5"` (no origin) -> `confidence: 0.5` (< 0.6).
    - `handleToolCall` returns `{ success: false, clarificationNeeded: true, narration: "I'm not sure which move you mean..." }`.
    - Board FEN verified unchanged.
    - Disambiguated `"c knight to d5"` -> Resolves to `Ncd5` (confidence 0.9).
    - Disambiguated `"e knight to d5"` -> Resolves to `Ned5` (confidence 0.9).
  - **Two Rooks**: Position with White rooks on a1 and e1 (`3r1rk1/pppp1ppp/8/8/8/8/PPPP1PPP/R3R1K1 w - - 0 1`).
    - Spoken `"rook to d1"` (no origin) -> `confidence: 0.5` (< 0.6).
    - `handleToolCall` returns `{ success: false, clarificationNeeded: true }`.
    - Board FEN verified unchanged.
    - Disambiguated `"rook on e to d1"` -> Resolves to `Red1` (confidence 0.9).
    - Disambiguated `"rook on Anna to d1"` -> Resolves to `Rad1` (confidence 0.9).
  - **Move 1 Ambiguity**: Spoken `"knight"` on move 1 -> Matches 4 candidate moves (Na3, Nc3, Nf3, Nh3), returns `confidence: 0.5`, rejects move, requests clarification.
- **Low Confidence Speech & State Preservation**:
  - Nonsense inputs (`"banana split 42"`, `"hello world how are you"`, `"play the best move"`, `"what should i do"`, `"xyz abc 99"`) all evaluate to confidence < 0.6.
  - Returns `success: false, clarificationNeeded: true`.
  - Exact board FEN verified completely unchanged across all tests.
- **Pawn Promotion Voice Input**:
  - Position: White pawn on e7, Black King on h8 (`7k/4P3/8/8/8/8/8/4K3 w - - 0 1`).
  - `"Eva 8 Queen"` -> Promotes to `e8=Q+` (confidence 0.9, narration: *"White pawn to Eva 8. Promoted to queen. Check!"*).
  - `"e8 knight"` -> Promotes to `e8=N` (confidence 0.9, narration: *"White pawn to Eva 8. Promoted to knight."*).
  - `"promote to rook"` -> Promotes to `e8=R+` (confidence 0.9, narration: *"White pawn to Eva 8. Promoted to rook. Check!"*).
  - `"Eva 8 bishop"` -> Promotes to `e8=B` (confidence 0.9, narration: *"White pawn to Eva 8. Promoted to bishop."*).
  - Pawn promotion capture (`3r3k/4P3/8/8/8/8/8/4K3 w - - 0 1`): `"Eva takes David 8 Queen"` -> Resolves to `exd8=Q+` (confidence 0.9).

---

### Area 2: Resignation & Difficulty Tools
- **Resignation**:
  - `resign_game` tool call with `{}` defaults to active color (White), returns `{ success: true, isGameOver: true, narration: "White resigns. Black wins by resignation." }`.
  - `resign_game` tool call with `{ color: 'b' }` records Black resignation.
  - Spoken `"I resign"` via `apply_move` tool triggers resignation (`success: true, isGameOver: true`).
  - Spoken verbal variants (`"i surrender"`, `"concede"`, `"forfeit"`, `"I concede"`) all trigger game over.
  - Subsequent moves after resignation return `{ success: false, error: "White resigns. Black wins by resignation." }`.
- **Difficulty Tools**:
  - `set_difficulty` tool call sets and updates engine difficulty state to `beginner`, `intermediate`, `advanced`, `master`.
  - Invalid difficulty (`"grandmaster"`) returns `{ success: false, error: "Invalid difficulty: grandmaster. Valid options are: beginner, intermediate, advanced, master." }`.
  - Spoken verbal command via `apply_move`: `"set difficulty to master"` sets engine difficulty to master (`success: true`).
  - Spoken `"beginner level"` sets engine difficulty to beginner (`success: true`).
  - Engine makes legal moves without blocking across all 4 difficulty levels.

---

### Area 3: Accessibility & Audio UI
- **Keyboard Navigation (100% Mouse-Free)**:
  - `S` or `Enter`: Start Game / Stop Game toggle.
  - `N`: New Game / Reset.
  - `U`: Undo last move pair.
  - `1`, `2`, `3`, `4`: Instant difficulty selection (Beginner, Intermediate, Advanced, Master).
  - `R`: Resign game.
  - `Hold L` (Push-to-Talk): Starts audio listening on keydown, stops listening on keyup.
  - `D`: Describe full board position (Rank 1 to Rank 8 scan).
  - `T`: Describe tactical threats.
  - `O`: Describe friendly pieces.
  - `C`: Describe captured pieces.
  - `H` or `?`: Announce shortcuts via Web Speech and toggle accessible shortcuts modal.
  - `Escape`: Close shortcuts guide modal.
  - Automatic focus management: `startButtonRef` focused on page load; `pttButtonRef` automatically focused when game begins.
  - All interactive elements use `<button>` with `tabIndex={0}`, visible focus rings (`focus-visible:ring-2 focus-visible:ring-amber-400`), and detailed `aria-label` attributes.
- **ARIA Live Regions**:
  - Polite region (`role="status"`, `aria-live="polite"`, `aria-atomic="true"`, `#voicechessmate-polite-announcer`):
    - Announces turn changes, connection state, move confirmations, undo confirmations, difficulty adjustments, board scans, and agent speech responses.
  - Assertive region (`role="alert"`, `aria-live="assertive"`, `aria-atomic="true"`, `#voicechessmate-assertive-alerts`):
    - Announces check events, checkmate / victory, game over by resignation, and fatal connection errors.
  - Component-level regions:
    - `GameStatus`: `role="status"` for agent status and move counter; `role="alert"` for Check and Checkmate badges; `role="region"` for captured pieces summary.
    - `TranscriptPanel`: `role="log"`, `aria-live="polite"`, `aria-relevant="additions text"`.
- **Audio Interruption & Stream Flush**:
  - `startListening()` in `src/app/page.tsx:111-119`:
    ```ts
    resumeAudioContext();
    stopSpeaking();
    agentRef.current?.flushAudio();
    agentRef.current.setListening(true);
    setIsPushToTalk(true);
    ```
  - Tested: `flushAudio()` synchronously clears `audioBuffer`, marks `audioFlushed = true`, increments `flushedCount`, and dispatches `reply.done` with status `'interrupted'`.
  - TTS playback is immediately terminated via `stopSpeaking()` (window.speechSynthesis.cancel()).

---

### Area 4: Headless Mock CI Harness & Build Integrity
- **Headless MockVoiceAgentManager**:
  - Runs in Node environment with zero network calls, zero Web Audio/AudioContext calls, and without `ASSEMBLYAI_API_KEY`.
  - Simulates end-to-end sessions: connects, streams audio chunks, pushes user transcripts, dispatches tool calls, receives tool results, and cleanly closes.
- **CI Build & Quality Verification Commands**:
  - `npm test`: **Passed** (5 test suites, 166 tests passed, 0 failures, duration 3.40s).
  - `npx eslint --max-warnings=0`: **Passed** (0 errors, 0 warnings).
  - `npx tsc --noEmit`: **Passed** (0 TypeScript errors).
  - `npm run build`: **Passed** (Next.js 16.3.4 Turbopack production build succeeded cleanly, static and dynamic routes generated).

---

## 4. Stress Test Results Summary Table

| Category | Scenario | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|---|
| Homophone | Spoken "night to f3" / "NiGhT tO F3" | Resolves to Nf3, confidence >= 0.6 | Resolves to Nf3, confidence 0.9 | **PASS** |
| Homophone | Spoken "see four" / "   sEe    FouR   " | Direct match c4, confidence 1.0 | Resolves to c4, confidence 1.0 | **PASS** |
| Homophone | Spoken "before" / "BeFoRe" | Direct match b4, confidence 1.0 | Resolves to b4, confidence 1.0 | **PASS** |
| Ambiguity | Spoken "knight to d5" with 2 knights on c3 & e3 | Gated confidence < 0.6, clarification requested, FEN preserved | Confidence 0.5, clarification requested, FEN preserved | **PASS** |
| Disambiguation | Spoken "c knight to d5" | Resolves to Ncd5, confidence >= 0.6 | Resolves to Ncd5, confidence 0.9 | **PASS** |
| Ambiguity | Spoken "rook to d1" with 2 rooks on a1 & e1 | Gated confidence < 0.6, clarification requested, FEN preserved | Confidence 0.5, clarification requested, FEN preserved | **PASS** |
| Disambiguation | Spoken "rook on Anna to d1" | Resolves to Rad1, confidence >= 0.6 | Resolves to Rad1, confidence 0.9 | **PASS** |
| Low Confidence | Nonsense "banana split 42" | Confidence < 0.6, clarification requested, FEN preserved | Confidence 0.2, clarification requested, FEN preserved | **PASS** |
| Promotion | Spoken "Eva 8 Queen" | Promotes pawn to Queen (e8=Q+) | Promoted to queen, confidence 0.9 | **PASS** |
| Promotion | Spoken "e8 knight" | Promotes pawn to Knight (e8=N) | Promoted to knight, confidence 0.9 | **PASS** |
| Promotion | Spoken "promote to rook" | Promotes pawn to Rook (e8=R+) | Promoted to rook, confidence 0.9 | **PASS** |
| Promotion | Spoken "Eva 8 bishop" | Promotes pawn to Bishop (e8=B) | Promoted to bishop, confidence 0.9 | **PASS** |
| Promotion | Spoken "Eva takes David 8 Queen" | Promotion capture exd8=Q+ | Resolves to exd8=Q+, confidence 0.9 | **PASS** |
| Resignation | Tool call resign_game | Game over, narration, FEN preserved | isGameOver: true, White resigns | **PASS** |
| Resignation | Spoken "I resign" via apply_move | Game over, narration, FEN preserved | isGameOver: true, White resigns | **PASS** |
| Resignation | Subsequent moves after resign | Rejected with game over message | Rejected: game over by resignation | **PASS** |
| Difficulty | Tool call set_difficulty (all 4 levels) | Updates difficulty state | Updated to beginner/inter/adv/master | **PASS** |
| Difficulty | Spoken "set difficulty to master" | Updates difficulty state to master | Updated to master | **PASS** |
| Accessibility | All interactive buttons keyboard operable | Shortcuts for all actions (S, N, U, 1-4, R, L, D, T, O, C, H, Esc) | Full global keyboard event listener + tabIndex=0 | **PASS** |
| Accessibility | ARIA live regions | role="status" polite & role="alert" assertive | Dual live regions announce all events | **PASS** |
| Interruption | startListening invokes flushAudio() | Clears audio buffer & emits reply.done interrupted | Buffer cleared, isAudioFlushed=true | **PASS** |
| CI Harness | MockVoiceAgentManager runs headless | Zero API key, zero AudioContext required | Headless CI execution verified | **PASS** |
| Code Quality | tsc --noEmit, eslint, test, build | Zero errors, zero warnings | 166 tests passed, clean build | **PASS** |

---

## 5. Unchallenged Areas
- Real hardware microphone capture and actual AssemblyAI cloud WebSocket latency (by project specification, tested via mock headless harness in CI).
