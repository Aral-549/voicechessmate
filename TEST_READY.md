# VoiceChessmate — Test Suite Readiness & Baseline Verification Report

> **Document Version:** 1.0.0  
> **Author:** `test_writer_e2e_1` (E2E Test Writer)  
> **Date:** 2026-09-13  
> **Test Harness:** Vitest 5.0  
> **Target System:** `/home/h3r0-k1ll3r/Downloads/assemblyai/voicechessmate`  
> **Execution Command:** `npm test`  

---

## 1. Executive Test Suite Summary

The comprehensive End-to-End (E2E) requirements test suite has been designed, authored, and verified in `src/lib/__tests__/e2e-requirements.test.ts`. Combined with the existing unit test suites, the codebase now contains **66 automated tests** (exceeding the target of 30+ E2E tests and 45+ total tests).

| Test Suite File | Test Count | Passed | Failed | Status |
|---|---|---|---|---|
| `src/lib/__tests__/e2e-requirements.test.ts` | 48 | 41 | 7 | ✅ Active E2E Suite (7 pending M2 defects) |
| `src/lib/__tests__/chess-engine.test.ts` | 9 | 9 | 0 | ✅ 100% Passing |
| `src/lib/__tests__/tool-handlers.test.ts` | 9 | 9 | 0 | ✅ 100% Passing |
| **Total Across All Suites** | **66** | **59** | **7** | **89.4% Baseline Pass Rate** |

---

## 2. Requirement Coverage Matrix (13 Categories)

All 13 requirement categories specified in `ORIGINAL_REQUEST.md` and `PROJECT.md` are comprehensively exercised:

| # | Requirement Category | Test Scope | Tests | Pass / Fail | Primary Invariants Verified |
|---|---|---|---|---|---|
| 1 | **IBCA Phonetic Notation** | "Eva 4", "Felix 3", "Cesar 4", "Anna 4", Bella/David/Gustav/Hector | 6 | 6 / 0 (100%) | Files $a-h$ normalized to SAN; IBCA narration returned. |
| 2 | **Standard Algebraic Notation (SAN)** | Pawn push, piece moves, captures, check & checkmate | 4 | 4 / 0 (100%) | `e4`, `Nf3`, `Bc4`, `exd5`, `Qxf7#` checkmate detection. |
| 3 | **Castling (Voice & SAN)** | "castle kingside", "castle queenside", O-O, O-O-O, obstruction | 4 | 4 / 0 (100%) | King/Rook relocated to g1/f1 and c1/d1; illegal castling blocked. |
| 4 | **Pawn Promotion** | SAN e8=Q/R/B/N; voice promotion to Queen, Rook | 4 | 2 / 2 (50%) | SAN promotions pass; voice promotions fail due to M2 Bug #1. |
| 5 | **En Passant Captures** | SAN "exd6", spoken "Eva takes David 6", captured pieces | 3 | 3 / 0 (100%) | Diagonal pawn capture removes passed pawn and tracks captured piece. |
| 6 | **Resignation Handling** | Voice "I resign", resign tool call, `engine.resign('w')` | 3 | 1 / 2 (33%) | `engine.resign` passes (M1); voice & tool call fail due to M2 Bug #2. |
| 7 | **Speech Homophones & ASR** | "night" -> knight, "see four" -> c4, "before" -> b4, number words | 4 | 3 / 1 (75%) | "night" and "see four" pass; "before" -> b4 fails due to M2 Bug #3. |
| 8 | **Ambiguity Gating (< 0.6)** | Nonsensical input, confidence < 0.6, multi-candidate moves | 3 | 2 / 1 (67%) | Low confidence asks clarification; multi-candidate fails due to M2 Bug #4. |
| 9 | **Board Scan Invariant** | Preamble, strict Rank 1–8 ascending order, empty ranks, check alert | 4 | 4 / 0 (100%) | Full compliance with IBCA Rank 1 to 8 ascending layout. |
| 10 | **Opponent Engine Latency** | Opening (<1500ms), Middlegame (<1500ms), Endgame (<1500ms) | 3 | 3 / 0 (100%) | All phases complete in $< 600\text{ms}$ (well within 1500ms). |
| 11 | **Difficulty Levels (3 modes)** | Beginner (random), Intermediate (1-ply PST), Advanced (2-ply minimax) | 3 | 3 / 0 (100%) | Mate-in-1 found deterministically; distinct variance on hanging Queen. |
| 12 | **Undo & Capture History** | Turn restoration, FEN restoration, captured pieces ledger cleanup | 3 | 3 / 0 (100%) | Board position & captured pieces ledger cleanly restored. |
| 13 | **Invalid Move Rejection** | Illegal pawn move, illegal coordinates ("z9"), king in check, post-game | 4 | 3 / 1 (75%) | Moves rejected with narration; "z9" fails due to M2 Bug #5. |

---

## 3. Escalated Implementation Defects (Assigned to Milestone M2)

The 7 failing tests in `src/lib/__tests__/e2e-requirements.test.ts` pinpoint exact, isolated defects in `src/lib/tool-handlers.ts`. These are escalated to Milestone M2 (Speech Robustness & Tools Worker):

### Defect 1: Pawn Promotion Voice Piece Scoring (Tests 4.3 & 4.4)
- **Failing Tests:**
  - `4.3 Voice pawn promotion to Queen ("Eva 8 Queen" / "promote to queen")`
  - `4.4 Voice pawn promotion to Rook selects requested piece rather than defaulting`
- **Location:** `src/lib/tool-handlers.ts:210-252` (`fuzzyMatchMove`)
- **Observed Behavior:** `fuzzyMatchMove` does not inspect `move.promotion`. All 4 legal promotion moves (`e8=Q`, `e8=R`, `e8=B`, `e8=N`) receive identical scores. Because `chess.js` yields knight promotions first, the fuzzy matcher always defaults to `e8=N` even when the user says "queen" or "rook".
- **Required Fix:** Inspect normalized speech for promotion keywords (`queen`, `rook`, `bishop`, `knight`, `q`, `r`, `b`, `n`), and grant $+12$ points to moves where `move.promotion` matches the spoken target.

### Defect 2: Resignation Handling in Voice Tools (Tests 6.1 & 6.2)
- **Failing Tests:**
  - `6.1 Spoken "I resign" via apply_move triggers game resignation and ends game`
  - `6.2 Dedicated resign tool call handles verbal surrender`
- **Location:** `src/lib/tool-handlers.ts:265-355` (`handleToolCall` and `CHESS_TOOLS`)
- **Observed Behavior:** Saying "I resign" fails move scoring, returning: `"I'm not sure which move you mean by \"I resign\"."` There is no `resign_game` tool in `CHESS_TOOLS` or `handleToolCall`.
- **Required Fix:** Add `resign_game` tool to `CHESS_TOOLS` and `handleToolCall`. Intercept resignation phrases ("i resign", "resign", "concede", "surrender") in `apply_move` and route to `engine.resign()`.

### Defect 3: Homophone "before" -> "b4" (Test 7.3)
- **Failing Test:**
  - `7.3 Homophone "before" -> "b4" parses to b4 pawn move`
- **Location:** `src/lib/tool-handlers.ts:138-172` (`normalizeIBCASpeech`)
- **Observed Behavior:** Spoken input `"before"` receives score 0 for legal move `b4` and returns clarification request with confidence 0.2.
- **Required Fix:** In `normalizeIBCASpeech`, add explicit replacement: `s = s.replace(/\bbefore\b/g, 'b4');`.

### Defect 4: Ambiguity Gating on Multi-Candidate Moves (Test 8.3)
- **Failing Test:**
  - `8.3 Multi-candidate ambiguity (e.g. "knight" on move 1) triggers clarification request`
- **Location:** `src/lib/tool-handlers.ts:278` (`fuzzyMatchMove` and confidence threshold)
- **Observed Behavior:** On move 1, four knight moves are legal ($Na3, Nc3, Nf3, Nh3$). Saying just `"knight"` awards $+8$ to all 4 moves, computes confidence $0.6$, and arbitrarily plays $Na3$ without asking for clarification.
- **Required Fix:** Detect when multiple candidate moves share the highest score, and lower confidence to $< 0.6$ to trigger the clarification prompt: `"Both knights can move. Which knight: Bella 1 or Felix 3?"`

### Defect 5: Non-Existent Square Rejection (Test 13.2)
- **Failing Test:**
  - `13.2 Non-existent / invalid coordinates (e.g. "z9", "j4") rejected without state mutation`
- **Location:** `src/lib/tool-handlers.ts:210-252` (`fuzzyMatchMove`)
- **Observed Behavior:** Saying `"pawn to z9"` awards $+8$ for the word `"pawn"` to all legal pawn moves. It assigns confidence $0.6$ and plays `a3` instead of rejecting the invalid square `"z9"`.
- **Required Fix:** When destination coordinates in speech are completely invalid / out-of-bounds, penalize candidate moves or ensure destination match is mandatory before granting high confidence.

---

## 4. Verification Instructions

To execute the test suite and verify test results:

```bash
# 1. Run all test suites
npm test

# 2. Run specifically the E2E requirements suite
npx vitest run src/lib/__tests__/e2e-requirements.test.ts

# 3. Check TypeScript compilation
npx tsc --noEmit
```

