# ♔ VoiceChessmate — Accessible Chess Through Conversation

> A conversational chess companion for blind and visually impaired players, built on [AssemblyAI's Voice Agent API](https://www.assemblyai.com/docs/voice-agents/voice-agent-api).

## The Problem

There are over **2.2 billion** visually impaired people worldwide. Chess is the world's most popular strategy game, yet existing accessible chess tools are **command-response interfaces** — say a command, get a result. They're a CLI with speech, not a chess partner.

## The Solution

VoiceChessmate is a **conversational voice agent** that lets blind and visually impaired players:

- 🗣️ **Speak naturally with the official FIDE/IBCA Standard** — Files are mapped to the 1985 tournament standard (`Anna`, `Bella`, `Cesar`, `David`, `Eva`, `Felix`, `Gustav`, `Hector`), eliminating rhyming ambiguity (`B`, `C`, `D`, `E`) over microphones and telephone lines.
- ⚡ **Move-by-move mental models** — In official blind chess, only move deltas are announced ("White pawn to Eva 4. Black knight to Felix 6."). The player builds their mental board incrementally.
- 📋 **Systematic Rank 1–8 board scans** — When full reorientation is requested, positions are announced in a fixed, invariant scan order (Rank 1 to 8, occupied squares only).
- 🧠 **Get coaching on demand** — "What should I do?" "What are my threats?"
- 🔄 **Think aloud** — The agent distinguishes thinking ("hmm, maybe knight f3...") from committed moves.

## How It Uses AssemblyAI

Every AssemblyAI Voice Agent API differentiator does **visible, necessary work**:

| Feature | Chess Application |
|---|---|
| **Turn Detection** | Distinguishes thinking aloud from committed moves via tonality and pacing |
| **Interruption Handling** | Player can cut into a board narration: "Wait, where's my rook?" |
| **Tool Calling** | Chess engine (move validation, board state, legal moves, engine suggestions) |
| **Keyterms** | Biases STT toward chess notation ("knight" vs "night", "e4" vs "before") |
| **Low Latency** | Conversational chess, not command-response — feels like a chess partner |

## Getting Started

### Prerequisites
- Node.js 18+
- An [AssemblyAI API key](https://www.assemblyai.com/dashboard/signup?utm_source=event&utm_medium=credit-grant&utm_campaign=lablab_virtual_hackathon)

### Installation

```bash
git clone https://github.com/YOUR_USERNAME/voicechessmate.git
cd voicechessmate
npm install
```

### Configuration

```bash
cp .env.local.example .env.local
# Edit .env.local and add your AssemblyAI API key
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and click **Start Game**.

## Architecture

```
Browser (Mic + Speaker)
    ↕ WebSocket
AssemblyAI Voice Agent API
    ├── STT (Universal-3.5 Pro) with chess keyterms
    ├── Turn Detection + VAD (thinking vs. committed moves)
    ├── LLM (conversational chess companion persona)
    ├── TTS (voice output)
    └── Tool Calls ↔ Chess Engine (chess.js)
                       ├── validate_and_play_move
                       ├── get_board_state (spatial descriptions)
                       ├── get_legal_moves
                       ├── get_engine_suggestion
                       └── undo_last_move
```

## Tech Stack

| Layer | Technology |
|---|---|
| Voice Pipeline | AssemblyAI Voice Agent API |
| Frontend | Next.js 14 + Tailwind CSS |
| Chess Logic | chess.js |
| Audio Capture | Web Audio API + AudioWorklet |
| Deployment | Vercel |

## Market Opportunity

- **IBCA** (International Braille Chess Association) spans **75+ nations**
- India alone has **2,800+ registered blind chess players** (AICFB)
- **250M+ visually impaired people** in India, **2.2B worldwide**
- B2B path: national chess federations, Lichess/Chess.com accessibility, rehabilitation centers

## License

MIT — see [LICENSE](./LICENSE)

---

Built for the [AssemblyAI Voice Agent Hackathon 2026](https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon)
