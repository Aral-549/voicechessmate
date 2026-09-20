# Progress Log

- Last visited: 2026-09-13T10:48:30Z
- Status: Milestone 2 implementation and verification complete.
- Accomplishments:
  - Fixed ESLint unused variable warnings in `src/app/api/token/route.ts` and `src/lib/tool-handlers.ts`. `npx eslint --max-warnings=0` passes with 0 warnings.
  - Resolved speech homophones: "before" -> "b4", "night" -> "knight", "see four" -> "c4", number words, and IBCA phonetic alphabet files in `normalizeIBCASpeech`.
  - Implemented pawn promotion scoring in `fuzzyMatchMove`: scores `move.promotion`, awards matching promotion piece, defaults to 'q'.
  - Added ambiguity tie detection in `fuzzyMatchMove` (confidence 0.5 when tied) and updated ambiguity threshold to `< 0.6` in `apply_move`.
  - Added `resign_game` tool to `CHESS_TOOLS` and router, plus verbal "I resign" detection in `apply_move`.
  - Added `set_difficulty` tool to `CHESS_TOOLS` and router, configurable opponent difficulty passed to `engine.makeEngineMove(activeDifficulty)`.
  - Handled invalid squares / empty moves with clarification prompts and strict board state preservation.
  - Expanded unit tests in `src/lib/__tests__/tool-handlers.test.ts` to 26 passing tests.
  - Verified: `npx eslint --max-warnings=0` (PASS), `npx tsc --noEmit` (PASS), `npx vitest run src/lib/__tests__/tool-handlers.test.ts` (PASS, 26/26).
