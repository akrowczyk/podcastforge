import EncodeWorker from "./encodeWorker?worker";
import { encodeMp3Buffer } from "./encodeMp3Core";

interface EncodeResponse {
  ok: boolean;
  bytes?: Uint8Array;
  error?: string;
}

// Async MP3 encode. Runs lamejs in a Web Worker so the main thread stays
// responsive during the multi-second encode pass on long episodes.
//
// The pcm buffer is transferred to the worker — the caller MUST NOT reuse it
// after this call.
export function encodeMp3(
  monoPcm: Float32Array,
  sampleRate: number,
  bitRateKbps: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const worker = new EncodeWorker();
    worker.onmessage = (e: MessageEvent<EncodeResponse>) => {
      worker.terminate();
      if (e.data.ok && e.data.bytes) {
        resolve(new Blob([e.data.bytes as BlobPart], { type: "audio/mpeg" }));
      } else {
        reject(new Error(e.data.error || "Encode worker returned no data"));
      }
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message || "Encode worker errored"));
    };
    worker.postMessage(
      { pcm: monoPcm, sampleRate, bitRateKbps },
      [monoPcm.buffer as ArrayBuffer]
    );
  });
}

// Re-export the sync core for callers that explicitly need it (e.g. tests).
export { encodeMp3Buffer };
