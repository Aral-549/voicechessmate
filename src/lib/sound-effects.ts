// ============================================================
// VoiceChessmate — Web Audio Sound Effects Synthesis
// Pure Web Audio API synthesis for chess game events
// Zero external audio files required — fully accessible & reliable
// ============================================================

let audioContext: AudioContext | null = null;

/**
 * Get or create the shared AudioContext singleton.
 * Safely handles SSR and browser autoplay policy.
 */
export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  try {
    if (!audioContext) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) return null;
      audioContext = new AudioCtxClass();
    }

    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {
        // Autoplay may block until user interaction
      });
    }

    return audioContext;
  } catch (err) {
    console.warn('[SoundEffects] Could not initialize AudioContext:', err);
    return null;
  }
}

/**
 * Resume AudioContext on user interaction to satisfy autoplay policies.
 */
export function resumeAudioContext(): void {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

/**
 * Helper to create an oscillator note with gain envelope and automatic cleanup.
 */
// ============================================================
// Move earcons — a move as sound rather than speech.
//
// Speech costs ~2s per move; a sighted player reads the board in ~200ms. This
// closes that gap: the whole move lands in ~300ms, which is FASTER than sight,
// not merely quieter than speech.
//
//   file  a..h  ->  stereo position, hard left to hard right
//   rank  1..8  ->  pitch, low to high (major pentatonic, so intervals are
//                   easy to name and nothing sounds dissonant)
//   piece       ->  timbre
//   capture     ->  a noise transient on impact
//   check       ->  two blips after
//
// You hear from-square then to-square, so direction is audible as a glide.
// Unlike TTS this is Web Audio, so it works in Chromium/Brave too.
// ============================================================

/** Major pentatonic over ~1.3 octaves: wide enough to tell ranks apart by ear. */
const RANK_PITCH = [262, 294, 330, 392, 440, 523, 587, 659];

const PIECE_TIMBRE: Record<string, { type: OscillatorType; gain: number }> = {
  p: { type: 'sine', gain: 0.22 },
  n: { type: 'triangle', gain: 0.2 },
  b: { type: 'square', gain: 0.1 }, // square is harmonically loud; pull it down
  r: { type: 'sawtooth', gain: 0.14 },
  q: { type: 'sawtooth', gain: 0.18 },
  k: { type: 'sine', gain: 0.26 },
};

function squareToAudio(square: string): { pan: number; freq: number } | null {
  if (!square || square.length < 2) return null;
  const file = square.charCodeAt(0) - 97; // a=0 .. h=7
  const rank = parseInt(square[1], 10) - 1; // 1=0 .. 8=7
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
  return { pan: -0.85 + (file / 7) * 1.7, freq: RANK_PITCH[rank] };
}

function panTone(opts: {
  freq: number;
  pan: number;
  type: OscillatorType;
  start: number;
  duration: number;
  gain: number;
}): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = opts.type;
  osc.frequency.setValueAtTime(opts.freq, opts.start);

  // Short attack stops the click that a hard gate produces on a 60ms tone.
  amp.gain.setValueAtTime(0.0001, opts.start);
  amp.gain.exponentialRampToValueAtTime(opts.gain, opts.start + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, opts.start + opts.duration);

  let tail: AudioNode = amp;
  if (typeof ctx.createStereoPanner === 'function') {
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, opts.pan)), opts.start);
    amp.connect(panner);
    tail = panner;
  }

  osc.connect(amp);
  tail.connect(ctx.destination);
  osc.start(opts.start);
  osc.stop(opts.start + opts.duration + 0.02);
  osc.onended = () => { try { osc.disconnect(); amp.disconnect(); } catch { /* already gone */ } };
}

/** Filtered noise burst — the "impact" of a capture. */
function noiseBurst(start: number, pan: number, duration = 0.09): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const frames = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames); // decaying
  }

  const src = ctx.createBufferSource();
  src.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(1800, start);
  filter.Q.setValueAtTime(0.8, start);

  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.3, start);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  let tail: AudioNode = amp;
  if (typeof ctx.createStereoPanner === 'function') {
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), start);
    amp.connect(panner);
    tail = panner;
  }

  src.connect(filter);
  filter.connect(amp);
  tail.connect(ctx.destination);
  src.start(start);
  src.onended = () => { try { src.disconnect(); filter.disconnect(); amp.disconnect(); } catch { /* gone */ } };
}

export interface EarconMove {
  from: string;
  to: string;
  piece: string;
  captured?: string;
  san?: string;
  isCheck?: boolean;
  isCheckmate?: boolean;
}

/** Sound a whole move. Returns the length in ms so callers can sequence speech after it. */
export function playMoveEarcon(move: EarconMove): number {
  const ctx = getAudioContext();
  if (!ctx) return 0;
  resumeAudioContext();

  const t0 = ctx.currentTime + 0.01;
  const timbre = PIECE_TIMBRE[move.piece] ?? PIECE_TIMBRE.p;

  // Castling reads as two separate pieces landing, king first.
  if (move.san === 'O-O' || move.san === 'O-O-O') {
    const kingTo = move.san === 'O-O' ? 'g1' : 'c1';
    const rookTo = move.san === 'O-O' ? 'f1' : 'd1';
    const k = squareToAudio(kingTo);
    const r = squareToAudio(rookTo);
    if (k) panTone({ ...k, type: 'sine', start: t0, duration: 0.12, gain: 0.26 });
    if (r) panTone({ ...r, type: 'sawtooth', start: t0 + 0.13, duration: 0.12, gain: 0.14 });
    return 280;
  }

  const from = squareToAudio(move.from);
  const to = squareToAudio(move.to);
  if (!to) return 0;

  // Origin: quiet and brief — it establishes direction without costing time.
  if (from) {
    panTone({ ...from, type: timbre.type, start: t0, duration: 0.055, gain: timbre.gain * 0.45 });
  }

  const landing = t0 + 0.07;
  if (move.captured) noiseBurst(landing, to.pan);
  panTone({ ...to, type: timbre.type, start: landing, duration: 0.16, gain: timbre.gain });

  // Queen gets a fifth stacked on top so it's unmistakable against a rook.
  if (move.piece === 'q') {
    panTone({ freq: to.freq * 1.5, pan: to.pan, type: 'sine', start: landing, duration: 0.16, gain: 0.1 });
  }

  let total = 250;
  if (move.isCheckmate) {
    [0, 0.12, 0.24].forEach((d, i) =>
      panTone({ freq: 880 + i * 220, pan: 0, type: 'square', start: landing + 0.2 + d, duration: 0.11, gain: 0.12 })
    );
    total = 620;
  } else if (move.isCheck) {
    [0, 0.1].forEach((d) =>
      panTone({ freq: 1320, pan: 0, type: 'square', start: landing + 0.2 + d, duration: 0.07, gain: 0.1 })
    );
    total = 450;
  }
  return total;
}

/** Sweep a2->h2 so a player can calibrate the pan/pitch mapping by ear. */
export function playBoardOrientationCue(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  resumeAudioContext();
  const t0 = ctx.currentTime + 0.02;
  for (let file = 0; file < 8; file++) {
    const sq = squareToAudio(String.fromCharCode(97 + file) + '4');
    if (sq) panTone({ ...sq, type: 'sine', start: t0 + file * 0.1, duration: 0.09, gain: 0.18 });
  }
}

function playTone({
  frequency,
  type = 'sine',
  startTime,
  duration,
  gainStart = 0.3,
  gainEnd = 0.001,
  freqEnd,
}: {
  frequency: number;
  type?: OscillatorType;
  startTime: number;
  duration: number;
  gainStart?: number;
  gainEnd?: number;
  freqEnd?: number;
}): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startTime);
  if (freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 10), startTime + duration);
  }

  gain.gain.setValueAtTime(gainStart, startTime);
  gain.gain.exponentialRampToValueAtTime(gainEnd, startTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration);

  osc.onended = () => {
    try {
      osc.disconnect();
      gain.disconnect();
    } catch {
      // Ignore disconnect errors
    }
  };
}

/**
 * Soft gentle wooden piece move tone.
 * Low resonant impact simulating a chess piece placed on a wooden board.
 */
export function playMoveSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Body thud: low triangle wave dropping in frequency
    playTone({
      frequency: 240,
      freqEnd: 85,
      type: 'triangle',
      startTime: now,
      duration: 0.09,
      gainStart: 0.28,
      gainEnd: 0.001,
    });

    // Subtle surface knock
    playTone({
      frequency: 520,
      freqEnd: 180,
      type: 'sine',
      startTime: now,
      duration: 0.03,
      gainStart: 0.15,
      gainEnd: 0.001,
    });
  } catch (err) {
    console.warn('[SoundEffects] playMoveSound failed:', err);
  }
}

/**
 * Crisp dual-tone capture sound.
 * Two distinct sequential clicks simulating a piece striking and displacing another.
 */
export function playCaptureSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Initial sharp strike
    playTone({
      frequency: 680,
      freqEnd: 420,
      type: 'triangle',
      startTime: now,
      duration: 0.05,
      gainStart: 0.32,
      gainEnd: 0.001,
    });

    // Secondary wooden thud
    playTone({
      frequency: 280,
      freqEnd: 110,
      type: 'triangle',
      startTime: now + 0.04,
      duration: 0.1,
      gainStart: 0.35,
      gainEnd: 0.001,
    });
  } catch (err) {
    console.warn('[SoundEffects] playCaptureSound failed:', err);
  }
}

/**
 * Sharp alert tone for Check.
 * High two-tone warning alert notifying the player their King is threatened.
 */
export function playCheckSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // First sharp warning tone (A5)
    playTone({
      frequency: 880,
      type: 'triangle',
      startTime: now,
      duration: 0.07,
      gainStart: 0.35,
      gainEnd: 0.001,
    });

    // Second higher alert tone (D6)
    playTone({
      frequency: 1174.66,
      type: 'sine',
      startTime: now + 0.08,
      duration: 0.15,
      gainStart: 0.4,
      gainEnd: 0.001,
    });
  } catch (err) {
    console.warn('[SoundEffects] playCheckSound failed:', err);
  }
}

/**
 * Ascending triumphant arpeggio for Victory / Checkmate.
 * Celebratory 4-note major arpeggio (C5 - E5 - G5 - C6).
 */
export function playVictorySound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const notes = [
      { freq: 523.25, time: 0.0, dur: 0.09 },   // C5
      { freq: 659.25, time: 0.08, dur: 0.09 },  // E5
      { freq: 783.99, time: 0.16, dur: 0.11 },  // G5
      { freq: 1046.50, time: 0.26, dur: 0.35 }, // C6
    ];

    notes.forEach(({ freq, time, dur }) => {
      playTone({
        frequency: freq,
        type: 'triangle',
        startTime: now + time,
        duration: dur,
        gainStart: 0.3,
        gainEnd: 0.001,
      });
      // Layer subtle sine for warmth
      playTone({
        frequency: freq,
        type: 'sine',
        startTime: now + time,
        duration: dur,
        gainStart: 0.2,
        gainEnd: 0.001,
      });
    });
  } catch (err) {
    console.warn('[SoundEffects] playVictorySound failed:', err);
  }
}

/**
 * Low warning buzzer tone for errors or invalid actions.
 * Dissonant dual low tone indicating an error, illegal move, or failure.
 */
export function playErrorSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Dissonant dual low tones producing a gentle buzz
    playTone({
      frequency: 140,
      freqEnd: 110,
      type: 'sawtooth',
      startTime: now,
      duration: 0.22,
      gainStart: 0.22,
      gainEnd: 0.001,
    });

    playTone({
      frequency: 147,
      freqEnd: 115,
      type: 'sawtooth',
      startTime: now,
      duration: 0.22,
      gainStart: 0.22,
      gainEnd: 0.001,
    });
  } catch (err) {
    console.warn('[SoundEffects] playErrorSound failed:', err);
  }
}
