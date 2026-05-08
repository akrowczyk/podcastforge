import { encodeMp3Buffer } from "./encodeMp3Core";

interface EncodeRequest {
  pcm: Float32Array;
  sampleRate: number;
  bitRateKbps: number;
}

self.onmessage = (e: MessageEvent<EncodeRequest>) => {
  const { pcm, sampleRate, bitRateKbps } = e.data;
  try {
    const out = encodeMp3Buffer(pcm, sampleRate, bitRateKbps);
    // Transfer the underlying ArrayBuffer back to avoid copying.
    (self as unknown as Worker).postMessage(
      { ok: true, bytes: out },
      [out.buffer as ArrayBuffer]
    );
  } catch (err) {
    (self as unknown as Worker).postMessage({
      ok: false,
      error: (err as Error).message || "encode failed",
    });
  }
};
