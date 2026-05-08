import lamejs from "@breezystack/lamejs";

// Encode a mono Float32 PCM array as MP3.
// Returns a Blob URL the browser can play / download.
export function encodeMp3(
  monoPcm: Float32Array,
  sampleRate: number,
  bitRateKbps: number
): Blob {
  // lamejs wants 16-bit signed PCM
  const samples = floatToInt16(monoPcm);

  // Channels=1, sampleRate, bitrate kbps
  const encoder = new lamejs.Mp3Encoder(1, sampleRate, bitRateKbps);
  const chunkSize = 1152;
  const mp3Chunks: Uint8Array[] = [];
  for (let i = 0; i < samples.length; i += chunkSize) {
    const chunk = samples.subarray(i, i + chunkSize);
    const mp3buf = encoder.encodeBuffer(chunk);
    if (mp3buf.length > 0) mp3Chunks.push(mp3buf);
  }
  const flush = encoder.flush();
  if (flush.length > 0) mp3Chunks.push(flush);

  return new Blob(mp3Chunks as BlobPart[], { type: "audio/mpeg" });
}

function floatToInt16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}
