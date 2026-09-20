# VoiceChessmate ♟️

> **Play chess entirely through your voice — no screen, no mouse, no problem.**

A conversational chess companion powered by [AssemblyAI's Voice Agent API](https://www.assemblyai.com/). Speak your moves naturally, hear the coach respond, and play a full game of chess without ever touching your keyboard — or looking at the screen.

---

## What it does

You hold **J**, say *"knight to f3"*, and the coach plays, responds, and explains — all in real time. That's it.

Under the hood, your speech hits AssemblyAI's live voice agent, which understands chess context, validates the move against the actual ruleset, plays the best bot reply, and speaks back — with a streaming caption so you can follow along even if audio isn't available.

It's built for anyone who wants a hands-free chess experience, with accessibility as a first-class feature (not an afterthought).

---

## Key features

- 🎙️ **Push-to-talk voice control** — hold J to speak, release to send
- ♟️ **Real chess engine** — legal move validation, en passant, castling, promotion, all of it
- 🤖 **AI chess coach** — 4 difficulty levels (Beginner → Master)
- ⏱️ **Chess clock** — Bullet (1m), Blitz (3m, 5m), Rapid (10m), or casual/untimed
- 📝 **Live captions** — streaming transcript of what the coach says
- 🖱️ **Click/drag board** — visual board as a fallback for sighted players
- ♿ **Accessible by design** — high contrast, font scaling, screen reader support, keyboard shortcuts

---

## Hotkeys

| Key | Action |
|-----|--------|
| `J` (hold) | Speak your move or question |
| `Esc` | Cancel mic |
| `R` | Repeat last coach message |
| `D` | Describe the full board |
| `T` | Hear current threats |
| `G` | Get a tactical summary |
| `U` | Undo last move |
| `B` | Show / hide visual board |
| `?` | Open keyboard shortcuts reference |

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript (strict) |
| Voice | AssemblyAI Voice Agent API (WebSocket, PCM16) |
| Chess | chess.js (move validation & game state) |
| Audio | Web Audio API — dual AudioContext (speaker + mic) |
| Styling | Tailwind CSS |
| Tests | Vitest — 337 tests, all passing |

---

## How it works (briefly)

The voice pipeline has two separate `AudioContext` instances:
- **Speaker context** at the hardware's native sample rate (48kHz) — this prevents Linux/PulseAudio from silently muting playback
- **Capture context** at 24kHz — this is what AssemblyAI's API expects for speech recognition

Audio from your mic flows into an `AudioWorklet` (25ms chunks), gets base64-encoded, and streams to AssemblyAI over a WebSocket. The agent's PCM16 audio reply streams back and gets scheduled via `AudioBufferSourceNode` for gapless playback.

---

## Running locally

**You'll need Node.js 18+ and an AssemblyAI API key.**

```bash
git clone https://gitlab.com/Aral-5491/voicechessmate.git
cd voicechessmate
npm install
```

Create a `.env.local` file:
```
ASSEMBLYAI_API_KEY=your_key_here
```

Get a free API key at [assemblyai.com](https://www.assemblyai.com/) — the free tier covers plenty of testing.

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in **Chrome or Edge** (required for `AudioWorklet` and mic access).

---

## Tests

```bash
npm test
```

337 tests across 14 files — chess engine logic, move validation, voice pipeline, adversarial stress tests, blitz mode, and more.

---

## Deploying

This is a standard Next.js app. Deploy to [Vercel](https://vercel.com) in one click — just add `ASSEMBLYAI_API_KEY` as an environment variable. The `/api/token` route mints short-lived tokens server-side so your API key is never exposed to the browser.

---

## Built by

Made with a lot of trial and error, a broken audio pipeline, three refactors, and one late-night dual-AudioContext breakthrough.

— Team **Aral-5491** for Hackdevengers 2.0

---

*MIT License*
