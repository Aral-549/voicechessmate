# VoiceChessmate

> **Play chess entirely through your voice — no screen, no mouse, no barriers.**

**Live Demo:** [https://voicechessmate.vercel.app/](https://voicechessmate.vercel.app/)

A conversational chess companion powered by [AssemblyAI's Voice Agent API](https://www.assemblyai.com/). Speak your moves naturally, hear the coach respond, and play a full game of chess without ever touching your keyboard or looking at a screen.

---

## What it does

You hold **J**, say *"knight to f3"*, and the coach plays, responds, and explains — all in real time.

Under the hood, speech streams to AssemblyAI's live voice agent, which understands chess context, validates the move against official rules, computes the engine reply, and speaks back with a streaming caption.

Built for anyone seeking a hands-free chess experience, with accessibility as a core architectural requirement.

---

## Key features

- **Push-to-talk voice control** — hold J to speak, release to send
- **Deterministic chess engine** — full legal move validation, en passant, castling, promotion
- **Conversational AI coach** — 4 difficulty levels (Beginner to Master) with tactical explanations
- **Integrated chess clock** — Bullet (1m), Blitz (3m, 5m), Rapid (10m), or casual/untimed
- **Streaming live captions** — visual transcript synchronized with spoken audio
- **Interactive visual board** — fallback interface with drag-and-drop support
- **Engineered for accessibility** — FIDE/IBCA phonetic notation, spatial stereo earcons, high contrast, font scaling, screen reader ARIA support, and full keyboard navigation

---

## Hotkeys

| Key | Action |
|-----|--------|
| `J` (hold) | Speak your move or question |
| `Esc` | Cancel voice input |
| `R` | Repeat last coach message |
| `D` | Describe full board state |
| `T` | Hear active threats |
| `G` | Tactical summary |
| `U` | Undo last move |
| `B` | Show / hide visual board |
| `?` | Keyboard shortcuts reference |

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript (strict mode) |
| Voice Agent | AssemblyAI Voice Agent API (WebSocket, PCM16) |
| Chess Rules | chess.js (move validation and FIDE compliance) |
| Audio Engine | Web Audio API — dual AudioContext (48kHz playback + 24kHz capture) |
| Styling | Tailwind CSS |
| Test Suite | Vitest — 335 tests across 14 test suites (100% passing) |

---

## Audio architecture

The voice pipeline utilizes two dedicated `AudioContext` instances to ensure cross-platform stability:
- **Speaker context** at native hardware sample rate (48kHz) — eliminates Linux PulseAudio/PipeWire silent muting issues.
- **Capture context** at 24kHz — matches AssemblyAI's PCM16 speech recognition specification.

Microphone audio flows into an `AudioWorklet` processor (25ms buffers), converts to PCM16, and streams over a secure WebSocket. The voice agent executes typed tool definitions (`apply_move`, `describe_board`, `get_legal_moves`) directly against the chess engine and streams synthesized audio replies back for immediate gapless playback.

---

## Presentation

- **[HACKDAY 1.0 Pitch Deck (7-Slide PPTX)](./VoiceChessmate_HACKDAY_1.0.pptx)** — Official 7-slide format (Problem, Solution, Target Users, Technical Approach, Market & Business Potential, Scalability & Future, If We Had More Time).
- **[Interactive Web Deck](./public/hackday-presentation.html)**

---

## Running locally

**Prerequisites:** Node.js 18+ and an AssemblyAI API key.

```bash
git clone https://github.com/Aral-549/voicechessmate.git
cd voicechessmate
npm install
```

Create a `.env.local` file:
```
ASSEMBLYAI_API_KEY=your_key_here
```

Start the application:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in Chrome or Edge (recommended for AudioWorklet and microphone access).

---

## Test suite

```bash
npm test
```

Executes 335 tests across 14 test files covering chess engine mechanics, move notation parsing, voice protocol handling, adversarial stress tests, blitz timers, and edge-case validations.

---

## Deployment

- **Live Production URL:** [https://voicechessmate.vercel.app/](https://voicechessmate.vercel.app/)
- **Hosting Platform:** Deployed on Vercel with automatic CI/CD. The `/api/token` endpoint issues ephemeral tokens server-side to prevent client-side AssemblyAI credential exposure. Tested across Chrome and Edge on desktop and mobile.

---

## License

MIT License
