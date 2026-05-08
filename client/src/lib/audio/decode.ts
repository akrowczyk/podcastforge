// Decode an MP3 ArrayBuffer into a mono Float32 PCM at the given sample rate.
// We resample/downmix to a single target sample rate so all turns are stitchable.
export async function decodeMp3ToMono(
  audioBytes: ArrayBuffer,
  targetSampleRate: number
): Promise<Float32Array> {
  // Each decode in its own offline context. Modern browsers accept
  // an explicit sampleRate on OfflineAudioContext, which auto-resamples.
  // Fall back: decode at native rate then linear resample.
  // We try the modern path first.

  // decodeAudioData needs an AudioContext-like; use OfflineAudioContext.
  // Trick: use a temporary AudioContext just for decoding so the decoded
  // buffer comes back at its native sample rate, then resample manually.
  const tempCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  let decoded: AudioBuffer;
  try {
    decoded = await tempCtx.decodeAudioData(audioBytes.slice(0));
  } finally {
    // Don't await close to avoid blocking; ignore errors
    tempCtx.close().catch(() => {});
  }

  // Downmix to mono
  const mono = downmixToMono(decoded);

  // Resample if needed
  if (decoded.sampleRate === targetSampleRate) {
    return mono;
  }
  return await resample(mono, decoded.sampleRate, targetSampleRate);
}

function downmixToMono(buf: AudioBuffer): Float32Array {
  if (buf.numberOfChannels === 1) {
    return buf.getChannelData(0).slice(0);
  }
  const len = buf.length;
  const out = new Float32Array(len);
  const channels: Float32Array[] = [];
  for (let c = 0; c < buf.numberOfChannels; c++) {
    channels.push(buf.getChannelData(c));
  }
  for (let i = 0; i < len; i++) {
    let s = 0;
    for (let c = 0; c < channels.length; c++) s += channels[c][i];
    out[i] = s / channels.length;
  }
  return out;
}

// Resample using OfflineAudioContext (high-quality, browser-native).
async function resample(
  mono: Float32Array,
  fromRate: number,
  toRate: number
): Promise<Float32Array> {
  const lengthOut = Math.ceil((mono.length * toRate) / fromRate);
  const offline = new OfflineAudioContext(1, lengthOut, toRate);
  const buffer = offline.createBuffer(1, mono.length, fromRate);
  buffer.copyToChannel(mono as Float32Array<ArrayBuffer>, 0);
  const src = offline.createBufferSource();
  src.buffer = buffer;
  src.connect(offline.destination);
  src.start(0);
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0).slice(0);
}

// Trim trailing silence below a threshold (-50 dBFS by default).
// Avoids the "stitched" feeling when concatenating turns.
export function trimTrailingSilence(
  pcm: Float32Array,
  thresholdDb = -50,
  minTailMs = 30,
  sampleRate = 44100
): Float32Array {
  const threshold = Math.pow(10, thresholdDb / 20);
  let end = pcm.length;
  for (let i = pcm.length - 1; i >= 0; i--) {
    if (Math.abs(pcm[i]) > threshold) {
      end = i + 1;
      break;
    }
  }
  // Keep a tiny natural tail so the cut isn't surgical
  const tailSamples = Math.floor((minTailMs / 1000) * sampleRate);
  end = Math.min(pcm.length, end + tailSamples);
  return pcm.subarray(0, end);
}

// Generate a silence buffer of N milliseconds
export function silence(ms: number, sampleRate: number): Float32Array {
  return new Float32Array(Math.floor((ms / 1000) * sampleRate));
}

// Concatenate a list of mono Float32Arrays
export function concatMono(parts: Float32Array[]): Float32Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}
