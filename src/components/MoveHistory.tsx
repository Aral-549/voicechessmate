// ============================================================
// VoiceChessmate — Move History Panel
// Displays moves in standard two-column chess notation
// ============================================================

'use client';

import { useEffect, useRef } from 'react';

interface MoveHistoryProps {
  pgn: string;
}

interface MovePair {
  number: number;
  white: string;
  black?: string;
}

function parsePGNMoves(pgn: string): MovePair[] {
  if (!pgn) return [];

  // Extract just the moves part (after any headers)
  const movesStr = pgn.replace(/\[.*?\]\s*/g, '').trim();
  if (!movesStr) return [];

  const tokens = movesStr.split(/\s+/);
  const pairs: MovePair[] = [];
  let current: Partial<MovePair> = {};

  for (const token of tokens) {
    // Skip result markers
    if (['1-0', '0-1', '1/2-1/2', '*'].includes(token)) continue;

    // Move number (e.g., "1.")
    const numMatch = token.match(/^(\d+)\./);
    if (numMatch) {
      current.number = parseInt(numMatch[1]);
      const move = token.replace(/^\d+\.\s*/, '');
      if (move) {
        current.white = move;
      }
      continue;
    }

    // It's a move
    if (current.number && !current.white) {
      current.white = token;
    } else if (current.number && current.white && !current.black) {
      current.black = token;
      pairs.push(current as MovePair);
      current = {};
    }
  }

  // Push incomplete pair
  if (current.number && current.white) {
    pairs.push(current as MovePair);
  }

  return pairs;
}

export function MoveHistory({ pgn }: MoveHistoryProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const moves = parsePGNMoves(pgn);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [pgn]);

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider px-4 py-3 border-b border-gray-700">
        📋 Move History
      </h2>
      <div className="flex-1 overflow-y-auto">
        {moves.length === 0 ? (
          <p className="text-gray-500 text-sm italic p-4">
            No moves yet. Say &quot;e4&quot; to begin!
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs">
                <th className="w-10 py-2 text-center">#</th>
                <th className="py-2 text-left pl-2">White</th>
                <th className="py-2 text-left pl-2">Black</th>
              </tr>
            </thead>
            <tbody>
              {moves.map((pair) => (
                <tr
                  key={pair.number}
                  className="border-t border-gray-800 hover:bg-gray-800/50"
                >
                  <td className="py-1.5 text-center text-gray-500 font-mono">
                    {pair.number}.
                  </td>
                  <td className="py-1.5 pl-2 font-mono text-white">
                    {pair.white}
                  </td>
                  <td className="py-1.5 pl-2 font-mono text-gray-300">
                    {pair.black || ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
