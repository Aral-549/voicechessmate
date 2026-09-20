# Original User Request

## Initial Request — 2026-09-13T10:29:30Z

VoiceChessmate is an accessible, conversational voice-first chess companion for blind and visually impaired players powered by AssemblyAI's Voice Agent API and FIDE/IBCA phonetic standards. The goal is full hackathon submission readiness with advanced chess engine capabilities, robust audio and speech interaction, comprehensive test suites, and accessible UX polish.

Working directory: /home/h3r0-k1ll3r/Downloads/assemblyai/voicechessmate
Integrity mode: development

## Verification Resources
- Existing test suites: `src/lib/__tests__/chess-engine.test.ts` and `src/lib/__tests__/tool-handlers.test.ts`
- Project specification and architecture: `PROJECT_CONTEXT.md`
- Hackathon rules and guidelines: `../ASSEMBLYAI_VOICE_AGENT_HACKATHON.md`

## Requirements

### R1. Conversational Chess Play & Accessible Voice Controls
The application must provide an accessible, voice-first chess experience supporting full FIDE and IBCA phonetic standards (Anna through Hector) alongside standard algebraic notation, natural conversational commands, and blind-chess spatial mental models (move deltas, rank-by-rank board orientation scans, captured piece summaries, and tactical threat explanations). Players must be able to play complete games with real-time bidirectional voice feedback, move suggestions, and move undo.

### R2. Responsive Opponent Engine & Difficulty Scaling
The game must support autonomous opponent play with configurable difficulty/skill levels that run smoothly in the browser without freezing the UI or audio thread. The engine must reliably evaluate legal moves, calculate opponent replies promptly, and provide contextual gameplay guidance and threat analysis when requested by the player.

### R3. Speech Robustness & ASR Error Resilience
The voice pipeline and command recognition must gracefully handle speech recognition mis-hearings (homophones like "night" vs "knight", "see four" vs "c4"), conversational hesitation or thinking aloud, and user interruptions during board narration. The system must clearly ask for clarification on ambiguous inputs rather than executing unintended moves.

### R4. Accessible UI, Spectator View, and Audio Feedback
The interface must adhere to accessibility standards (full keyboard navigation, high-contrast visual cues, screen-reader compatibility via ARIA landmarks and live regions), provide sound cues for game events (move, capture, check, victory, error), and render a synchronized board view and move ledger for sighted coaches or spectators.

### R5. Verification Harness and Automated Test Coverage
The codebase must include automated verification covering chess rules, move notation parsing, tool dispatch, opponent responses, and synthetic voice interaction scenarios via a mock audio/agent test harness that can run headless in CI without live API credentials.

## Acceptance Criteria

### Core Chess & Voice Rules Verification
- [ ] `npm test` passes all tests cleanly with zero failures.
- [ ] Automated test suite includes at least 30 distinct tests covering IBCA notation ("Eva 4", "Felix 3", "Cesar 4"), standard algebraic notation, castling ("castle kingside/queenside"), pawn promotion, en passant, and resignation.
- [ ] Fuzzy move parser correctly resolves common chess homophones and ASR errors ("night" -> "knight", "see four" -> "c4", "before" -> "b4") and flags ambiguous moves with confidence < 0.6 for verbal clarification.
- [ ] Board scan feature outputs occupied squares strictly ordered from Rank 1 to Rank 8 with piece identity and square coordinates.

### Engine Play & Robustness
- [ ] Opponent engine computes legal responses within 1500ms across all game phases (opening, middlegame, endgame) without blocking the UI.
- [ ] Engine supports at least 3 selectable difficulty levels that exhibit demonstrably distinct move selection characteristics in automated tests.
- [ ] Invalid moves or illegal square requests are rejected with informative verbal error explanations and preserve the exact board state.

### Audio & Accessibility Quality
- [ ] All interactive elements are fully operable via keyboard shortcuts without requiring mouse interaction.
- [ ] ARIA live regions announce turn changes, check, game-over states, and agent responses for assistive screen readers.
- [ ] Audio system properly handles push-to-talk / push-to-listen state transitions and mutes playback when interrupted.

### Build & Code Quality
- [ ] `npm run build` succeeds with zero TypeScript or Next.js build errors.
- [ ] `npm run lint` passes with zero ESLint errors or warnings.
- [ ] Mock audio/agent test harness runs headless in CI/test scripts without requiring a live `ASSEMBLYAI_API_KEY`.
