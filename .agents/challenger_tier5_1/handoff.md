# Handoff Report: Tier 5 Adversarial Probing of Chess Engine & Rules

**Agent**: `challenger_tier5_1` (critic, specialist)  
**Date**: 2026-09-13  
**Status**: Hard Complete  

---

## 1. Observation

1. **Test Execution**:
   - Ran `npx vitest run src/lib/__tests__/tier5-adversarial-chess-engine.test.ts`:
     ```
     ✓ src/lib/__tests__/tier5-adversarial-chess-engine.test.ts (55 tests) 5234ms
     Test Files  1 passed (1)
          Tests  55 passed (55)
     ```
   - Ran full test suite `npm test`:
     ```
     Test Files  6 passed (6)
          Tests  221 passed (221)
       Duration  6.06s
     ```
   - Ran `npm run lint`:
     ```
     > voicechessmate@0.1.0 lint
     > eslint
     (exited with code 0, 0 errors, 0 warnings)
     ```
   - Ran `npx tsc --noEmit`:
     ```
     (exited with code 0, zero TypeScript errors)
     ```
   - Ran `npm run build`:
     ```
     ✓ Compiled successfully in 241ms
     Finished TypeScript in 1109ms
     Collecting page data using 6 workers in 355ms
     ✓ Generating static pages using 6 workers (5/5) in 311ms
     Finalizing page optimization in 7ms
     ```

2. **Castling Implementation**:
   - `src/lib/chess-engine.ts:305-345` executes SAN castling (`'O-O'`, `'O-O-O'`).
   - `src/lib/tool-handlers.ts:246-254` parses voice strings (`"castle kingside"`, `"castle queenside"`), resolves with confidence 1.0, and executes castling.
   - Tested castling restrictions: blocked intermediate squares (`res.success === false`), King in check (`res.success === false`), King crossing attacked square f1 (`res.success === false`), King crossing attacked square d1 (`res.success === false`), Queen crossing non-checked b1 (`res.success === true`), King moved Ke1-e2-e1 (`res.success === false`), Rook moved Rh1-h2-h1 (`O-O` fails, `O-O-O` succeeds). All 10 castling test cases passed cleanly.

3. **Pawn Promotion & Underpromotions**:
   - Queen promotion: `e8=Q+` promoted to Queen with narration `"Promoted to queen."` (`src/lib/chess-engine.ts:387`).
   - Underpromotion to Knight: FEN `B7/k1P5/2K5/8/8/8/8/8 w - - 0 1` -> `c8=Q` produces `isStalemate: true`, while underpromotion `c8=N+` avoids stalemate and delivers check.
   - Underpromotion to Knight royal fork: FEN `8/2P1k3/3q4/8/8/8/8/K7 w - - 0 1` -> `c8=N+` checks Ke7 and forks Qd6, followed by `Nxd6` capturing Queen.
   - Underpromotion to Rook: FEN `8/2P5/1r6/8/8/8/p7/k1K5 w - - 0 1` (Saavedra) -> `c8=R` avoids `Rc6+` stalemate trick.
   - Underpromotion to Bishop: `c8=B` promoted to Bishop with narration `"Promoted to bishop."`

4. **En Passant Captures**:
   - En passant capture `exd6` on move 4 executes with `'e'` flag, removes captured pawn from `d5` (`fen` does not contain `3pP3`), and populates `capturedPieces.white` with `['p']`.
   - Delayed en passant on move 5 after intermediate moves is rejected (`success: false`).

5. **Resignation Freezing**:
   - `engine.resign('w')` sets `isGameOver: true`, `legalMoves: []`, `narration: "White resigns. Black wins by resignation."`.
   - Subsequent calls to `makeMove('e4')`, `makeEngineMove()`, and duplicate `resign()` are rejected with `success: false`.

6. **Board Scan Ordering**:
   - `describeBoardState('scan')` verified on full starting position and custom 8-rank position (`4k3/p7/5n2/3p4/4P3/2N5/P7/4K3 w - - 0 1`).
   - Position of `Rank 1:` < `Rank 2:` < ... < `Rank 8:` verified strictly ascending.
   - Piece order within Rank 1 verified strictly ascending from File Anna (a) through Hector (h).

7. **Engine Difficulty & Latency**:
   - Tested 20 trials of `beginner` move generation on `r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3`: produced 4 distinct moves (entropy verified).
   - Tested `intermediate` and `advanced`: produced exactly 1 deterministic move each.
   - Tested hanging queen capture vs 2-ply trap: Intermediate plays greedy `exd5`; Advanced searches 2-ply and avoids `Qxd5` blunder.
   - Benchmarked across 6 positions (opening, middlegame, endgame) and 4 difficulty tiers (24 benchmark tests): Maximum measured latency was 1139ms (`master` on French Defense Opening), all well under the 1500ms ceiling.

8. **State Preservation**:
   - 11-ply multi-capture sequence (`exd5`, `Qxd5`, `Bxe2`, `Ngxe2`) undone ply-by-ply in reverse. At every single ply, FEN, capturedPieces for both colors, and active turn matched the forward snapshot exactly. Final undo returned to starting FEN with empty capture arrays.
   - 10 invalid move inputs rejected with 100% preservation of FEN, turn, moveNumber, capturedPieces, isCheck, isGameOver, and legalMoves.

---

## 2. Logic Chain

1. **Step 1 (FIDE & IBCA Rules Verification)**: Based on Observation 2, 3, 4, 5, and 6, the engine strictly enforces FIDE movement, castling, underpromotion, en passant timing, and resignation invariants. IBCA board scans strictly follow rank 1 through rank 8 order.
2. **Step 2 (Engine Performance & Differentiation)**: Based on Observation 7, the engine's 3 selectable difficulty levels (plus master) exhibit distinct algorithmic characteristics (random move selection vs 1-ply greedy PST vs 2-ply alpha-beta minimax). Computation latency across opening, middlegame, and endgame positions is strictly under 1500ms (max 1139ms).
3. **Step 3 (Reversibility & State Preservation)**: Based on Observation 8, state mutations are fully reversible via `undoMove()` across multi-capture sequences, and invalid move rejections are completely side-effect-free.
4. **Step 4 (Build & Test Quality)**: Based on Observation 1, the codebase passes 221 unit and integration tests, compiles cleanly with zero TypeScript errors, has zero ESLint warnings, and builds successfully.

---

## 3. Caveats

- Live microphone hardware and remote AssemblyAI WebSocket streaming were not tested directly in this probe suite; they are headless-mocked and tested by `challenger_tier5_2` in `mock-harness.test.ts`.

---

## 4. Conclusion

The Chess Engine and Rules implementation passes all Tier 5 adversarial stress probes without defects. FIDE and IBCA standards, underpromotions, en passant rules, resignation freezing, board scan ordering, difficulty divergence, latency constraints (< 1500ms), and state preservation are fully verified and robust.

---

## 5. Verification Method

To independently verify all findings:

```bash
# 1. Run the Tier 5 Adversarial Chess Engine Probe Suite
npx vitest run src/lib/__tests__/tier5-adversarial-chess-engine.test.ts

# 2. Run the complete test suite (221 tests across 6 files)
npm test

# 3. Verify zero ESLint warnings
npm run lint

# 4. Verify TypeScript compilation
npx tsc --noEmit

# 5. Verify Next.js production build
npm run build
```

**Invalidation Conditions**:
- Any of the 55 adversarial tests in `src/lib/__tests__/tier5-adversarial-chess-engine.test.ts` failing.
- Engine latency exceeding 1500ms on any test position.
- State mutation detected after an illegal move attempt.

