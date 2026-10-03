let audioContext: AudioContext | null = null;
let htmlAudio: HTMLAudioElement | null = null;
let htmlAudioUrl: string | null = null;
let unlocked = false;
let lastPlayedAt = 0;

const MIN_INTERVAL_MS = 400;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!Ctx) return null;

  if (!audioContext) {
    audioContext = new Ctx();
  }

  return audioContext;
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function buildMessengerSamples(sampleRate: number): Float32Array {
  const duration = 0.22;
  const length = Math.floor(sampleRate * duration);
  const samples = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    let sample = 0;

    if (t >= 0 && t < 0.09) {
      sample += Math.sin(2 * Math.PI * 587.33 * t) * 0.45 * (1 - t / 0.09);
    }
    if (t >= 0.07 && t < 0.2) {
      sample += Math.sin(2 * Math.PI * 880 * t) * 0.35 * (1 - (t - 0.07) / 0.13);
    }

    samples[i] = sample;
  }

  return samples;
}

function ensureHtmlAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;

  if (!htmlAudio) {
    const sampleRate = 44100;
    const blob = encodeWav(buildMessengerSamples(sampleRate), sampleRate);
    htmlAudioUrl = URL.createObjectURL(blob);
    htmlAudio = new Audio(htmlAudioUrl);
    htmlAudio.preload = "auto";
    htmlAudio.volume = 0.85;
    // Required for iOS — without this, notification audio is blocked in mobile Safari.
    htmlAudio.setAttribute("playsinline", "true");
    htmlAudio.setAttribute("webkit-playsinline", "true");
    htmlAudio.load();
  }

  return htmlAudio;
}

/**
 * Unlock audio after a user gesture.
 * play() and resume() must start synchronously inside the gesture handler — iOS Safari
 * revokes user activation before awaited work runs.
 */
export function unlockMessageNotificationSound(): Promise<void> {
  if (unlocked) return Promise.resolve();

  ensureHtmlAudio();

  const ctx = getAudioContext();
  if (ctx?.state === "suspended") {
    void ctx.resume();
  }

  const audio = ensureHtmlAudio();
  if (!audio) return Promise.resolve();

  audio.currentTime = 0;
  const playPromise = audio.play();

  if (!playPromise) {
    unlocked = true;
    return Promise.resolve();
  }

  return playPromise
    .then(() => {
      audio.pause();
      audio.currentTime = 0;
      unlocked = true;
    })
    .catch(() => {
      // Allow retry on the next tap — gesture may have expired or silent-mode blocked once.
    });
}

/** Re-resume audio after returning to the tab (mobile browsers suspend contexts in background). */
export function resumeMessageNotificationAudio(): void {
  const ctx = getAudioContext();
  if (ctx?.state === "suspended") {
    void ctx.resume();
  }
}

function playTone(
  ctx: AudioContext,
  frequency: number,
  start: number,
  duration: number,
  volume: number
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(frequency, start);

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(start);
  osc.stop(start + duration + 0.02);
}

async function playWithWebAudio(): Promise<boolean> {
  const ctx = getAudioContext();
  if (!ctx) return false;

  if (ctx.state === "suspended") {
    await ctx.resume();
  }

  if (ctx.state !== "running") return false;

  const t = ctx.currentTime + 0.02;
  playTone(ctx, 587.33, t, 0.09, 0.28);
  playTone(ctx, 880, t + 0.07, 0.11, 0.22);
  return true;
}

async function playWithHtmlAudio(): Promise<boolean> {
  const audio = ensureHtmlAudio();
  if (!audio) return false;

  try {
    audio.currentTime = 0;
    await audio.play();
    return true;
  } catch {
    return false;
  }
}

/** Play Messenger-style pop for incoming messages (not your own) */
export async function playMessageNotificationSound(): Promise<boolean> {
  const now = Date.now();
  if (now - lastPlayedAt < MIN_INTERVAL_MS) return false;

  resumeMessageNotificationAudio();

  // HTML5 audio is more reliable on mobile once unlocked; Web Audio is the desktop fallback.
  let played = (await playWithHtmlAudio()) || (await playWithWebAudio());

  if (played) {
    lastPlayedAt = now;
  }

  return played;
}

/** Only play when message is from someone else */
export function playIncomingMessageSound(senderId: string, myUserId: string | null | undefined) {
  if (!myUserId || senderId === myUserId) return;
  void playMessageNotificationSound();
}
