import { GoogleGenAI } from "@google/genai";

export const performOCR = async (image: string, onProgress?: (progress: number) => void): Promise<string> => {
  try {
    if (onProgress) onProgress(0.2);
    
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    if (onProgress) onProgress(0.4);
    
    // Detect mime type and extract base64 data
    let mimeType = 'image/png';
    let base64Data = image;
    
    if (image.startsWith('data:')) {
      const match = image.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      }
    }
    
    // Clean up base64 data (remove any potential whitespace)
    base64Data = base64Data.trim();
    
    if (!base64Data) {
      throw new Error("Données d'image vides.");
    }
    
    if (onProgress) onProgress(0.6);

    // Using gemini-3.1-pro-preview for more robust vision processing
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
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
