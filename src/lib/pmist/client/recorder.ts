// WavRecorder — captures microphone audio in the browser and produces a
// 16 kHz mono 16-bit PCM WAV file as base64, ready for POST /api/asr.

const TARGET_SAMPLE_RATE = 16000;
const BUFFER_SIZE = 4096;

export class WavRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private chunks: Float32Array[] = [];
  private recording = false;

  get isRecording(): boolean {
    return this.recording;
  }

  async start(): Promise<void> {
    if (this.recording) return;

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    const AudioCtx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) throw new Error("Web Audio API is not supported in this browser");

    this.audioContext = new AudioCtx();
    this.source = this.audioContext.createMediaStreamSource(this.stream);
    this.processor = this.audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1);
    this.chunks = [];

    this.processor.onaudioprocess = (event: AudioProcessingEvent) => {
      if (!this.recording) return;
      this.chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
    };

    // Zero-gain destination keeps the ScriptProcessorNode pulling without
    // feeding the recorded audio back to the speakers.
    const silentSink = this.audioContext.createGain();
    silentSink.gain.value = 0;

    this.source.connect(this.processor);
    this.processor.connect(silentSink);
    silentSink.connect(this.audioContext.destination);

    this.recording = true;
  }

  async stop(): Promise<{ base64: string; durationSec: number }> {
    if (!this.recording) {
      // Clean abort: stop() called without an active start().
      this.releaseResources();
      return { base64: "", durationSec: 0 };
    }
    this.recording = false;

    let capturedRate = TARGET_SAMPLE_RATE;
    try {
      if (this.audioContext) capturedRate = this.audioContext.sampleRate;
    } catch {
      // ignore
    }

    this.releaseResources();

    const merged = mergeChunks(this.chunks);
    this.chunks = [];
    const durationSec = merged.length / capturedRate;
    const downsampled = downsample(merged, capturedRate, TARGET_SAMPLE_RATE);
    const wav = encodeWav(downsampled, TARGET_SAMPLE_RATE);
    return { base64: arrayBufferToBase64(wav), durationSec };
  }

  private releaseResources(): void {
    try {
      if (this.processor) {
        this.processor.onaudioprocess = null;
        this.processor.disconnect();
      }
      if (this.source) this.source.disconnect();
    } catch {
      // ignore
    }
    this.processor = null;
    this.source = null;

    try {
      this.stream?.getTracks().forEach((track) => track.stop());
    } catch {
      // ignore
    }
    this.stream = null;

    try {
      if (this.audioContext && this.audioContext.state !== "closed") {
        void this.audioContext.close();
      }
    } catch {
      // ignore
    }
    this.audioContext = null;
  }
}

function mergeChunks(chunks: Float32Array[]): Float32Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

/** Linear-interpolation downsample from `fromRate` to `toRate` (mono). */
function downsample(
  samples: Float32Array,
  fromRate: number,
  toRate: number,
): Float32Array {
  if (toRate >= fromRate || fromRate <= 0) return samples;
  const ratio = fromRate / toRate;
  const length = Math.floor(samples.length / ratio);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const position = i * ratio;
    const index = Math.floor(position);
    const frac = position - index;
    const current = samples[index];
    const next = index + 1 < samples.length ? samples[index + 1] : current;
    out[i] = current + (next - current) * frac;
  }
  return out;
}

/** Encode mono Float32 samples as a 16-bit PCM WAV (44-byte RIFF header). */
function encodeWav(samples: Float32Array, sampleRate: number = 16000): ArrayBuffer {
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size (PCM)
  view.setUint16(20, 1, true); // audio format: PCM
  view.setUint16(22, 1, true); // channel count: mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate (sampleRate * blockAlign)
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }
  return buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const CHUNK = 0x8000; // 32k per call — avoids String.fromCharCode stack overflow
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
