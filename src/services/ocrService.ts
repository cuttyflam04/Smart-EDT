import { createWorker } from 'tesseract.js';

export const performOCR = async (image: string | HTMLCanvasElement | File, onProgress?: (progress: number) => void): Promise<string> => {
  const worker = await createWorker('fra', 1, {
    logger: m => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(m.progress);
      }
    }
  });
  
  const { data: { text } } = await worker.recognize(image);
  await worker.terminate();
  
  return text;
};
