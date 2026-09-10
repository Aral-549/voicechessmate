// ============================================================
// VoiceChessmate — AssemblyAI Voice Agent WebSocket Manager
// Handles connection, audio streaming, and event routing
//
// Audio capture is initialized directly during user gesture.
// Audio playback uses a continuous ScriptProcessorNode with
// ring buffer for gapless streaming.
// ============================================================

import type { SessionConfig, VoiceAgentEvent } from '@/types';

const AGENT_WS_URL = 'wss://agents.assemblyai.com/v1/ws';
const SAMPLE_RATE = 24_000;
const CHUNK_MS = 50;
const CHUNK_SIZE = (SAMPLE_RATE * CHUNK_MS) / 1000; // 1200 samples per chunk

export type VoiceAgentStatus = 'disconnected' | 'connecting' | 'ready' | 'listening' | 'error';

type EventHandler = (event: VoiceAgentEvent) => void;

export class VoiceAgentManager {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;

  // Gapless playback ring buffer
  private speakerBuffer: Float32Array = new Float32Array(SAMPLE_RATE * 30); // 30s buffer
  private writePos = 0;
  private readPos = 0;
  private speakerNode: ScriptProcessorNode | null = null;

  private status: VoiceAgentStatus = 'disconnected';
  private isListeningActive = false;
  private eventHandlers: Map<string, EventHandler[]> = new Map();
  private statusHandlers: ((status: VoiceAgentStatus) => void)[] = [];

  // --- Event System ---

  on(eventType: string, handler: EventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }

  onStatusChange(handler: (status: VoiceAgentStatus) => void): void {
    this.statusHandlers.push(handler);
  }

  private emit(eventType: string, event: VoiceAgentEvent): void {
    const handlers = this.eventHandlers.get(eventType) || [];
    const wildcardHandlers = this.eventHandlers.get('*') || [];
    [...handlers, ...wildcardHandlers].forEach(h => h(event));
  }

  clearHandlers(): void {
    this.eventHandlers.clear();
    this.statusHandlers = [];
  }

  private setStatus(status: VoiceAgentStatus): void {
    this.status = status;
    this.statusHandlers.forEach(h => h(status));
  }

  // --- Push-to-Talk / Push-to-Listen State ---

  setListening(active: boolean): void {
    this.isListeningActive = active;
    if (this.status !== 'disconnected' && this.status !== 'connecting' && this.status !== 'error') {
      this.setStatus(active ? 'listening' : 'ready');
    }
    console.log(`[VoiceAgent] Push-to-Listen state: ${active ? 'ACTIVE' : 'IDLE'}`);
  }

  isListening(): boolean {
    return this.isListeningActive;
  }

  getStatus(): VoiceAgentStatus {
    return this.status;
  }

  // --- Connection ---

  async connect(sessionConfig: SessionConfig): Promise<void> {
    this.setStatus('connecting');

    try {
      // 1. Initialize AudioContext and microphone while user gesture is active
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioContextClass({ sampleRate: SAMPLE_RATE });
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone access is not supported in this browser context. Please use localhost or HTTPS.');
      }

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Create the source node from the mic stream — this is what feeds audio into the pipeline
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Try AudioWorklet first, fall back to ScriptProcessor if worklet fails
      try {
        await this.audioContext.audioWorklet.addModule('/audio-processor.js');
        this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-processor', {
          processorOptions: { chunkSize: CHUNK_SIZE },
        });

        this.workletNode.port.onmessage = (event) => {
          if (this.ws?.readyState === WebSocket.OPEN && this.isListeningActive) {
            const pcm16 = event.data as Int16Array;
            const base64 = this.int16ToBase64(pcm16);
            this.sendEvent({ type: 'input.audio', audio: base64 });
          }
        };

        this.sourceNode.connect(this.workletNode);
        console.log('[VoiceAgent] AudioWorklet connected — mic pipeline active');
      } catch (workletErr) {
        console.warn('[VoiceAgent] AudioWorklet failed, using fallback ScriptProcessor:', workletErr);
        const scriptProcessor = this.audioContext.createScriptProcessor(1024, 1, 1);
        scriptProcessor.onaudioprocess = (e) => {
          if (this.ws?.readyState === WebSocket.OPEN && this.isListeningActive) {
            const inputData = e.inputBuffer.getChannelData(0);
            const pcm16 = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
              const s = Math.max(-1, Math.min(1, inputData[i]));
              pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            this.sendEvent({ type: 'input.audio', audio: this.int16ToBase64(pcm16) });
          }
        };
        this.sourceNode.connect(scriptProcessor);
        scriptProcessor.connect(this.audioContext.destination);
        console.log('[VoiceAgent] ScriptProcessor fallback connected — mic pipeline active');
      }

      // Start speaker playback system
      this.startSpeakerPlayback();

      // 2. Get a temporary token from our backend
      const tokenRes = await fetch('/api/token');
      if (!tokenRes.ok) {
        const errBody = await tokenRes.text();
        throw new Error(`Token minting failed (${tokenRes.status}): ${errBody}`);
      }
      const { token } = await tokenRes.json();

      // 3. Connect via WebSocket with token
      this.ws = new WebSocket(`${AGENT_WS_URL}?token=${token}`);

      this.ws.onopen = () => {
        console.log('[VoiceAgent] WebSocket connected, sending session.update');
        this.sendEvent({
          type: 'session.update',
          session: sessionConfig,
        });
      };

      this.ws.onmessage = (event) => {
        const data: VoiceAgentEvent = JSON.parse(event.data);
        this.handleServerEvent(data);
      };

      this.ws.onerror = (error) => {
        console.error('[VoiceAgent] WebSocket error:', error);
        this.setStatus('error');
      };

      this.ws.onclose = (event) => {
        console.log(`[VoiceAgent] WebSocket closed: code=${event.code} reason="${event.reason}"`);
        if (event.code !== 1000 && event.code !== 1005) {
          this.setStatus('error');
        } else {
          this.setStatus('disconnected');
        }
        this.cleanup();
      };
    } catch (error) {
      console.error('[VoiceAgent] Connection failed:', error);
      this.setStatus('error');
      this.cleanup();
      throw error;
    }
  }

  // --- Server Event Handling ---

  private async handleServerEvent(event: VoiceAgentEvent): Promise<void> {
    this.emit(event.type, event);

    switch (event.type) {
      case 'session.ready':
        this.setStatus('ready');
        break;

      case 'reply.audio':
        this.enqueueSpeakerAudio(event.data as string);
        break;

      case 'reply.done':
        if ((event as unknown as { status: string }).status === 'interrupted') {
          // Flush playback buffer immediately — stop stale audio
          this.flushPlayback();
        }
        break;

      case 'session.error': {
        const err = event as unknown as { code?: string; message?: string; param?: string };
        console.error(`[VoiceAgent] Server error: code=${err.code} message="${err.message}" param=${err.param}`, JSON.stringify(event));
        this.setStatus('error');
        break;
      }
    }
  }

  // --- Gapless Audio Playback ---

  private startSpeakerPlayback(): void {
    if (!this.audioContext) return;

    this.speakerNode = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.speakerNode.onaudioprocess = (e) => {
      const output = e.outputBuffer.getChannelData(0);
      const bufLen = this.speakerBuffer.length;

      for (let i = 0; i < output.length; i++) {
        if (this.readPos !== this.writePos) {
          output[i] = this.speakerBuffer[this.readPos % bufLen];
          this.readPos++;
        } else {
          output[i] = 0; // Silence when buffer is empty
        }
      }
    };

    this.speakerNode.connect(this.audioContext.destination);
  }

  private enqueueSpeakerAudio(base64Audio: string): void {
    const pcm16 = this.base64ToInt16(base64Audio);
    const bufLen = this.speakerBuffer.length;

    for (let i = 0; i < pcm16.length; i++) {
      this.speakerBuffer[this.writePos % bufLen] = pcm16[i] / 32768;
      this.writePos++;
    }
  }

  private flushPlayback(): void {
    this.readPos = this.writePos;
  }

  /** Public — flush speaker buffer so browser TTS doesn't compete with agent audio */
  flushAudio(): void {
    this.flushPlayback();
  }

  // --- Send Events ---

  sendEvent(event: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event));
    }
  }

  sendToolResult(toolCallId: string, result: string): void {
    const payload = {
      type: 'tool.result',
      tool_call_id: toolCallId,
      result,
    };
    console.log('[VoiceAgent] Sending tool.result:', JSON.stringify(payload).slice(0, 500));
    this.sendEvent(payload);
  }

  // --- Encoding Utilities ---

  private int16ToBase64(pcm16: Int16Array): string {
    const bytes = new Uint8Array(pcm16.buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToInt16(base64: string): Int16Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Int16Array(bytes.buffer);
  }

  // --- Disconnect ---

  disconnect(): void {
    this.cleanup();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('disconnected');
  }

  private cleanup(): void {
    if (this.speakerNode) {
      this.speakerNode.disconnect();
      this.speakerNode = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.flushPlayback();
  }
}
