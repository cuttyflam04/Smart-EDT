import { GoogleGenAI } from "@google/genai";

export const performOCR = async (image: string, onProgress?: (progress: number) => void): Promise<string> => {
  try {
    if (onProgress) onProgress(0.1);
    
    // Helper to compress image if it's too large
    const compressImage = async (base64Str: string): Promise<{ data: string, mimeType: string }> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Max dimension for OCR (Gemini works well with ~2000px)
          const MAX_DIM = 2048;
          if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            } else {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error("Impossible de créer le contexte canvas"));
            return;
          }
          
          ctx.drawImage(img, 0, 0, width, height);
          // Compress to JPEG for smaller payload
          const compressed = canvas.toDataURL('image/jpeg', 0.8);
          const match = compressed.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            resolve({ mimeType: match[1], data: match[2] });
          } else {
            reject(new Error("Erreur de compression"));
          }
        };
        img.onerror = () => reject(new Error("Erreur de chargement de l'image pour compression"));
        img.src = base64Str;
      });
    };

    if (onProgress) onProgress(0.3);
    const { data: base64Data, mimeType } = await compressImage(image);
    
    if (onProgress) onProgress(0.5);
    
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    // Using gemini-3-flash-preview for better availability and speed
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { 
            inlineData: { 
              data: base64Data, 
              mimeType: mimeType 
            } 
          },
          { 
            text: "Extrais tout le texte de cet emploi du temps de manière structurée. Donne-moi les cours, les horaires, les jours et les salles. Réponds uniquement avec le texte extrait, sans commentaires." 
          }
        ]
      }
    });

    if (onProgress) onProgress(1);
    
    return response.text || "Aucun texte n'a pu être extrait.";
  } catch (error: any) {
    console.error('Gemini OCR Error:', error);
    
    // Handle specific Gemini error structure
    let errorMessage = "Erreur lors de l'analyse par l'IA.";
    
    if (error?.message) {
      errorMessage = `Erreur IA: ${error.message}`;
    } else if (typeof error === 'object') {
      try {
        // Try to extract a more useful message if it's a JSON error from the API
        const errorBody = error?.response?.data || error;
        errorMessage = `Erreur IA: ${JSON.stringify(errorBody)}`;
      } catch (e) {
        errorMessage = "Erreur IA (format inconnu)";
      }
    }
    
    throw new Error(errorMessage);
  }
};
