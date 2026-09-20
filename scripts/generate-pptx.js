const pptxgen = require("pptxgenjs");
const path = require("path");
const fs = require("fs");

// Helper to convert raw SVG to Base64 data URI
function svgUri(svgString) {
  return "image/svg+xml;base64," + Buffer.from(svgString).toString("base64");
}

// Crisp modern monochrome / themed SVG icons (ZERO EMOJIS)
const icons = {
  chessKnight: (color = "#3ECF8E") => svgUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="m19 21-3-4-2-4 2-5-2-2-4 1-2 3-2 1v5l3 3 2 2h8z"/>
      <path d="M12 9h.01"/>
    </svg>
  `),
  mic: (color = "#3ECF8E") => svgUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" x2="12" y1="19" y2="22"/>
    </svg>
  `),
  eyeOff: (color = "#F05060") => svgUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
      <line x1="2" x2="22" y1="2" y2="22"/>
    </svg>
  `),
  clock: (color = "#F0C040") => svgUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  `),
  cpu: (color = "#5BA3F5") => svgUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2"/>
      <rect x="9" y="9" width="6" height="6"/>
      <path d="M15 2v2"/><path d="M9 2v2"/><path d="M20 15h2"/><path d="M20 9h2"/>
      <path d="M9 20v2"/><path d="M15 20v2"/><path d="M2 9h2"/><path d="M2 15h2"/>
    </svg>
  `),
  accessibility: (color = "#3ECF8E") => svgUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="16" cy="4" r="1"/>
      <path d="m18 19 1-7-6 1"/>
      <path d="m5 8 3-3 5.5 3-2.36 3.5"/>
      <path d="M4.24 14.5a5 5 0 0 0 6.88 6"/>
      <path d="M13.76 17.5a5 5 0 0 0-4-7.5"/>
    </svg>
  `),
  users: (color = "#5BA3F5") => svgUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  `),
  trendingUp: (color = "#F0C040") => svgUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
      <polyline points="16 7 22 7 22 13"/>
    </svg>
  `),
  shieldCheck: (color = "#3ECF8E") => svgUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  `),
  rocket: (color = "#3ECF8E") => svgUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
    </svg>
  `),
  volume: (color = "#3ECF8E") => svgUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
    </svg>
  `),
  layers: (color = "#F0C040") => svgUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2"/>
      <polyline points="2 17 12 22 22 17"/>
      <polyline points="2 12 12 17 22 12"/>
    </svg>
  `),
  terminal: (color = "#5BA3F5") => svgUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="4 17 10 11 4 5"/>
      <line x1="12" x2="20" y1="19" y2="19"/>
    </svg>
  `)
};

// Slide Header helper (strict boundary within 13.333 x 7.5)
function addSlideHeader(slide, category, title, accentColor = "3ECF8E") {
  // Category Pill
  slide.addShape("roundRect", {
    x: 0.8,
    y: 0.45,
    w: 2.2,
    h: 0.32,
    fill: { color: "112218" },
    line: { color: accentColor, width: 1 },
    rectRadius: 0.15
  });
  slide.addText(category.toUpperCase(), {
    x: 0.8,
    y: 0.45,
    w: 2.2,
    h: 0.32,
    fontFace: "Arial",
    fontSize: 9,
    bold: true,
    color: accentColor,
    align: "center",
    valign: "middle"
  });

  // Main Title
  slide.addText(title, {
    x: 0.8,
    y: 0.85,
    w: 11.7,
    h: 0.65,
    fontFace: "Arial",
    fontSize: 22,
    bold: true,
    color: "E8F4EE"
  });
}

// -------------------------------------------------------------
// PRESENTATION 1: HACKDAY 1.0 (Exact 7-slide official requirements)
// -------------------------------------------------------------
async function buildHackdayPresentation() {
  const pptx = new pptxgen();
  // Set explicit 16:9 Widescreen (13.333 x 7.5 inches)
  pptx.defineLayout({ name: "WIDESCREEN_16_9", width: 13.333, height: 7.5 });
  pptx.layout = "WIDESCREEN_16_9";
  pptx.title = "VoiceChessmate - HACKDAY 1.0";
  pptx.author = "VoiceChessmate Team";

  const BG = "0A0E0C";
  const CARD_BG = "121A15";
  const CARD_BORDER = "1E2C23";

  // SLIDE 1: Problem Statement
  {
    const s = pptx.addSlide();
    s.background = { color: BG };
    addSlideHeader(s, "01. Problem Statement", "Chess is Global. Digital Chess Locks Out 285M Blind Players.", "F05060");

    const cards = [
      {
        icon: icons.eyeOff("#F05060"),
        title: "Heavy Visual Lock-in",
        desc: "Mainstream platforms (Chess.com, Lichess) demand constant 2D eye tracking across 64 squares. Fast-paced Blitz & Bullet games are physically impossible for blind players."
      },
      {
        icon: icons.clock("#F0C040"),
        title: "Screen Reader Friction",
        desc: "Screen readers read raw DOM tables cell by cell. This adds 6-10 seconds of cognitive and mechanical delay per move, making clock flag-falls inevitable."
      },
      {
        icon: icons.cpu("#5BA3F5"),
        title: "Zero Tactical Audio Context",
        desc: "Coordinate readouts lack domain insight. Players have no instantaneous awareness of hanging pieces, pins, discovered attacks, or checkmate patterns."
      }
    ];

    const cardW = 3.65;
    const gap = 0.38;
    cards.forEach((c, i) => {
      const x = 0.8 + i * (cardW + gap);
      s.addShape("roundRect", {
        x, y: 1.75, w: cardW, h: 4.8,
        fill: { color: CARD_BG },
        line: { color: CARD_BORDER, width: 1 },
        rectRadius: 0.15
      });
      s.addImage({ data: c.icon, x: x + 0.35, y: 2.1, w: 0.5, h: 0.5 });
      s.addText(c.title, {
        x: x + 0.35, y: 2.8, w: cardW - 0.7, h: 0.6,
        fontFace: "Arial", fontSize: 16, bold: true, color: "FFFFFF"
      });
      s.addText(c.desc, {
        x: x + 0.35, y: 3.6, w: cardW - 0.7, h: 2.6,
        fontFace: "Arial", fontSize: 12.5, color: "9AB4A5", lineSpacing: 18
      });
    });
  }

  // SLIDE 2: Proposed Solution
  {
    const s = pptx.addSlide();
    s.background = { color: BG };
    addSlideHeader(s, "02. Proposed Solution", "VoiceChessmate: The Eyes-Free, Voice-First Chess Companion", "3ECF8E");

    // Left Column: The Experience
    const leftW = 5.65;
    s.addShape("roundRect", {
      x: 0.8, y: 1.75, w: leftW, h: 4.8,
      fill: { color: CARD_BG },
      line: { color: CARD_BORDER, width: 1 },
      rectRadius: 0.15
    });
    s.addImage({ data: icons.mic("#3ECF8E"), x: 1.15, y: 2.1, w: 0.5, h: 0.5 });
    s.addText("Natural Conversational Chess", {
      x: 1.8, y: 2.15, w: leftW - 1.2, h: 0.4,
      fontFace: "Arial", fontSize: 17, bold: true, color: "FFFFFF"
    });
    s.addText(
      "Players simply hold 'J' (push-to-talk) and speak naturally:\n" +
      "  • 'Knight to f3' or 'Pawn to Eva 4'\n" +
      "  • 'Describe my threats' or 'What is my best development?'\n\n" +
      "The Voice Agent immediately confirms moves, executes the AI reply, and speaks tactical coaching guidance back with zero screen dependency.",
      {
        x: 1.15, y: 2.85, w: leftW - 0.7, h: 3.3,
        fontFace: "Arial", fontSize: 13, color: "9AB4A5", lineSpacing: 19
      }
    );

    // Right Column: Key Innovations
    const rightW = 5.65;
    const rightX = 6.85;
    const features = [
      { icon: icons.volume("#3ECF8E"), title: "Zero-Latency Audio Engine", desc: "Dual AudioContext: 48kHz native playback + 24kHz capture with realistic wooden piece acoustics." },
      { icon: icons.accessibility("#3ECF8E"), title: "FIDE & IBCA Phonetics", desc: "Native support for international blind chess coordinate phonetics (Anna, Bella, Cesar, David...)." },
      { icon: icons.clock("#3ECF8E"), title: "Voice-Managed Chess Clocks", desc: "Full Bullet, Blitz, and Rapid timers with audio warnings and flag-fall detection." }
    ];

    features.forEach((f, i) => {
      const y = 1.75 + i * 1.65;
      s.addShape("roundRect", {
        x: rightX, y, w: rightW, h: 1.5,
        fill: { color: CARD_BG },
        line: { color: CARD_BORDER, width: 1 },
        rectRadius: 0.15
      });
      s.addImage({ data: f.icon, x: rightX + 0.3, y: y + 0.35, w: 0.45, h: 0.45 });
      s.addText(f.title, {
        x: rightX + 0.9, y: y + 0.25, w: rightW - 1.1, h: 0.35,
        fontFace: "Arial", fontSize: 14, bold: true, color: "FFFFFF"
      });
      s.addText(f.desc, {
        x: rightX + 0.9, y: y + 0.65, w: rightW - 1.1, h: 0.7,
        fontFace: "Arial", fontSize: 11.5, color: "9AB4A5", lineSpacing: 15
      });
    });
  }

  // SLIDE 3: Target Users
  {
    const s = pptx.addSlide();
    s.background = { color: BG };
    addSlideHeader(s, "03. Target Users", "Universal Accessibility: Engineered for Blind Players, Loved by All", "5BA3F5");

    const users = [
      {
        icon: icons.accessibility("#5BA3F5"),
        title: "Blind & Low-Vision",
        stat: "285 Million",
        statLabel: "Visually impaired globally",
        desc: "Complete eyes-free gameplay with spatial stereo earcons, audio coordinate verification, and zero visual friction."
      },
      {
        icon: icons.users("#3ECF8E"),
        title: "Chess Students",
        stat: "600+ Million",
        statLabel: "Active chess players worldwide",
        desc: "Interactive voice coaching that explains why a move was played, detects mistakes, and provides on-demand tactical reviews."
      },
      {
        icon: icons.mic("#F0C040"),
        title: "Commuter Players",
        stat: "10+ Million",
        statLabel: "Mobile audio gaming segment",
        desc: "Play rated games while commuting, exercising, or multitasking without looking at a phone or touching a keyboard."
      }
    ];

    const cardW = 3.65;
    const gap = 0.38;
    users.forEach((u, i) => {
      const x = 0.8 + i * (cardW + gap);
      s.addShape("roundRect", {
        x, y: 1.75, w: cardW, h: 4.8,
        fill: { color: CARD_BG },
        line: { color: CARD_BORDER, width: 1 },
        rectRadius: 0.15
      });
      s.addImage({ data: u.icon, x: x + 0.35, y: 2.1, w: 0.5, h: 0.5 });
      s.addText(u.title, {
        x: x + 0.35, y: 2.8, w: cardW - 0.7, h: 0.5,
        fontFace: "Arial", fontSize: 16, bold: true, color: "FFFFFF"
      });
      s.addText(u.stat, {
        x: x + 0.35, y: 3.45, w: cardW - 0.7, h: 0.5,
        fontFace: "Arial", fontSize: 22, bold: true, color: "5BA3F5"
      });
      s.addText(u.statLabel, {
        x: x + 0.35, y: 3.95, w: cardW - 0.7, h: 0.3,
        fontFace: "Arial", fontSize: 10.5, color: "6E8A7B"
      });
      s.addText(u.desc, {
        x: x + 0.35, y: 4.4, w: cardW - 0.7, h: 1.9,
        fontFace: "Arial", fontSize: 12, color: "9AB4A5", lineSpacing: 16
      });
    });
  }

  // SLIDE 4: Technical Approach
  {
    const s = pptx.addSlide();
    s.background = { color: BG };
    addSlideHeader(s, "04. Technical Approach", "Robust Full-Stack Pipeline with Guaranteed Audio Delivery", "3ECF8E");

    const techColumns = [
      {
        icon: icons.mic("#3ECF8E"),
        heading: "AssemblyAI Voice Agent",
        bullets: [
          "Direct WebSocket streaming with sub-300ms turn-around.",
          "AudioWorklet captures 24kHz PCM16 in 25ms chunks.",
          "Context-aware language parsing with chess keyterms.",
          "Deterministic tool calls: apply_move, describe_board."
        ]
      },
      {
        icon: icons.cpu("#5BA3F5"),
        heading: "Dual AudioContext Engine",
        bullets: [
          "Linux/PulseAudio solved: 48kHz output + 24kHz capture.",
          "No silent clipping or buffer dropouts.",
          "AudioBufferSourceNode zero-latency playback queue.",
          "Web Audio synthesized chess.com wood sound acoustics."
        ]
      },
      {
        icon: icons.shieldCheck("#F0C040"),
        heading: "Deterministic Chess Core",
        bullets: [
          "chess.js integration with complete legal move validation.",
          "Stockfish 16 WASM AI opponent with 4 difficulty levels.",
          "335 automated Vitest unit & adversarial tests in CI.",
          "Full state persistence across network reconnects."
        ]
      }
    ];

    const cardW = 3.65;
    const gap = 0.38;
    techColumns.forEach((t, i) => {
      const x = 0.8 + i * (cardW + gap);
      s.addShape("roundRect", {
        x, y: 1.75, w: cardW, h: 4.8,
        fill: { color: CARD_BG },
        line: { color: CARD_BORDER, width: 1 },
        rectRadius: 0.15
      });
      s.addImage({ data: t.icon, x: x + 0.35, y: 2.1, w: 0.45, h: 0.45 });
      s.addText(t.heading, {
        x: x + 0.35, y: 2.7, w: cardW - 0.7, h: 0.6,
        fontFace: "Arial", fontSize: 15, bold: true, color: "FFFFFF"
      });
      const bulletText = t.bullets.map(b => "• " + b).join("\n\n");
      s.addText(bulletText, {
        x: x + 0.35, y: 3.4, w: cardW - 0.7, h: 2.9,
        fontFace: "Arial", fontSize: 11.5, color: "9AB4A5", lineSpacing: 16
      });
    });
  }

  // SLIDE 5: Market & Business Potential
  {
    const s = pptx.addSlide();
    s.background = { color: BG };
    addSlideHeader(s, "05. Market & Business Potential", "Uncontested Category: Voice-First Accessible Digital Chess", "F0C040");

    const colW = 5.65;
    // Left Box: Market Metrics
    s.addShape("roundRect", {
      x: 0.8, y: 1.75, w: colW, h: 4.8,
      fill: { color: CARD_BG },
      line: { color: CARD_BORDER, width: 1 },
      rectRadius: 0.15
    });
    s.addImage({ data: icons.trendingUp("#F0C040"), x: 1.15, y: 2.1, w: 0.45, h: 0.45 });
    s.addText("Market Size & Opportunity", {
      x: 1.75, y: 2.15, w: colW - 1.1, h: 0.4,
      fontFace: "Arial", fontSize: 17, bold: true, color: "FFFFFF"
    });
    s.addText(
      "• $5.7B Global Chess Industry: Rapid expansion fueled by streaming, youth adoption, and scholastic programs.\n\n" +
      "• 285M Visually Impaired Population: Completely excluded from competitive online chess due to visual interface lock-in.\n\n" +
      "• Category Creation: Neither Chess.com nor Lichess offer conversational hands-free voice gameplay today.",
      {
        x: 1.15, y: 2.8, w: colW - 0.7, h: 3.4,
        fontFace: "Arial", fontSize: 12.5, color: "9AB4A5", lineSpacing: 18
      }
    );

    // Right Box: Revenue Models
    s.addShape("roundRect", {
      x: 6.85, y: 1.75, w: colW, h: 4.8,
      fill: { color: CARD_BG },
      line: { color: CARD_BORDER, width: 1 },
      rectRadius: 0.15
    });
    s.addImage({ data: icons.layers("#3ECF8E"), x: 7.2, y: 2.1, w: 0.45, h: 0.45 });
    s.addText("Sustainable Revenue Streams", {
      x: 7.8, y: 2.15, w: colW - 1.1, h: 0.4,
      fontFace: "Arial", fontSize: 17, bold: true, color: "FFFFFF"
    });
    s.addText(
      "1. Consumer Freemium (B2C)\n" +
      "   • Free: Unlimited standard voice games & clocks.\n" +
      "   • Pro ($8/mo): Master-tier coaching, deep game evaluations, opening blunder audits.\n\n" +
      "2. Institutional & Tournament Licensing (B2B)\n" +
      "   • Official digital client for IBCA blind chess championships.\n" +
      "   • White-label integration for schools and academies.\n\n" +
      "3. Voice Agent API Licensing\n" +
      "   • Modular SDK for third-party chess software.",
      {
        x: 7.2, y: 2.8, w: colW - 0.7, h: 3.4,
        fontFace: "Arial", fontSize: 12, color: "9AB4A5", lineSpacing: 17
      }
    );
  }

  // SLIDE 6: Scalability & Future
  {
    const s = pptx.addSlide();
    s.background = { color: BG };
    addSlideHeader(s, "06. Scalability & Future", "Strategic Roadmap: From AI Coach to Global Tournament Platform", "3ECF8E");

    const phases = [
      {
        phase: "PHASE 1 (TODAY)",
        title: "Autonomous AI Coach",
        bullets: "Full conversational chess companion with AssemblyAI voice engine, Stockfish 16 WASM, blitz clocks, and 335 passing unit tests."
      },
      {
        phase: "PHASE 2 (Q4 2026)",
        title: "Peer-to-Peer Voice Rooms",
        bullets: "Real-time human-vs-human voice chess rooms. Auditory clock countdowns and rated match synchronization with Lichess."
      },
      {
        phase: "PHASE 3 (2027)",
        title: "Hardware & Scale",
        bullets: "Bluetooth electronic chess board sync (DGT, Millennium), haptic move feedback, and multilingual IBCA speech models in 8 languages."
      }
    ];

    const cardW = 3.65;
    const gap = 0.38;
    phases.forEach((p, i) => {
      const x = 0.8 + i * (cardW + gap);
      s.addShape("roundRect", {
        x, y: 1.75, w: cardW, h: 4.8,
        fill: { color: CARD_BG },
        line: { color: CARD_BORDER, width: 1 },
        rectRadius: 0.15
      });
      s.addText(p.phase, {
        x: x + 0.35, y: 2.1, w: cardW - 0.7, h: 0.3,
        fontFace: "Arial", fontSize: 11, bold: true, color: "3ECF8E"
      });
      s.addText(p.title, {
        x: x + 0.35, y: 2.5, w: cardW - 0.7, h: 0.6,
        fontFace: "Arial", fontSize: 16, bold: true, color: "FFFFFF"
      });
      s.addText(p.bullets, {
        x: x + 0.35, y: 3.3, w: cardW - 0.7, h: 2.8,
        fontFace: "Arial", fontSize: 12.5, color: "9AB4A5", lineSpacing: 18
      });
    });
  }

  // SLIDE 7: If We Had More Time
  {
    const s = pptx.addSlide();
    s.background = { color: BG };
    addSlideHeader(s, "07. If We Had More Time", "Immediate Next Steps with Additional Time & Resources", "5BA3F5");

    const nextSteps = [
      {
        icon: icons.mic("#3ECF8E"),
        title: "1. Voice-to-Voice Multiplayer",
        desc: "Pair two blind players in a shared voice channel where both players' spoken moves and clock sounds are broadcast and verified in sub-second real time."
      },
      {
        icon: icons.accessibility("#F0C040"),
        title: "2. Haptic Coordinate Feedback",
        desc: "Encode square files (1-8) and ranks (a-h) into distinct spatial vibration patterns on mobile devices, allowing tactile verification without any audio."
      },
      {
        icon: icons.shieldCheck("#5BA3F5"),
        title: "3. IBCA Certified Tournament Arbiter",
        desc: "Digital adjudication engine generating FIDE-compliant PGN score-sheets with automated dispute playback for blind chess tournament organizers."
      },
      {
        icon: icons.rocket("#3ECF8E"),
        title: "4. Native iOS & Android Apps",
        desc: "Package the Web Audio and AssemblyAI pipeline into native mobile apps utilizing iOS CoreAudio and Android AudioTrack for maximum battery efficiency."
      }
    ];

    const boxW = 5.65;
    const boxH = 2.25;
    nextSteps.forEach((n, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 0.8 + col * (boxW + 0.4);
      const y = 1.75 + row * (boxH + 0.3);
      s.addShape("roundRect", {
        x, y, w: boxW, h: boxH,
        fill: { color: CARD_BG },
        line: { color: CARD_BORDER, width: 1 },
        rectRadius: 0.15
      });
      s.addImage({ data: n.icon, x: x + 0.35, y: y + 0.3, w: 0.45, h: 0.45 });
      s.addText(n.title, {
        x: x + 0.95, y: y + 0.25, w: boxW - 1.1, h: 0.35,
        fontFace: "Arial", fontSize: 14.5, bold: true, color: "FFFFFF"
      });
      s.addText(n.desc, {
        x: x + 0.35, y: y + 0.85, w: boxW - 0.7, h: 1.25,
        fontFace: "Arial", fontSize: 11.5, color: "9AB4A5", lineSpacing: 16
      });
    });
  }

  const outPath1 = path.join(__dirname, "../VoiceChessmate_HACKDAY_1.0.pptx");
  const outPath2 = path.join(__dirname, "../public/VoiceChessmate_HACKDAY_1.0.pptx");
  await pptx.writeFile({ fileName: outPath1 });
  fs.copyFileSync(outPath1, outPath2);
  console.log("HACKDAY 1.0 PPTX generated (Widescreen 16:9):", outPath1);
}

// -------------------------------------------------------------
// PRESENTATION 2: Hackdevengers 2.0 (8-slide comprehensive tech deck)
// -------------------------------------------------------------
async function buildHackdevengersPresentation() {
  const pptx = new pptxgen();
  pptx.defineLayout({ name: "WIDESCREEN_16_9", width: 13.333, height: 7.5 });
  pptx.layout = "WIDESCREEN_16_9";
  pptx.title = "VoiceChessmate - Hackdevengers 2.0";
  pptx.author = "VoiceChessmate Team";

  const BG = "060E0A";
  const CARD_BG = "0D1A14";
  const CARD_BORDER = "1B3025";

  // SLIDE 1: Title Slide
  {
    const s = pptx.addSlide();
    s.background = { color: BG };

    s.addImage({ data: icons.chessKnight("#3ECF8E"), x: 6.16, y: 1.5, w: 1.0, h: 1.0 });
    s.addText("VoiceChessmate", {
      x: 0.8, y: 2.7, w: 11.7, h: 0.9,
      fontFace: "Arial", fontSize: 42, bold: true, color: "FFFFFF", align: "center"
    });
    s.addText("Where Eyes Are Optional, But Victory Isn't.", {
      x: 0.8, y: 3.75, w: 11.7, h: 0.5,
      fontFace: "Arial", fontSize: 19, color: "3ECF8E", align: "center"
    });
    s.addText("An Autonomous, Conversational Voice Chess Companion for 285M Visually Impaired Players", {
      x: 0.8, y: 4.45, w: 11.7, h: 0.45,
      fontFace: "Arial", fontSize: 13.5, color: "8FAFA0", align: "center"
    });

    s.addText("Hackdevengers 2.0 Project Submission | Powered by AssemblyAI Voice Agent API", {
      x: 0.8, y: 6.1, w: 11.7, h: 0.4,
      fontFace: "Arial", fontSize: 11, color: "5B7A6C", align: "center"
    });
  }

  // SLIDE 2: The Core Problem
  {
    const s = pptx.addSlide();
    s.background = { color: BG };
    addSlideHeader(s, "The Problem", "Why Digital Chess Fails Blind Players Worldwide", "F05060");

    const issues = [
      {
        icon: icons.eyeOff("#F05060"),
        title: "Visual Dependency",
        body: "Modern chess sites require continuous 2D spatial eye tracking. Blind players cannot compete in standard time controls (Rapid/Blitz) due to interface lag."
      },
      {
        icon: icons.clock("#F0C040"),
        title: "Screen Reader Latency",
        body: "Standard screen readers traverse chessboard tables square by square. A 6-10 second move latency guarantees immediate clock flag-falls in timed play."
      },
      {
        icon: icons.volume("#5BA3F5"),
        title: "Browser Audio Dropouts",
        body: "Web Speech API in Chromium suffers silent GC truncation mid-sentence and IPC race conditions when moves are played in quick succession."
      }
    ];

    const cardW = 3.65;
    const gap = 0.38;
    issues.forEach((it, i) => {
      const x = 0.8 + i * (cardW + gap);
      s.addShape("roundRect", {
        x, y: 1.75, w: cardW, h: 4.8,
        fill: { color: CARD_BG },
        line: { color: CARD_BORDER, width: 1 },
        rectRadius: 0.15
      });
      s.addImage({ data: it.icon, x: x + 0.35, y: 2.1, w: 0.5, h: 0.5 });
      s.addText(it.title, {
        x: x + 0.35, y: 2.8, w: cardW - 0.7, h: 0.6,
        fontFace: "Arial", fontSize: 16, bold: true, color: "FFFFFF"
      });
      s.addText(it.body, {
        x: x + 0.35, y: 3.6, w: cardW - 0.7, h: 2.6,
        fontFace: "Arial", fontSize: 12.5, color: "9AB4A5", lineSpacing: 18
      });
    });
  }

  // SLIDE 3: The Voice Experience
  {
    const s = pptx.addSlide();
    s.background = { color: BG };
    addSlideHeader(s, "The Experience", "Hands-Free, Eyes-Free Conversational Gameplay", "3ECF8E");

    const leftW = 5.65;
    s.addShape("roundRect", {
      x: 0.8, y: 1.75, w: leftW, h: 4.8,
      fill: { color: CARD_BG },
      line: { color: CARD_BORDER, width: 1 },
      rectRadius: 0.15
    });
    s.addImage({ data: icons.mic("#3ECF8E"), x: 1.15, y: 2.1, w: 0.5, h: 0.5 });
    s.addText("Natural Dialogue Flow", {
      x: 1.8, y: 2.15, w: leftW - 1.2, h: 0.4,
      fontFace: "Arial", fontSize: 17, bold: true, color: "FFFFFF"
    });
    s.addText(
      "PLAYER:  'Knight to Felix 3'\n" +
      "COACH:   'Knight to Felix 3. Solid development.\n" +
      "          I will counter with pawn to Cesar 5.\n" +
      "          Your move, White.'\n\n" +
      "• Push-to-Talk (J key): Instant mic activation with zero queue delay.\n" +
      "• Single-Touch Auditory Hotkeys: Instant board audit (D), threats (T), and tactics (G).\n" +
      "• FIDE/IBCA Phonetics: Eliminates ambiguous rhymes (B/C/D/E/G).",
      {
        x: 1.15, y: 2.8, w: leftW - 0.7, h: 3.4,
        fontFace: "Arial", fontSize: 12.5, color: "9AB4A5", lineSpacing: 17
      }
    );

    const rightW = 5.65;
    const rightX = 6.85;
    const cards = [
      { icon: icons.volume("#3ECF8E"), title: "Chess.com Acoustics", desc: "Realistic wooden impact synthesis for moves, captures, checks, and game-over fanfares." },
      { icon: icons.clock("#F0C040"), title: "Audio Chess Clocks", desc: "Full Bullet, Blitz, and Rapid modes with audio countdown alerts and flag-fall detection." },
      { icon: icons.accessibility("#5BA3F5"), title: "Accessibility Settings", desc: "High-contrast board themes, text font scaling, screen reader caption logs, and full shortcuts." }
    ];

    cards.forEach((c, i) => {
      const y = 1.75 + i * 1.65;
      s.addShape("roundRect", {
        x: rightX, y, w: rightW, h: 1.5,
        fill: { color: CARD_BG },
        line: { color: CARD_BORDER, width: 1 },
        rectRadius: 0.15
      });
      s.addImage({ data: c.icon, x: rightX + 0.3, y: y + 0.35, w: 0.45, h: 0.45 });
      s.addText(c.title, {
        x: rightX + 0.9, y: y + 0.25, w: rightW - 1.1, h: 0.35,
        fontFace: "Arial", fontSize: 14, bold: true, color: "FFFFFF"
      });
      s.addText(c.desc, {
        x: rightX + 0.9, y: y + 0.65, w: rightW - 1.1, h: 0.7,
        fontFace: "Arial", fontSize: 11.5, color: "9AB4A5", lineSpacing: 15
      });
    });
  }

  // SLIDE 4: AssemblyAI Deep-Dive
  {
    const s = pptx.addSlide();
    s.background = { color: BG };
    addSlideHeader(s, "Audio Engineering", "High-Fidelity AssemblyAI Voice Agent Pipeline", "3ECF8E");

    const pipelineSteps = [
      {
        step: "STEP 1",
        title: "24kHz Audio Capture",
        body: "AudioWorklet processor chunks microphone stream into 25ms PCM16 buffers, optimized for speech recognition."
      },
      {
        step: "STEP 2",
        title: "WebSocket Streaming",
        body: "Real-time bidirectional communication with AssemblyAI agent. Sub-300ms turn-taking with built-in voice activity detection."
      },
      {
        step: "STEP 3",
        title: "Typed Tool Calling",
        body: "AssemblyAI triggers deterministic JSON schema tools (apply_move, describe_board) executed against the chess engine."
      },
      {
        step: "STEP 4",
        title: "Dual AudioContext",
        body: "Native 48kHz AudioBufferSourceNode playback fixes Linux/PulseAudio muting and ensures zero audio drops."
      }
    ];

    const cardW = 2.75;
    const gap = 0.24;
    pipelineSteps.forEach((st, i) => {
      const x = 0.8 + i * (cardW + gap);
      s.addShape("roundRect", {
        x, y: 1.75, w: cardW, h: 4.8,
        fill: { color: CARD_BG },
        line: { color: CARD_BORDER, width: 1 },
        rectRadius: 0.15
      });
      s.addText(st.step, {
        x: x + 0.25, y: 2.1, w: cardW - 0.5, h: 0.3,
        fontFace: "Arial", fontSize: 10, bold: true, color: "3ECF8E"
      });
      s.addText(st.title, {
        x: x + 0.25, y: 2.55, w: cardW - 0.5, h: 0.6,
        fontFace: "Arial", fontSize: 14.5, bold: true, color: "FFFFFF"
      });
      s.addText(st.body, {
        x: x + 0.25, y: 3.35, w: cardW - 0.5, h: 2.9,
        fontFace: "Arial", fontSize: 11.5, color: "9AB4A5", lineSpacing: 16
      });
    });
  }

  // SLIDE 5: IBCA Standards & Spatial Audio
  {
    const s = pptx.addSlide();
    s.background = { color: BG };
    addSlideHeader(s, "Accessibility Standard", "FIDE / IBCA Rule 2.1 & Spatial Audio Navigation", "5BA3F5");

    const colW = 5.65;
    // Left Table: IBCA Coordinate Map
    s.addShape("roundRect", {
      x: 0.8, y: 1.75, w: colW, h: 4.8,
      fill: { color: CARD_BG },
      line: { color: CARD_BORDER, width: 1 },
      rectRadius: 0.15
    });
    s.addText("Official IBCA Phonetic Coordinate Standard", {
      x: 1.15, y: 2.1, w: colW - 0.7, h: 0.4,
      fontFace: "Arial", fontSize: 15, bold: true, color: "FFFFFF"
    });
    s.addText(
      "File A  →  Anna     ('Pawn Anna 2 to Anna 4')\n" +
      "File B  →  Bella    ('Knight Bella 1 to Cesar 3')\n" +
      "File C  →  Cesar    ('Pawn Cesar 7 to Cesar 5')\n" +
      "File D  →  David    ('Queen David 1 to David 4')\n" +
      "File E  →  Eva      ('Pawn Eva 7 to Eva 5')\n" +
      "File F  →  Felix    ('Bishop Felix 1 to Cesar 4')\n" +
      "File G  →  Gustav   ('Knight Gustav 1 to Felix 3')\n" +
      "File H  →  Hector   ('Rook Hector 1 to Hector 3')",
      {
        x: 1.15, y: 2.7, w: colW - 0.7, h: 3.5,
        fontFace: "Courier New", fontSize: 11.5, color: "3ECF8E", lineSpacing: 17
      }
    );

    // Right Box: Spatial Earcons
    s.addShape("roundRect", {
      x: 6.85, y: 1.75, w: colW, h: 4.8,
      fill: { color: CARD_BG },
      line: { color: CARD_BORDER, width: 1 },
      rectRadius: 0.15
    });
    s.addImage({ data: icons.volume("#5BA3F5"), x: 7.2, y: 2.1, w: 0.45, h: 0.45 });
    s.addText("Spatial Earcon Sound Design", {
      x: 7.8, y: 2.15, w: colW - 1.1, h: 0.4,
      fontFace: "Arial", fontSize: 16, bold: true, color: "FFFFFF"
    });
    s.addText(
      "• Stereo Panning across Files: Moves on the A-file pan hard left; moves on the H-file pan hard right.\n\n" +
      "• Pentatonic Pitch across Ranks: Low pitches correspond to rank 1; high pitches correspond to rank 8.\n\n" +
      "• Acoustic Piece Timbres: Pawns (sine), Knights (triangle), Rooks/Queens (sawtooth).\n\n" +
      "Result: Sighted players visually parse a move in 200ms; VoiceChessmate's spatial audio delivers the move in ~260ms — 10x faster than speech.",
      {
        x: 7.2, y: 2.8, w: colW - 0.7, h: 3.4,
        fontFace: "Arial", fontSize: 11.5, color: "9AB4A5", lineSpacing: 17
      }
    );
  }

  // SLIDE 6: Production Readiness & Testing
  {
    const s = pptx.addSlide();
    s.background = { color: BG };
    addSlideHeader(s, "Verification & Quality", "Production Architecture & 335 Passing Automated Tests", "3ECF8E");

    const testCards = [
      {
        title: "335 Passing Tests",
        stat: "100%",
        statLabel: "Vitest Suite Passing",
        desc: "Exhaustive automated tests verifying chess rules, move legalities, edge-case pawn promotions, and Blitz clock flag-falls."
      },
      {
        title: "Headless Audio Mocks",
        stat: "Zero",
        statLabel: "Browser Regressions",
        desc: "Custom headless MockSpeechSynthesis and AudioContext harnesses test voice queuing, VAD interruptions, and race conditions in Node CI."
      },
      {
        title: "Self-Healing Watchdogs",
        stat: "30s",
        statLabel: "Maximum Lock Guard",
        desc: "Watchdogs prevent UI lockups: connecting (7s), thinking (10s), speaking (30s) automatically recover to idle if sockets disconnect."
      }
    ];

    const cardW = 3.65;
    const gap = 0.38;
    testCards.forEach((tc, i) => {
      const x = 0.8 + i * (cardW + gap);
      s.addShape("roundRect", {
        x, y: 1.75, w: cardW, h: 4.8,
        fill: { color: CARD_BG },
        line: { color: CARD_BORDER, width: 1 },
        rectRadius: 0.15
      });
      s.addText(tc.title, {
        x: x + 0.35, y: 2.1, w: cardW - 0.7, h: 0.4,
        fontFace: "Arial", fontSize: 16, bold: true, color: "FFFFFF"
      });
      s.addText(tc.stat, {
        x: x + 0.35, y: 2.7, w: cardW - 0.7, h: 0.6,
        fontFace: "Arial", fontSize: 30, bold: true, color: "3ECF8E"
      });
      s.addText(tc.statLabel, {
        x: x + 0.35, y: 3.35, w: cardW - 0.7, h: 0.3,
        fontFace: "Arial", fontSize: 11, color: "6E8A7B"
      });
      s.addText(tc.desc, {
        x: x + 0.35, y: 3.85, w: cardW - 0.7, h: 2.4,
        fontFace: "Arial", fontSize: 11.5, color: "9AB4A5", lineSpacing: 16
      });
    });
  }

  // SLIDE 7: Commercial Potential & Target Users
  {
    const s = pptx.addSlide();
    s.background = { color: BG };
    addSlideHeader(s, "Commercial Potential", "High Social Impact Meets a Scalable Commercial Opportunity", "F0C040");

    const colW = 5.65;
    s.addShape("roundRect", {
      x: 0.8, y: 1.75, w: colW, h: 4.8,
      fill: { color: CARD_BG },
      line: { color: CARD_BORDER, width: 1 },
      rectRadius: 0.15
    });
    s.addImage({ data: icons.trendingUp("#F0C040"), x: 1.15, y: 2.1, w: 0.45, h: 0.45 });
    s.addText("Market Scale & Demographics", {
      x: 1.75, y: 2.15, w: colW - 1.1, h: 0.4,
      fontFace: "Arial", fontSize: 16.5, bold: true, color: "FFFFFF"
    });
    s.addText(
      "• 285 Million Visually Impaired Worldwide:\n" +
      "  Chess is widely considered the premier intellectual sport for blind athletes, but digital tooling has lagged physical tactile boards by decades.\n\n" +
      "• 600 Million Sighted Chess Players:\n" +
      "  Hands-free and audio-first chess coaching appeals to commuters, drivers, and players seeking verbal analysis.\n\n" +
      "• First-Mover Advantage:\n" +
      "  No competitive voice chess engine exists on Chess.com or Lichess.",
      {
        x: 1.15, y: 2.8, w: colW - 0.7, h: 3.4,
        fontFace: "Arial", fontSize: 12, color: "9AB4A5", lineSpacing: 17
      }
    );

    s.addShape("roundRect", {
      x: 6.85, y: 1.75, w: colW, h: 4.8,
      fill: { color: CARD_BG },
      line: { color: CARD_BORDER, width: 1 },
      rectRadius: 0.15
    });
    s.addImage({ data: icons.layers("#3ECF8E"), x: 7.2, y: 2.1, w: 0.45, h: 0.45 });
    s.addText("Business Model & Distribution", {
      x: 7.8, y: 2.15, w: colW - 1.1, h: 0.4,
      fontFace: "Arial", fontSize: 16.5, bold: true, color: "FFFFFF"
    });
    s.addText(
      "1. Free Core Tier (Universal Accessibility):\n" +
      "   Full voice-first play, clocks, IBCA phonetics, and local stockfish engine.\n\n" +
      "2. VoiceChessmate Pro Subscription ($8/mo):\n" +
      "   Deep post-game audio analysis, mistake alerts, custom grandmaster voices.\n\n" +
      "3. Institutional & Federation Partnerships:\n" +
      "   Official tournament client for IBCA and regional blind sports associations.",
      {
        x: 7.2, y: 2.8, w: colW - 0.7, h: 3.4,
        fontFace: "Arial", fontSize: 12, color: "9AB4A5", lineSpacing: 17
      }
    );
  }

  // SLIDE 8: Roadmap & Vision
  {
    const s = pptx.addSlide();
    s.background = { color: BG };
    addSlideHeader(s, "Roadmap & Vision", "The Future: Hardware Integration & Global Peer-to-Peer Voice Rooms", "3ECF8E");

    const roadmapItems = [
      {
        icon: icons.mic("#3ECF8E"),
        title: "Voice-to-Voice Multiplayer",
        desc: "Two blind players connecting over real-time WebRTC audio channels, making moves verbally with automatic arbiter adjudication."
      },
      {
        icon: icons.accessibility("#F0C040"),
        title: "Haptic Physical Feedback",
        desc: "Vibratory coordinate encoding on mobile devices providing tactile confirmation of piece captures, checks, and square moves."
      },
      {
        icon: icons.terminal("#5BA3F5"),
        title: "Bluetooth DGT Board Sync",
        desc: "Connect physical tactile boards (DGT, Millennium) via Web Bluetooth so pieces moved on physical wood reflect instantly in voice."
      },
      {
        icon: icons.rocket("#3ECF8E"),
        title: "Multilingual Speech Models",
        desc: "Expand IBCA phonetic models and voice coach personalities across Spanish, French, German, Hindi, and Arabic."
      }
    ];

    const boxW = 5.65;
    const boxH = 2.25;
    roadmapItems.forEach((ri, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 0.8 + col * (boxW + 0.4);
      const y = 1.75 + row * (boxH + 0.3);
      s.addShape("roundRect", {
        x, y, w: boxW, h: boxH,
        fill: { color: CARD_BG },
        line: { color: CARD_BORDER, width: 1 },
        rectRadius: 0.15
      });
      s.addImage({ data: ri.icon, x: x + 0.35, y: y + 0.3, w: 0.45, h: 0.45 });
      s.addText(ri.title, {
        x: x + 0.95, y: y + 0.25, w: boxW - 1.1, h: 0.35,
        fontFace: "Arial", fontSize: 14.5, bold: true, color: "FFFFFF"
      });
      s.addText(ri.desc, {
        x: x + 0.35, y: y + 0.85, w: boxW - 0.7, h: 1.25,
        fontFace: "Arial", fontSize: 11.5, color: "9AB4A5", lineSpacing: 16
      });
    });
  }

  const outPath1 = path.join(__dirname, "../VoiceChessmate_Hackdevengers_2.0.pptx");
  const outPath2 = path.join(__dirname, "../public/VoiceChessmate_Hackdevengers_2.0.pptx");
  await pptx.writeFile({ fileName: outPath1 });
  fs.copyFileSync(outPath1, outPath2);
  console.log("Hackdevengers 2.0 PPTX generated (Widescreen 16:9):", outPath1);
}

async function run() {
  await buildHackdayPresentation();
  await buildHackdevengersPresentation();
  console.log("All presentations generated successfully!");
}

run().catch(err => {
  console.error("Error generating presentations:", err);
  process.exit(1);
});
