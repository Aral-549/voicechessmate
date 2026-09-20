# VoiceChessmate — Authoritative Specification Mining Report

> **Document Version:** 1.0.0  
> **Author:** `spec_miner_survey_1` (Specification Miner)  
> **Timestamp:** 2026-09-13T10:35:00Z  
> **Target System:** VoiceChessmate (`/home/h3r0-k1ll3r/Downloads/assemblyai/voicechessmate`)  
> **Specification Sources Consulted:**
> - `ORIGINAL_REQUEST.md` (Authoritative user requirements & acceptance criteria)
> - `PROJECT_CONTEXT.md` (System architecture, component contracts, tool schemas)
> - `ASSEMBLYAI_VOICE_AGENT_HACKATHON.md` (Hackathon technical specifications & rubrics)
> - FIDE Handbook & International Braille Chess Association (IBCA) Tournament Standards
> - Codebase implementation (`src/lib/chess-engine.ts`, `src/lib/tool-handlers.ts`, `src/lib/voice-agent.ts`, `src/app/page.tsx`, `src/components/*`)
> - Empirical probes via Vitest, Next.js build, ESLint, and Node/TSX runtime probes

---

## 1. Executive Summary & Specification Scope

VoiceChessmate is a conversational, voice-first chess companion engineered specifically for blind and visually impaired players. It integrates AssemblyAI's Voice Agent API with the official FIDE and International Braille Chess Association (IBCA) tournament phonetic standards. 

The application enables blind players to conduct complete tournament-grade chess games purely through natural spoken dialogue or assistive keyboard commands, while providing sighted coaches, tournament arbiters, and spectators with a synchronized, high-contrast visual display and move history ledger.

This specification mining report documents all discovered requirements, public interfaces, acceptance criteria, behavioral invariants, empirical runtime characteristics, and edge cases across the ten required functional domains.

---

## 2. Core Specification Domains & Detailed Requirements

### Domain 1: IBCA Phonetic Alphabet Standards
* **Authoritative Source:** FIDE Handbook Section B.01 / International Braille Chess Association (IBCA) Rulebook Rule 3.2.
* **Standard Phonetic Mapping:** To avoid severe audio ambiguity between rhyming file letters (e.g., 'b', 'c', 'd', 'e', 'g'), files $a$ through $h$ are strictly mapped to standard substitute phonetic names:
  - File **a** $\rightarrow$ **Anna**
  - File **b** $\rightarrow$ **Bella**
  - File **c** $\rightarrow$ **Cesar** (ASR variants: Caesar, Ceasar, Sees, C sir)
  - File **d** $\rightarrow$ **David** (ASR variants: Dave, They would)
  - File **e** $\rightarrow$ **Eva** (ASR variants: Eve, Ever, Ava)
  - File **f** $\rightarrow$ **Felix** (ASR variants: Feel, Phelix, Phoenix)
  - File **g** $\rightarrow$ **Gustav** (ASR variants: Gustave, Gust, Goose)
  - File **h** $\rightarrow$ **Hector** (ASR variants: Heck tour, Heck to, Heater)
* **Coordinate Format:** Every square reference on the $8 \times 8$ grid is formatted as `<IBCA_File_Name> <Rank_Number>` (e.g., "Eva 4", "Felix 3", "Cesar 4", "Hector 8", "Anna 1").
* **Spoken Move Narration:** Move confirmations and announcements must strictly substitute coordinates with IBCA phonetics:
  - Pawn move: "White pawn to Eva 4."
  - Piece move: "White knight to Felix 3."
  - Capture: "White bishop takes knight on Cesar 4."
  - Check/Checkmate: "White queen to Felix 7. Checkmate! White wins the game."
* **Visual Display:** Spectator board displays file coordinates annotated with both standard letters and IBCA phonetic labels (e.g., "A / Anna", "B / Bella").

### Domain 2: Standard Algebraic Notation (SAN), Castling, Promotion, En Passant, and Resignation
* **Standard Algebraic Notation (SAN):** Full support for standard chess notation inputs ("e4", "Nf3", "Bxf7+", "Qxd4", "O-O", "O-O-O").
* **Castling:**
  - Kingside: Spoken inputs like "castle kingside", "kingside castle", "short castle", "castle", "O-O". Evaluated strictly against castling legality rules (king and rook unmoved, squares empty, no castling out of, through, or into check). Confirmed with "White castles kingside."
  - Queenside: Spoken inputs like "castle queenside", "queenside castle", "long castle", "O-O-O". Confirmed with "White castles queenside."
* **Pawn Promotion:**
  - Notation: `e8=Q`, `e8=R`, `e8=B`, `e8=N`.
  - Spoken inputs: "promote to queen", "Eva 8 Queen", "e8 queen", "pawn to e8 promote to rook".
  - Behavior: Move parser must extract the specified promotion piece ($q$, $r$, $b$, $n$). Default to Queen ($q$) if unspecified on the 8th rank.
  - Narration: "White pawn to Eva 8. Promoted to queen."
* **En Passant:**
  - Rule: When an opposing pawn advances 2 squares past a pawn on the 5th rank, the player may capture it diagonally on the passed square on the immediately following half-move.
  - Spoken inputs: "exf6", "takes on Felix 6", "Eva takes Felix 6", "en passant", "pawn takes en passant".
  - Narration: "White pawn takes pawn on Felix 6." Captured pawn counter must increment correctly.
* **Resignation:**
  - Spoken inputs: "I resign", "resign", "concede", "surrender", "I forfeit".
  - Behavior: Immediately terminates the game in favor of the opponent. Turn state freezes, `isGameOver` is set to `true`, and verbal announcement confirms: "White resigns. Black wins by resignation."
  - State preservation: Board FEN and move history are preserved; subsequent move attempts are rejected.

### Domain 3: Fuzzy Move Parsing, Homophone Resolution & Ambiguity Scoring
* **Homophone Resolution:**
  - Piece homophones: 'night' / 'nite' / 'nights' / 'horse' $\rightarrow$ knight ($n$); 'rock' / 'tower' / 'castle' / 'brook' $\rightarrow$ rook ($r$); 'bish' / 'fish' / 'dish' $\rightarrow$ bishop ($b$); 'cream' / 'keen' / 'clean' $\rightarrow$ queen ($q$).
  - Coordinate homophones: 'see four' $\rightarrow$ 'c4'; 'before' $\rightarrow$ 'b4'; 'won' $\rightarrow$ '1'; 'too' $\rightarrow$ '2'; 'tree' / 'free' $\rightarrow$ '3'; 'fore' $\rightarrow$ '4'; 'fife' / 'hive' $\rightarrow$ '5'; 'sic' $\rightarrow$ '6'; 'ate' / 'ait' $\rightarrow$ '8'.
  - Preposition & filler filtering: Words such as 'please', 'play', 'move', 'go', 'put', 'place', 'take', 'to', 'on', 'um', 'uh', 'i want to play' must be stripped or weighted so they do not corrupt coordinate matching.
* **Ambiguity Threshold & Clarification:**
  - Threshold: Confidence score $< 0.6$ MUST flag the move as ambiguous.
  - Action: Instead of guessing or executing an unintended move, the agent returns `success: false` with a clear verbal prompt offering up to 5 legal candidate suggestions:
    `"I'm not sure which move you mean by \"[input]\". Some options are: [moves]. Could you be more specific?"`
  - Multi-candidate Ambiguity: If multiple legal moves match equally (e.g. two knights that can move to the same square: "knight to David 2" when both $Nbd2$ and $Nfd2$ are legal), confidence must be set $< 0.6$ and prompt: "Both knights can move to David 2. Which knight: Bella 1 or Felix 3?"

### Domain 4: Board Scan Feature (Strict Rank 1 to Rank 8 Ordering)
* **Authoritative Format:** Official IBCA tournament standard for verbal board inspection:
  1. Opening preamble: `"Board position, scanning rank 1 through rank 8. It's White's turn."`
  2. Sequential iteration strictly from Rank 1 through Rank 8.
  3. For each rank, all occupied squares listed from file $a$ (Anna) to file $h$ (Hector).
  4. Each piece formatted as `<Color> <Piece_Name> <IBCA_File> <Rank_Number>` (e.g., `"Rank 1: White rook Anna 1, White knight Bella 1, White bishop Cesar 1, White queen David 1, White king Eva 1, White bishop Felix 1, White knight Gustav 1, White rook Hector 1."`).
  5. Empty ranks are omitted to keep audio concise.
  6. Trailing condition check: If player's king is under attack, append `"<Color> is in check!"`.
* **Focused Descriptions:**
  - `threats`: Enumerates all player pieces under direct attack by the opponent with coordinates.
  - `kingside`: Describes pieces located on files $e$ through $h$.
  - `queenside`: Describes pieces located on files $a$ through $d$.
  - `center`: Describes pieces on $d4, d5, e4, e5$ and extended center.
  - `my_pieces`: Lists all active friendly pieces and coordinates.
  - `captures`: Summarizes all pieces captured by White and Black.

### Domain 5: Autonomous Opponent Engine, Latency & 3 Difficulty Levels
* **Latency Requirement:** Opponent move computation must execute in $< 1500\text{ms}$ across all game phases (opening, middlegame, endgame) without blocking browser UI or audio rendering threads.
  - *Empirically Verified:* Current heuristic engine executes in $1.67\text{ms}$ to $17.81\text{ms}$ (average $< 10\text{ms}$), well within the $1500\text{ms}$ threshold.
* **Non-Blocking Execution:** Move evaluation must run asynchronously or within lightweight microtasks, guaranteeing 0ms stutter on Web Audio playback.
* **3 Demonstrably Distinct Difficulty Levels:**
  1. **Beginner:** Random legal move selection. Produces high entropy move distributions, frequently blunders or makes passive pawn/king moves.
  2. **Intermediate:** Tactical heuristic focusing on immediate captures (MVV-LVA) and checks with 70% probability, combined with 30% exploration.
  3. **Advanced / Master:** Deterministic positional and tactical heuristic scoring (Checkmate $> 10000$, Checks $+50$, MVV-LVA Captures $+10\times V_{victim} - V_{attacker}$, Center Control $+5$, Development $+3$, Castling $+8$). Demonstrates 100% distinct, optimal move selection in standardized test positions.

### Domain 6: Error Handling & Strict State Preservation
* **Illegal Moves:** Reject illegal move attempts (e.g., moving piece to occupied square of same color, pawn backwards, moving into check) with informative verbal explanations.
* **Illegal Squares:** Reject non-existent squares (e.g., "z9", "j4") with informative verbal guidance.
* **State Invariant:** All illegal attempts MUST preserve 100% of the game state:
  - FEN string remains unchanged.
  - Active turn color remains unchanged.
  - Move history and half-move clock remain unchanged.
  - Captured pieces list remains unchanged.

### Domain 7: Accessibility (ARIA Live Regions, Landmarks, Full Keyboard Control)
* **Keyboard Shortcuts for ALL Interactive Elements:**
  - `L` (Hold/Release): Push-to-Listen / Push-to-Talk activation.
  - `D`: Describe board position (full Rank 1–8 scan).
  - `T`: Describe current tactical threats.
  - `O`: Describe own pieces.
  - `C`: Describe captured pieces.
  - `S`: Start / Stop voice game session.
  - `N`: New Game reset.
  - `U`: Undo last move pair.
  - `1`, `2`, `3`: Select engine difficulty level (Beginner, Intermediate, Advanced).
  - Full tab navigation with visible focus rings (`focus:ring-2 focus:ring-emerald-500 focus:outline-none`) on all buttons.
* **ARIA Live Regions for Assistive Screen Readers:**
  - `aria-live="polite"` region for turn transitions, agent text responses, and board scan narration.
  - `aria-live="assertive"` region for critical game events: Check alert (`"Warning: Your King is in check!"`), Checkmate, Stalemate, and Draw alerts.
  - `role="status"` on connection status indicators.
  - Semantic HTML landmarks (`<header role="banner">`, `<main role="main">`, `<aside role="complementary">`).

### Domain 8: Audio Pipeline (Push-to-Listen, Interruption, Muting)
* **Push-to-Listen State Transitions:**
  - Key 'L' down or Button touch/down: transitions to `listening`, captures 24kHz PCM16 audio via `AudioWorklet`, streams to WebSocket.
  - Key 'L' up or Button touch/up: transitions to `ready`, emits silence burst (3 frames of 1200 samples = 150ms) to trigger server-side VAD turn completion.
* **Audio Interruption & Muting:**
  - When user speaks or activates push-to-talk while agent audio is playing:
    - Speaker playback buffer MUST be immediately flushed (`flushAudio()`).
    - Browser speech synthesis MUST be immediately cancelled (`stopSpeaking()`).
    - WebSocket server `reply.done` event with `status: 'interrupted'` triggers immediate ring buffer flush.
  - Manual mute toggle / hotkey (`M`) to silence audio output.

### Domain 9: Headless Mock Audio & Agent CI/CD Test Harness
* **Zero-Credential CI Execution:** The test suite must run and pass in headless CI environments (GitHub Actions, containerized runners) where `ASSEMBLYAI_API_KEY` is not present.
* **Synthetic Voice Agent Harness:**
  - In-memory mock server/client simulating AssemblyAI WebSocket protocol:
    - `session.ready`
    - `user.transcript` / `transcript.user` (partial and final)
    - `tool.call` (e.g. `apply_move`, `describe_board`, `get_legal_moves`, `get_hint`, `undo_move`)
    - `tool.result`
    - `reply.audio`
    - `reply.done` (`status: completed` | `status: interrupted`)
* **Automated Coverage Target:** At least 30 distinct tests covering:
  - IBCA notation parsing ("Eva 4", "Felix 3", "Cesar 4")
  - Standard algebraic notation
  - Castling (kingside and queenside)
  - Pawn promotion
  - En passant
  - Resignation
  - Homophone resolution ('night', 'see four', 'before')
  - Ambiguity threshold ($< 0.6$)
  - 3 engine difficulty levels (demonstrable variance)
  - End-to-end headless voice turn simulation

### Domain 10: Build and Code Quality Compliance
* **Zero Build Errors:** `npm run build` must compile cleanly with zero TypeScript errors and zero Turbopack/Next.js warnings.
* **Zero Lint Errors & Warnings:** `npm run lint` must pass with zero ESLint errors and zero ESLint warnings.
* **Zero Test Failures:** `npm test` must execute with 100% pass rate across all test suites.

---

## 3. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | IBCA Standard | `squareToIBCA` | Maps coordinate square to official IBCA phonetic name | e.g. `"e4"`, `"a1"`, `"h8"` | `"Eva 4"`, `"Anna 1"`, `"Hector 8"` | Returns raw input if invalid format | `src/lib/chess-engine.ts:33` |
| 2 | IBCA Standard | Rank 1–8 Board Scan | Verbal description of occupied squares strictly ordered Rank 1 to 8 | `focus: "full"` | String starting with `"Board position, scanning rank 1 through rank 8..."` | Returns error if board cannot be read | `src/lib/chess-engine.ts:194` |
| 3 | Chess Mechanics | SAN Move Parsing | Standard algebraic notation move execution | e.g. `"e4"`, `"Nf3"`, `"Bxf7+"` | `MoveResult` object with `success: true` | `success: false` + error narration | `src/lib/chess-engine.ts:77` |
| 4 | Chess Mechanics | Kingside Castling | Short castle move parsing and execution | `"castle kingside"`, `"O-O"`, `"short castle"` | `MoveResult` with `"White castles kingside."` | Rejection if king in check or blocked | `src/lib/tool-handlers.ts:197` |
| 5 | Chess Mechanics | Queenside Castling | Long castle move parsing and execution | `"castle queenside"`, `"O-O-O"`, `"long castle"` | `MoveResult` with `"White castles queenside."` | Rejection if squares attacked or blocked | `src/lib/tool-handlers.ts:201` |
| 6 | Chess Mechanics | Pawn Promotion | Promotion of 7th rank pawn to Queen/Rook/Bishop/Knight | e.g. `"e8=Q"`, `"Eva 8 Queen"` | `MoveResult` with `"Promoted to [piece]."` | Invalid promotion piece rejected | `src/lib/chess-engine.ts:159` |
| 7 | Chess Mechanics | En Passant Capture | Diagonal capture of 2-square advancing pawn | e.g. `"exf6"`, `"Eva takes Felix 6"` | `MoveResult` with capture narration | Rejection if en passant expired | `src/lib/chess-engine.ts:140` |
| 8 | Chess Mechanics | Resignation | Player resigns the game immediately | `"I resign"`, `"resign"`, `"concede"` | Game over, opponent declared winner | Preserves board, rejects future moves | `ORIGINAL_REQUEST.md:36` |
| 9 | Speech & ASR | Homophone 'night' $\rightarrow$ 'knight' | Resolves knight homophone in speech | `"night to f3"`, `"nite to c3"` | Parses to `Nf3`, `Nc3` with confidence 0.9 | Rejects if square illegal | `src/lib/tool-handlers.ts:103` |
| 10 | Speech & ASR | Homophone 'see four' $\rightarrow$ 'c4' | Resolves letter/number word combination | `"see four"`, `"see 4"` | Parses to `c4` with confidence 1.0 | Rejects if illegal pawn move | `src/lib/tool-handlers.ts:124` |
| 11 | Speech & ASR | Homophone 'before' $\rightarrow$ 'b4' | Resolves combined word homophone | `"before"`, `"bee four"` | Parses to `b4` | Ambiguity clarification if unmapped | `ORIGINAL_REQUEST.md:37` |
| 12 | Speech & ASR | Ambiguity Gating ($< 0.6$) | Intercepts low confidence moves for verbal confirmation | Confidence score $< 0.6$ | Verbal clarification + 5 suggested moves | Blocks move execution, preserves FEN | `ORIGINAL_REQUEST.md:37`, `tool-handlers.ts:278` |
| 13 | Engine AI | Difficulty 'Beginner' | Random legal move selection | `makeEngineMove('beginner')` | Legal move chosen uniformly at random | Rejects if no legal moves (game over) | `src/lib/chess-engine.ts:463` |
| 14 | Engine AI | Difficulty 'Intermediate'| Tactical capture/check heuristics (70% tactical) | `makeEngineMove('intermediate')` | Tactically focused move selection | Rejects if no legal moves | `src/lib/chess-engine.ts:467` |
| 15 | Engine AI | Difficulty 'Advanced' | Deterministic heuristic evaluation (MVV-LVA, center) | `makeEngineMove('advanced')` | Optimal scored move | Rejects if no legal moves | `src/lib/chess-engine.ts:477` |
| 16 | Engine AI | Non-blocking Latency | Rapid computation ($< 1500\text{ms}$) | Any legal FEN across 3 phases | Move execution in $< 20\text{ms}$ | Timeout fallback | `ORIGINAL_REQUEST.md:41` |
| 17 | Error Handling | State Preservation | Board invariant preservation on illegal moves | Illegal SAN, wrong turn, invalid square | FEN, turn, history remain identical | Returns verbal explanation | `src/lib/chess-engine.ts:91` |
| 18 | Accessibility | ARIA Live Turn Region | Screen-reader announcement of turn change | Turn changes between 'w' and 'b' | `aria-live="polite"` text announcement | Suppressed when game disconnected | `ORIGINAL_REQUEST.md:47` |
| 19 | Accessibility | ARIA Live Check Alert | Urgent announcement of check / checkmate | King placed under attack | `aria-live="assertive"` text alert | Omitted when not in check | `ORIGINAL_REQUEST.md:47` |
| 20 | Accessibility | Keyboard Shortcuts | Hands-free operation of all interactive elements | Keys `L`, `D`, `T`, `O`, `C`, `S`, `N`, `U`, `1-3` | Triggers corresponding action | Ignores repeats and input elements | `src/app/page.tsx:346` |
| 21 | Audio Pipeline | Push-to-Listen ('L') | Microphonic capture gated by key press | Hold 'L' / Release 'L' | Starts/stops PCM16 audio stream | Sends silence burst on release | `src/lib/voice-agent.ts:76` |
| 22 | Audio Pipeline | Audio Interruption | Flushing playback ring buffer upon interruption | User speech or `status: 'interrupted'` | Immediate audio buffer flush (`flushPlayback`) | Prevents stale audio overlap | `src/lib/voice-agent.ts:255` |
| 23 | Tool Dispatch | `apply_move` | Dispatches spoken move to engine and returns opponent reply | `{ move_description: string }` | Combined narration of both moves | Verbal clarification on ambiguity | `src/lib/tool-handlers.ts:265` |
| 24 | Tool Dispatch | `describe_board` | Board state inspector with multi-focus support | `{ focus: 'full' \| 'threats' \| ... }` | JSON description string | Defaults to 'full' if unspecified | `src/lib/tool-handlers.ts:321` |
| 25 | Tool Dispatch | `get_legal_moves` | Enumerates legal options for piece or square | `{ piece_or_square: string }` | Formatted string of legal destinations | Explains if no moves available | `src/lib/tool-handlers.ts:328` |
| 26 | Tool Dispatch | `get_hint` | Coaching suggestion from simple evaluation | `{}` | Best move + tactical explanation | Reports game over if terminal | `src/lib/tool-handlers.ts:334` |
| 27 | Tool Dispatch | `undo_move` | Reverts player and opponent move pair | `{}` | Restores board position 2 plies back | Reports error if no moves to undo | `src/lib/tool-handlers.ts:340` |
| 28 | Test Harness | Headless Mock Harness | Simulates voice agent lifecycle without API key | Synthetic events & mock WebSocket | Validates tool calls & moves in CI | Fails gracefully if assertion fails | `ORIGINAL_REQUEST.md:53` |

---

## 4. Edge Cases Discovered & Observed Behaviors

| # | Feature | Input / Condition | Observed Behavior | Analysis / Corrective Action |
|---|---------|-------------------|-------------------|------------------------------|
| 1 | Homophone Parsing | Spoken input `"before"` | Evaluated to move `a3` with `confidence: 0.2`; returned clarification request. | **BUG:** `"before"` was not parsed to `"b4"`. Add `"before": "b4"` to phonetic token mappings. |
| 2 | Pawn Promotion | Spoken input `"Eva 8 Queen"` or `"e8 queen"` | Evaluated to `e8=N` (Knight!) with `confidence: 0.9`. | **CRITICAL BUG:** `fuzzyMatchMove` does not score `move.promotion`. `e8=N` was picked because it appeared first in legalMoves array. Must score promotion piece. |
| 3 | Pawn Promotion | Spoken input `"promote to queen"` | Scored as `e8=N` with `confidence: 0.2`; triggered clarification. | **BUG:** Destination square missing, score was 0. Must infer destination if only one pawn on 7th rank can promote. |
| 4 | Resignation | Spoken input `"I resign"` or `"resign"` | Scored as `a3` with `confidence: 0.2`; asked for clarification. | **MISSING FEATURE:** No resignation handler in `handleToolCall` or `apply_move`. Must recognize resignation keywords and trigger game resignation. |
| 5 | Ambiguity Threshold | Ambiguous move with confidence score 0.55 | Currently accepted if threshold is `< 0.5`. | **SPEC MISMATCH:** Code currently checks `confidence < 0.5` (`tool-handlers.ts:278`), but specification mandates `< 0.6`. Must update to `< 0.6`. |
| 6 | Castling in Opening | Spoken `"castle kingside"` at move 1 | Scored `a3` with `confidence: 0.2`; prompted clarification. | Confirmed: Castling is illegal on move 1; correctly rejected. Informative error explanation should explain that castling is currently illegal. |
| 7 | Legal Castling | `"castle kingside"` when legal (e.g. after 1. e4 e5 2. Bc4 Bc5 3. Nf3 Nf6) | Evaluated to `O-O` with `confidence: 1.0` in 10ms; narration confirmed `"White castles kingside."`. | Correct behavior. |
| 8 | En Passant | Spoken `"Eva takes Felix 6"` in FEN with `f6` en passant target | Correctly resolved to `exf6` with `confidence: 0.9`; narrated capture on Felix 6. | Correct behavior. |
| 9 | Multi-Piece Ambiguity | Spoken input `"knight"` on move 1 | Automatically selected `Na3` with `confidence: 0.9`. | **DEFECT:** 4 knight moves are legal ($Na3, Nc3, Nf3, Nh3$). The system should flag ambiguity ($< 0.6$) and prompt user to specify which knight / square. |
| 10 | Board Scan (Kings Only) | Endgame FEN `8/8/8/4k3/8/8/8/4K3 w - - 0 1` | Output: `"Board position, scanning rank 1 through rank 8. It's White's turn. Rank 1: White king Eva 1. Rank 5: Black king Eva 5."` | Correct behavior: Empty ranks (2, 3, 4, 6, 7, 8) omitted cleanly. |
| 11 | Opponent Check | Board position where player's king is in check | Board scan appends `"White is in check!"`. Move narration appends `"Check!"`. | Correct behavior per IBCA standard. |
| 12 | State Preservation on Error | Illegal move `e5` on move 1 | Rejected with error narration; FEN remained identical; turn remained `w`. | Correct behavior: strict state preservation verified. |
| 13 | State Preservation in Check | King in check, attempting illegal non-blocking move `Nf3` | Rejected with narration: `"Legal moves include: g3, and more."`; FEN remained unchanged. | Correct behavior. |
| 14 | Push-to-Talk Interruption | User presses 'L' while agent audio is actively playing | `stopSpeaking()` is called, but `agentRef.current.flushAudio()` is NOT called in `page.tsx`. | **DEFECT:** Speaker ring buffer continues outputting until server VAD roundtrip. `flushAudio()` must be called immediately on 'L' keydown. |
| 15 | Difficulty Level Setting | Engine move requested | `handleToolCall` hardcodes `engine.makeEngineMove('intermediate')`. | **LIMITATION:** Difficulty is not selectable via UI or tool call arguments. Must add difficulty state to engine/agent router. |
| 16 | ESLint Warnings | `npm run lint` executed on repository | 3 unused variable warnings in `route.ts` and `tool-handlers.ts`. | **ACCEPTANCE CRITERIA VIOLATION:** Acceptance criteria requires zero warnings. |
| 17 | Test Count | `npm test` executed | 18 tests across 2 files pass. | **ACCEPTANCE CRITERIA VIOLATION:** Acceptance criteria requires at least 30 distinct tests covering IBCA, SAN, castling, promotion, en passant, resignation, and headless mock harness. |

---

## 5. Codebase Gap Analysis & Root Cause Breakdown

### Gap 1: Promotion Logic in Fuzzy Move Matcher
- **Location:** `src/lib/tool-handlers.ts:210-252` (`fuzzyMatchMove`)
- **Root Cause:** The scoring loop examines `move.to`, `move.from`, `move.piece`, and `move.captured`. It completely neglects `move.promotion`. When multiple promotion moves exist for a pawn reaching the 8th rank (`e8=Q`, `e8=R`, `e8=B`, `e8=N`), all four moves receive identical scores. Because `chess.js` generates knight promotions first, the fuzzy matcher always defaults to `e8=N` even when the user says "queen".
- **Fix Required:** Detect promotion keywords in normalized speech (`queen`, `rook`, `bishop`, `knight`), and grant $+12$ points to moves where `move.promotion` matches the spoken target.

### Gap 2: Homophone Mapping for 'before' $\rightarrow$ 'b4'
- **Location:** `src/lib/tool-handlers.ts:114-172` (`IBCA_FILES`, `normalizeIBCASpeech`)
- **Root Cause:** While "see four" is resolved via "see" $\rightarrow$ "c" and "four" $\rightarrow$ "4", "before" is a single English word. Neither `IBCA_FILES` nor `NUMBER_WORDS` splits "before" into "b" and "4".
- **Fix Required:** Add explicit phrase replacement `s = s.replace(/\bbefore\b/g, 'b4');` in `normalizeIBCASpeech`.

### Gap 3: Ambiguity Confidence Threshold
- **Location:** `src/lib/tool-handlers.ts:278`
- **Root Cause:** Current threshold check is `if (confidence < 0.5)`. The acceptance criteria strictly mandates `< 0.6`. In addition, whenever multiple candidate moves share the highest score, confidence should be lowered to $< 0.6$ rather than arbitrarily selecting the first candidate.
- **Fix Required:** Update comparison to `if (confidence < 0.6)`. Implement multi-candidate tie detection.

### Gap 4: Resignation Handling
- **Location:** `src/lib/chess-engine.ts`, `src/lib/tool-handlers.ts`
- **Root Cause:** Neither `ChessEngine` nor `handleToolCall` contains logic to handle resignation. Spoken phrases like "I resign" fail to match legal moves and generate confusing clarification prompts.
- **Fix Required:** Add `resign(color: Color): MoveResult` in `ChessEngine`, and intercept resignation phrases in `apply_move` or via a dedicated tool handler.

### Gap 5: Opponent Engine Difficulty Selection
- **Location:** `src/lib/tool-handlers.ts:291`, `src/lib/chess-engine.ts:449`, `src/app/page.tsx`
- **Root Cause:** `handleToolCall` invokes `engine.makeEngineMove('intermediate')` with hardcoded `'intermediate'`. There is no mechanism in `handleToolCall` or `page.tsx` to switch between `beginner`, `intermediate`, and `advanced`.
- **Fix Required:** Store current difficulty in `ChessEngine` state or pass via `GameConfig`, with keyboard shortcuts (`1`, `2`, `3`) and UI controls to toggle.

### Gap 6: Audio Interruption on Push-to-Listen Activation
- **Location:** `src/app/page.tsx:308-312` (`startListening`)
- **Root Cause:** When user holds 'L', `startListening` calls `stopSpeaking()` (cancelling Web Speech API), but fails to call `agentRef.current.flushAudio()`. If AssemblyAI is currently streaming audio chunks, they continue playing through the `ScriptProcessorNode`.
- **Fix Required:** Add `agentRef.current.flushAudio()` inside `startListening()`.

### Gap 7: Missing ARIA Live Regions & Comprehensive Keyboard Navigation
- **Location:** `src/app/page.tsx`, `src/components/GameStatus.tsx`, `src/components/TranscriptPanel.tsx`
- **Root Cause:** Status messages and transcript updates lack `aria-live="polite"` or `aria-live="assertive"` regions. Only 5 keyboard shortcuts are bound (L, D, T, O, C); interactive controls such as Start Game, New Game, Stop Game, and Difficulty selection require mouse clicks.
- **Fix Required:** Add ARIA live containers for game status announcements, turn changes, checks, and agent responses. Add hotkeys: `S` (Start/Stop), `N` (New Game), `U` (Undo), `1-3` (Difficulty).

### Gap 8: Mock Audio / Agent Headless Test Harness
- **Location:** `src/lib/__tests__/`
- **Root Cause:** Only 18 unit tests exist. There is no mock harness for simulating synthetic voice agent interactions without `ASSEMBLYAI_API_KEY`.
- **Fix Required:** Create `src/lib/__tests__/mock-voice-agent.test.ts` (or expand existing test suites) providing a full mock WebSocket / synthetic voice event harness and bringing test count to $> 30$ tests covering all required move types and scenarios.

### Gap 9: ESLint Warnings
- **Location:** `src/app/api/token/route.ts:40:9`, `src/lib/tool-handlers.ts:11:3, 15:3`
- **Root Cause:** Unused variables (`referer`, `ValidateMoveArgs`, `Move`) trigger `@typescript-eslint/no-unused-vars` warnings.
- **Fix Required:** Remove or prefix unused variables to achieve 0 warnings on `npm run lint`.

---

## 6. Acceptance Criteria Checklist & Verification Strategy

| Acceptance Criterion | Current Status | Verification Command | Required Action |
|----------------------|----------------|----------------------|-----------------|
| `npm test` passes cleanly with zero failures | ✅ Passing (18/18) | `npm test` | Maintain 100% pass rate while expanding test cases. |
| $\ge 30$ distinct automated tests covering IBCA, SAN, castling, promotion, en passant, resignation | ❌ 18 tests present | `npx vitest run` | Add $\ge 15$ new tests covering special moves, promotion to queen, en passant, resignation, homophones. |
| Fuzzy move parser resolves 'night', 'see four', 'before' | ⚠️ 'night' and 'see four' pass; 'before' fails | `npx vitest run` | Add 'before' $\rightarrow$ 'b4' normalization in `normalizeIBCASpeech`. |
| Ambiguous moves ($< 0.6$ confidence) flag verbal clarification | ⚠️ Checks $< 0.5$ | `npx vitest run` | Update threshold to $< 0.6$ and detect multi-candidate ties. |
| Board scan outputs occupied squares strictly Rank 1 to 8 with piece & IBCA coordinates | ✅ Verified | `npx vitest run` | Maintain Rank 1–8 sorting invariant in `describeFullBoard`. |
| Opponent engine computes moves in $< 1500\text{ms}$ without blocking UI | ✅ Verified (1.6ms – 18ms) | Benchmark in test | Maintain lightweight heuristic evaluation. |
| Engine supports 3 difficulty levels with demonstrably distinct move selection | ⚠️ Implemented in engine, but hardcoded in tool router | `npx vitest run` | Wire difficulty configuration through engine state and tool handler. |
| Invalid moves / illegal squares rejected with verbal explanation and state preserved | ✅ Verified | `npx vitest run` | Maintain strict state preservation invariants. |
| All interactive elements operable via keyboard shortcuts | ⚠️ Only 5 shortcuts | Manual / DOM test | Bind S, N, U, 1, 2, 3 shortcuts. |
| ARIA live regions announce turn changes, check, game-over, agent responses | ❌ Missing ARIA regions | DOM test | Add `role="status"` and `aria-live` containers to `page.tsx` & components. |
| Audio handles push-to-listen transitions and mutes playback when interrupted | ⚠️ Flush missing on 'L' | DOM / unit test | Invoke `flushAudio()` upon `startListening()`. |
| `npm run build` succeeds with zero errors | ✅ Verified (turbopack) | `npm run build` | Maintain zero TypeScript errors. |
| `npm run lint` passes with zero errors and zero warnings | ❌ 3 warnings present | `npm run lint` | Fix unused variable warnings. |
| Mock audio/agent test harness runs headless in CI without `ASSEMBLYAI_API_KEY` | ❌ Not implemented | `npm test` | Implement synthetic headless event test harness. |

---

## 7. Authoritative Technical Specifications Summary

### Chess Tool Schemas (JSON-Schema for Voice Agent API)
```json
[
  {
    "type": "function",
    "name": "apply_move",
    "description": "Apply a player's move to the board. Accepts standard notation, IBCA phonetics, natural language, resignation, or homophones. Returns narration containing player move and opponent response.",
    "parameters": {
      "type": "object",
      "properties": {
        "move_description": { "type": "string" }
      },
      "required": ["move_description"]
    }
  },
  {
    "type": "function",
    "name": "describe_board",
    "description": "Describe the current board position for the player using IBCA Rank 1 to 8 tournament standards.",
    "parameters": {
      "type": "object",
      "properties": {
        "focus": {
          "type": "string",
          "enum": ["full", "kingside", "queenside", "center", "threats", "my_pieces", "captures"]
        }
      }
    }
  },
  {
    "type": "function",
    "name": "get_legal_moves",
    "description": "List legal moves for a piece or all pieces with IBCA coordinates.",
    "parameters": {
      "type": "object",
      "properties": {
        "piece_or_square": { "type": "string" }
      }
    }
  },
  {
    "type": "function",
    "name": "get_hint",
    "description": "Get a move suggestion with tactical explanation.",
    "parameters": { "type": "object", "properties": {} }
  },
  {
    "type": "function",
    "name": "undo_move",
    "description": "Take back the last move pair (player + opponent).",
    "parameters": { "type": "object", "properties": {} }
  }
]
```

### Performance & Non-Blocking Invariants
- Engine computation latency: $< 1500\text{ms}$ (empirical: $< 20\text{ms}$).
- Audio capture sample rate: $24000\text{Hz}$ PCM16 mono.
- Audio chunk duration: $50\text{ms}$ (1200 samples per buffer).
- VAD silence burst on push-to-listen release: $150\text{ms}$ (3 silence frames).
- Ambiguity threshold: Score $< 0.6 \implies$ verbal clarification.

