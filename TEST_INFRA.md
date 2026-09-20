# VoiceChessmate — Test Infrastructure Specification

> **Document Version:** 1.0.0  
> **Author:** `test_writer_e2e_1` (E2E Test Writer)  
> **Date:** 2026-09-13  
> **Scope:** Testing architecture, execution harnesses, verification patterns, and CI/CD integration for VoiceChessmate.

---

## 1. Test Architecture Overview

VoiceChessmate utilizes **Vitest 5.0** as its primary test runner, coupled with native TypeScript (`tsconfig.json` ES2017 target with bundler resolution) and `@/` path aliasing to `./src`.

```
voicechessmate/
├── vitest.config.ts                      # Test runner configuration & path aliases
├── package.json                          # Test scripts (`npm test` -> `vitest run`)
├── src/
│   ├── lib/
│   │   ├── chess-engine.ts               # SUT: Core Chess Engine & AI heuristics
│   │   ├── tool-handlers.ts              # SUT: Speech normalization & Tool routing
│   │   └── __tests__/
│   │       ├── chess-engine.test.ts      # Unit tests: Core engine operations (9 tests)
│   │       ├── tool-handlers.test.ts     # Unit tests: Tool routing & fuzzy match (9 tests)
│   │       └── e2e-requirements.test.ts # E2E Requirements Test Suite (48 tests)
```

Total active automated tests: **66 tests** across 3 test suites.

---

## 2. Test Execution Commands

| Command | Purpose |
|---|---|
| `npm test` | Run entire test suite headlessly across all suites (`vitest run`). |
| `npx vitest run src/lib/__tests__/e2e-requirements.test.ts` | Run exclusively the comprehensive E2E requirements suite. |
| `npx vitest run src/lib/__tests__/chess-engine.test.ts` | Run core chess engine unit tests. |
| `npx vitest run src/lib/__tests__/tool-handlers.test.ts` | Run tool dispatch and speech fuzzy matcher unit tests. |
| `npx vitest run -t "<pattern>"` | Filter test execution by test suite category or description pattern. |

---

## 3. Testing Tiers & Coverage Hierarchy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Tier 5: Adversarial Stress                       │
│      Invalid coordinates, out-of-turn moves, check evasion stress       │
├────────────────────────────────────────────────────────────────────────┤
│                     Tier 4: Engine AI & Latency                        │
│   Opening/Middle/Endgame latency < 1500ms, 3 distinct difficulty modes  │
├────────────────────────────────────────────────────────────────────────┤
│               Tier 3: Speech Robustness & Tool Dispatch                │
│    ASR homophones ("night", "see four", "before"), ambiguity < 0.6     │
├────────────────────────────────────────────────────────────────────────┤
│                 Tier 2: FIDE & IBCA Phonetic Standards                 │
│      Anna-Hector files ("Eva 4", "Felix 3"), strict Rank 1-8 scan       │
├────────────────────────────────────────────────────────────────────────┤
│                    Tier 1: Core Chess Rules & State                    │
│      SAN, Castling, Promotion, En Passant, Resignation, State Undo      │
└────────────────────────────────────────────────────────────────────────┘
```

### Tier 1: Core Chess Rules & State Invariants
- Validates standard SAN moves, captures, checks, checkmate, stalemate, and draw conditions.
- Validates castling legality (kingside `O-O`, queenside `O-O-O`), king/rook coordinates, and path obstruction rejection.
- Validates pawn promotion across all piece types (Queen, Rook, Bishop, Knight).
- Validates en passant captures, coordinate removal, and captured pieces ledger tracking.
- Validates game resignation setting `isGameOver: true`, freezing turn, preserving FEN, and rejecting subsequent moves.
- Validates reversible move undoing restoring turn, half-move clock, FEN, and captured pieces.

### Tier 2: FIDE & IBCA Phonetic Standards
- Validates all 8 IBCA phonetic files: Anna ($a$), Bella ($b$), Cesar ($c$), David ($d$), Eva ($e$), Felix ($f$), Gustav ($g$), Hector ($h$).
- Validates `squareToIBCA()` coordinate conversions.
- Validates official IBCA Rank 1 to Rank 8 board scan ordering:
  - Fixed preamble: `"Board position, scanning rank 1 through rank 8."`
  - Strict ascending order: Rank 1 precedes Rank 2 ... precedes Rank 8.
  - Omission of unoccupied ranks.
  - Active check warnings: `"<Color> is in check!"`.

### Tier 3: Speech Robustness, Homophones & Tool Router
- Validates ASR phonetic homophone resolution:
  - `"night to f3"` $\rightarrow$ `Nf3`
  - `"see four"` $\rightarrow$ `c4`
  - `"before"` $\rightarrow$ `b4`
  - Numeric homophones: `"tree"` $\rightarrow$ `3`, `"fore"` $\rightarrow$ `4`, `"ate"` $\rightarrow$ `8`
- Validates ambiguity threshold: Confidence $< 0.6$ intercepts move and issues clarification prompt with candidate legal moves.
- Validates multi-candidate ambiguity gating (e.g. `"knight"` on move 1).
- Validates tool router dispatching: `apply_move`, `describe_board`, `get_legal_moves`, `get_hint`, `undo_move`, `resign_game`.

### Tier 4: Autonomous Engine AI & Latency Benchmarks
- Benchmark harness measures `performance.now()` delta for `engine.makeEngineMove()` across:
  1. Opening position (standard starting FEN)
  2. Tactical middlegame position (high branch factor FEN)
  3. Endgame position (pawn race FEN)
- Asserts strict execution latency $< 1500\text{ms}$ per `ORIGINAL_REQUEST.md` §R2.
- Validates distinct move selection characteristics across selectable difficulties:
  - **Beginner**: High entropy / non-deterministic move selection across trials.
  - **Intermediate**: 1-ply tactical heuristics (MVV-LVA captures + checks + PST).
  - **Advanced**: 2-ply minimax with alpha-beta pruning and PST scoring (deterministically finds mate in 1 and material wins).
  - **Master**: 3-ply minimax with alpha-beta search.

### Tier 5: Adversarial Stress & Error Recovery
- Tests illegal squares (e.g. `"z9"`, `"j4"`) and malformed strings.
- Asserts 100% board state preservation (FEN, turn, history, captured pieces invariant) upon illegal move attempts.
- Verifies rejection of moves attempted while King remains in check.
- Verifies rejection of moves attempted after game over.

---

## 4. Headless & CI/CD Verification Guarantees

1. **Zero External API Dependency**: The entire test suite executes in local memory without requiring a live `ASSEMBLYAI_API_KEY`.
2. **Deterministic & Isolated**: Each test constructs independent `ChessEngine` instances with isolated board states. Tests are completely order-independent.
3. **Execution Speed**: Full suite of 66 tests runs in approximately $1.5\text{s} - 2.5\text{s}$ in local and containerized environments.
4. **GitLab CI / GitHub Actions Compatibility**: Executable via standard `npm test` step without GUI or audio hardware dependencies.

