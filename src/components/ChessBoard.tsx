// ============================================================
// VoiceChessmate — Visual Chess Board (for sighted spectators)
// The player doesn't need this — but the judge watching the demo does.
// ============================================================

'use client';

import { useMemo } from 'react';
import type { Move } from '@/types';

interface ChessBoardProps {
  fen: string;
  lastMove: Move | null;
  flipped?: boolean;
}

const PIECE_UNICODE: Record<string, string> = {
  wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙',
  bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟',
};

function parseFEN(fen: string): (string | null)[][] {
  const rows = fen.split(' ')[0].split('/');
  return rows.map(row => {
    const squares: (string | null)[] = [];
    for (const ch of row) {
      if (/\d/.test(ch)) {
        for (let i = 0; i < parseInt(ch); i++) squares.push(null);
      } else {
        const color = ch === ch.toUpperCase() ? 'w' : 'b';
        squares.push(color + ch.toLowerCase());
      }
    }
    return squares;
  });
}

const IBCA_LABELS: Record<string, string> = {
  a: 'Anna', b: 'Bella', c: 'Cesar', d: 'David', e: 'Eva', f: 'Felix', g: 'Gustav', h: 'Hector',
};

export function ChessBoard({ fen, lastMove, flipped = false }: ChessBoardProps) {
  const board = useMemo(() => parseFEN(fen), [fen]);

  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

  const displayRanks = flipped ? [...ranks].reverse() : ranks;
  const displayFiles = flipped ? [...files].reverse() : files;

  const isHighlighted = (rank: number, file: number) => {
    if (!lastMove) return false;
    const square = files[file] + ranks[rank];
    return square === lastMove.from || square === lastMove.to;
  };

  return (
    <div className="inline-block">
      {/* File labels (top) with IBCA phonetic names */}
      <div className="flex ml-8 mb-1">
        {displayFiles.map(f => (
          <div key={f} className="w-14 flex flex-col items-center justify-center font-mono">
            <span className="text-xs text-amber-400 font-bold uppercase">{f}</span>
            <span className="text-[9px] text-gray-400 leading-none">{IBCA_LABELS[f]}</span>
          </div>
        ))}
      </div>

      <div className="flex">
        {/* Rank labels (left) */}
        <div className="flex flex-col">
          {displayRanks.map(r => (
            <div key={r} className="w-8 h-14 flex items-center justify-center text-xs text-gray-400 font-mono">
              {r}
            </div>
          ))}
        </div>

        {/* Board */}
        <div className="grid grid-cols-8 border-2 border-gray-700 rounded-lg overflow-hidden shadow-2xl">
          {displayRanks.map((_, rankDisplayIdx) => {
            const rankIdx = flipped ? 7 - rankDisplayIdx : rankDisplayIdx;
            return displayFiles.map((_, fileDisplayIdx) => {
              const fileIdx = flipped ? 7 - fileDisplayIdx : fileDisplayIdx;
              const piece = board[rankIdx]?.[fileIdx];
              const isLight = (rankIdx + fileIdx) % 2 === 0;
              const highlighted = isHighlighted(rankIdx, fileIdx);

              return (
                <div
                  key={`${rankIdx}-${fileIdx}`}
                  className={`w-14 h-14 flex items-center justify-center text-4xl transition-colors duration-300 ${
                    highlighted
                      ? 'bg-yellow-400/50'
                      : isLight
                        ? 'bg-amber-100'
                        : 'bg-amber-800'
                  }`}
                >
                  {piece && (
                    <span className={`drop-shadow-md select-none ${
                      piece.startsWith('b') ? 'text-gray-900' : 'text-white'
                    }`} style={{ textShadow: piece.startsWith('w') ? '1px 1px 2px rgba(0,0,0,0.5)' : 'none' }}>
                      {PIECE_UNICODE[piece] || ''}
                    </span>
                  )}
                </div>
              );
            });
          })}
        </div>
      </div>
    </div>
  );
}
