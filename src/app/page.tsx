"use client";

import { useState, useEffect } from "react";
import { useVoiceChessCoach } from "@/hooks/useVoiceChessCoach";
import { useA11ySettings } from "@/hooks/useA11ySettings";
import { useA11yFeedback } from "@/hooks/useA11yFeedback";
import { useHotkeys } from "@/hooks/useHotkeys";
import { ListenButton } from "@/components/voice/ListenButton";
import { CaptionBar } from "@/components/voice/CaptionBar";
import { TranscriptLog } from "@/components/voice/TranscriptLog";
import { TextFallbackForm } from "@/components/voice/TextFallbackForm";
import { ChessBoardPanel } from "@/components/board/ChessBoardPanel";
import { SettingsToolbar } from "@/components/a11y/SettingsToolbar";
import { ShortcutsModal } from "@/components/a11y/ShortcutsModal";
import { GameOverModal } from "@/components/a11y/GameOverModal";
import {
  playGameStartSound,
  playVictorySound,
  playDefeatSound,
  playDrawSound,
  resumeAudioContext,
} from "@/lib/sound-effects";

export default function Home() {
  const { settings, toggleHighContrast, toggleBoardVisible, toggleSoundCues, toggleAnnounceCaptions, cycleFontScale, setTheme } =
    useA11ySettings();

  const coach = useVoiceChessCoach({
    onBoardAction: (action) => {
      if (action === "show" && !settings.boardVisible) toggleBoardVisible();
      else if (action === "hide" && settings.boardVisible) toggleBoardVisible();
    },
    onSettingsAction: (setting) => {
      if (setting === "high_contrast") toggleHighContrast();
      else if (setting === "sound_cues") toggleSoundCues();
      else if (setting === "announce_captions") toggleAnnounceCaptions();
    },
  });

  // BUG 1 fix: track whether the game-over modal was dismissed for this game
  const [gameOverDismissed, setGameOverDismissed] = useState(false);
  // Reset dismissal when a new game starts (isGameOver goes false)
  useEffect(() => {
    if (!coach.isGameOver) setGameOverDismissed(false);
  }, [coach.isGameOver]);

  // Play game-start sound on first interaction (satisfies browser autoplay policy)
  useEffect(() => {
    const onFirstInteraction = () => {
      resumeAudioContext();
      playGameStartSound();
      window.removeEventListener("click", onFirstInteraction);
      window.removeEventListener("keydown", onFirstInteraction);
    };
    window.addEventListener("click", onFirstInteraction, { once: true });
    window.addEventListener("keydown", onFirstInteraction, { once: true });
    return () => {
      window.removeEventListener("click", onFirstInteraction);
      window.removeEventListener("keydown", onFirstInteraction);
    };
  }, []);

  // Play win/loss/draw sound when game ends (only once per game)
  const gameOverSoundPlayedRef = useState(false);
  useEffect(() => {
    if (!coach.isGameOver || gameOverDismissed) return;
    if (gameOverSoundPlayedRef[0]) return;
    gameOverSoundPlayedRef[1](true);
    const { isCheckmate, isDraw, isStalemate, turn } = coach.snapshot ?? {};
    if (isCheckmate) {
      // turn is whose turn it IS after the checkmate move — that's the loser
      // If turn === "w", White is to move but can't → Black (coach) won → player lost
      if (turn === "w") setTimeout(() => playDefeatSound(), 200);
      else setTimeout(() => playVictorySound(), 200);
    } else if (isDraw || isStalemate) {
      setTimeout(() => playDrawSound(), 200);
    }
  }, [coach.isGameOver, coach.snapshot, gameOverDismissed, gameOverSoundPlayedRef]);

  // Reset sound-played flag on new game
  useEffect(() => {
    if (!coach.isGameOver) gameOverSoundPlayedRef[1](false);
  }, [coach.isGameOver, gameOverSoundPlayedRef]);

  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [isHoldingJ, setIsHoldingJ] = useState(false);

  useA11yFeedback(coach.status, coach.caption, {
    soundCues: settings.soundCues,
    announceCaptions: settings.announceCaptions,
  });

  useHotkeys(
    {
      j: {
        onDown: () => {
          setIsHoldingJ(true);
          coach.startListening();
        },
        onUp: () => {
          setIsHoldingJ(false);
          coach.stopListening();
        },
      },
      escape: () => {
        setIsHoldingJ(false);
        coach.cancelListening();
      },
      r: () => coach.repeatLast(),
      d: () => coach.describeBoard("full"),
      t: () => coach.describeBoard("threats"),
      g: () => coach.describeBoard("tactical"),
      u: () => coach.undoMove(),
      b: () => toggleBoardVisible(),
      c: () => toggleHighContrast(),
      "?": () => setShortcutsOpen((v) => !v),
      "+": () => cycleFontScale(1),
      "=": () => cycleFontScale(1),
      "-": () => cycleFontScale(-1),
    },
    !shortcutsOpen,
  );

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to voice controls
      </a>

      <header className="border-b border-border px-6 py-4 backdrop-blur-md bg-bg/80 sticky top-0 z-30">
        <div className="mx-auto flex max-w-7xl flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight">Voice Chess Coach</h1>
              <p className="text-sm text-fg-muted">Hold J to speak your move.</p>
            </div>
            <button
              type="button"
              onClick={coach.resetGame}
              className="rounded-full border border-border bg-bg-raised px-4 py-1.5 text-xs font-semibold text-fg-muted hover:border-accent hover:text-accent transition-colors shadow-xs active:scale-95 cursor-pointer"
            >
              New Game
            </button>
          </div>
          {/* BUG 4/5 fix: pass difficulty, onSelectDifficulty, onSetTheme to toolbar */}
          <SettingsToolbar
            settings={settings}
            onToggleHighContrast={toggleHighContrast}
            onToggleSoundCues={toggleSoundCues}
            onToggleAnnounceCaptions={toggleAnnounceCaptions}
            onCycleFontScale={cycleFontScale}
            onOpenShortcuts={() => setShortcutsOpen(true)}
            difficulty={coach.difficulty}
            onSelectDifficulty={coach.setDifficulty}
            speechRate={coach.speechRate}
            onSpeechRateChange={coach.setSpeechRate}
            onSetTheme={setTheme}
          />
        </div>
      </header>

      {/*
        DOM order is deliberate: voice controls and the conversation come
        before the board in the document, regardless of how the grid lays
        them out visually, so a screen reader user reaches the thing they
        actually need first without tabbing past board controls to get there.
      */}
      <main id="main-content" className="mx-auto grid w-full max-w-7xl flex-1 items-start gap-5 sm:gap-8 px-3 sm:px-8 py-4 sm:py-8 lg:grid-cols-12">
        <div className="flex flex-col items-center gap-4 sm:gap-6 lg:col-span-5 w-full">
          {!coach.isVoiceSupported && (
            <p role="alert" className="panel w-full border-danger p-3 text-sm">
              Voice input isn&apos;t available in this browser. Use the text box below to play instead.
            </p>
          )}

          <ListenButton
            status={coach.status}
            isHolding={isHoldingJ}
            onPress={coach.pressTalk}
            onStartHold={() => {
              setIsHoldingJ(true);
              coach.startListening();
            }}
            onEndHold={() => {
              setIsHoldingJ(false);
              coach.stopListening();
            }}
            onCancel={coach.cancelListening}
            onRepeat={coach.repeatLast}
          />
          <CaptionBar
            caption={coach.caption}
            partialText={coach.partialText}
            status={coach.status}
            onRepeat={coach.repeatLast}
          />

          {/* Desktop view: text form and transcript in left column */}
          <div className="hidden lg:flex flex-col gap-6 w-full">
            <TextFallbackForm onSubmit={coach.submitTextFallback} emphasized={!coach.isVoiceSupported} />
            <TranscriptLog entries={coach.entries} />
          </div>
        </div>

        <div className="lg:col-span-7 flex flex-col items-center justify-start w-full">
          <ChessBoardPanel
            fen={coach.fen}
            moveHistory={coach.moveHistory}
            onManualMove={coach.attemptManualMove}
            visible={settings.boardVisible}
            onToggleVisible={toggleBoardVisible}
            isOpponentThinking={coach.status === "thinking"}
            isGameOver={coach.isGameOver}
            clock={coach.clock}
            difficulty={coach.difficulty}
            onSelectDifficulty={coach.setDifficulty}
          />

          {/* Mobile view: text form and transcript under the board */}
          <div className="flex lg:hidden flex-col gap-4 w-full mt-5">
            <TextFallbackForm onSubmit={coach.submitTextFallback} emphasized={!coach.isVoiceSupported} />
            <TranscriptLog entries={coach.entries} />
          </div>
        </div>
      </main>

      <footer className="border-t border-border px-6 py-6 text-center text-sm text-fg-muted">
        Press <span className="font-mono">?</span> any time for the full list of keyboard shortcuts.
      </footer>

      {/* BUG 1 fix: render GameOverModal when game ends */}
      {coach.isGameOver && !gameOverDismissed && (
        <GameOverModal
          isGameOver={coach.isGameOver}
          isCheckmate={coach.snapshot?.isCheckmate ?? false}
          isDraw={coach.snapshot?.isDraw ?? false}
          isStalemate={coach.snapshot?.isStalemate ?? false}
          turn={coach.turn}
          moveNumber={Math.floor(coach.moveHistory.length / 2) + 1}
          pgn={coach.snapshot?.pgn ?? ""}
          onNewGame={() => {
            setGameOverDismissed(false);
            coach.resetGame();
          }}
          onClose={() => setGameOverDismissed(true)}
        />
      )}

      {shortcutsOpen && <ShortcutsModal onClose={() => setShortcutsOpen(false)} />}
    </>
  );
}
