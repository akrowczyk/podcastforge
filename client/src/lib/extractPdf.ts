import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export async function extractPdfText(file: File, onProgress?: (percent: number) => void): Promise<string> {
  const ab = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: ab }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    pages.push(tc.items.map((it: any) => it.str).join(' '));
    if (onProgress) {
      onProgress(Math.round((i / doc.numPages) * 100));
    }
  }
  return pages.join('\n\n');
}
