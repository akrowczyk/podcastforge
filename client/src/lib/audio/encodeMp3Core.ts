import lamejs from "@breezystack/lamejs";

// Pure sync encoder. Safe to call on the main thread or inside a Web Worker.
// Returns a single Uint8Array of MP3 bytes (callers can wrap in a Blob).
export function encodeMp3Buffer(
  monoPcm: Float32Array,
  sampleRate: number,
  bitRateKbps: number
): Uint8Array {
  const samples = floatToInt16(monoPcm);

  const encoder = new lamejs.Mp3Encoder(1, sampleRate, bitRateKbps);
  const chunkSize = 1152;
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (let i = 0; i < samples.length; i += chunkSize) {
    const chunk = samples.subarray(i, i + chunkSize);
    const buf = encoder.encodeBuffer(chunk);
    if (buf.length > 0) {
      chunks.push(buf);
      total += buf.length;
    }
  }
  const flush = encoder.flush();
  if (flush.length > 0) {
    chunks.push(flush);
    total += flush.length;
  }

  // Concatenate into a single owned ArrayBuffer so the caller can transfer it.
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

function floatToInt16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}
