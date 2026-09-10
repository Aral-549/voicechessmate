// ============================================================
// VoiceChessmate — High-Quality Speech Synthesis
// Provides instant, lag-free spoken feedback for keyboard
// shortcuts, board scans, threats, and game state announcements.
// ============================================================

export function speakText(text: string, onEnd?: () => void): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  // Cancel any ongoing local speech
  window.speechSynthesis.cancel();

  // Strip emojis and markdown characters
  const clean = text
    .replace(/[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
    .replace(/[*_#`]/g, '')
    .trim();

  if (!clean) return;

  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.rate = 1.02;
  utterance.pitch = 1.0;

  // Select best English voice if available
  const voices = window.speechSynthesis.getVoices();
  const voice =
    voices.find(
      (v) =>
        v.lang.startsWith('en') &&
        (v.name.includes('Natural') ||
          v.name.includes('Google') ||
          v.name.includes('Samantha') ||
          v.name.includes('Daniel') ||
          v.name.includes('Karen'))
    ) || voices.find((v) => v.lang.startsWith('en'));

  if (voice) {
    utterance.voice = voice;
  }

  if (onEnd) {
    utterance.onend = onEnd;
  }

  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
