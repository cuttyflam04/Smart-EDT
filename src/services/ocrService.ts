import { GoogleGenAI } from "@google/genai";

export const performOCR = async (image: string, onProgress?: (progress: number) => void): Promise<string> => {
  try {
    if (onProgress) onProgress(0.2);
    
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    if (onProgress) onProgress(0.4);
    
    const base64Data = image.includes(',') ? image.split(',')[1] : image;
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          role: 'user',
          parts: [
            { text: "Extrais tout le texte de cet emploi du temps de manière structurée. Donne-moi les cours, les horaires, les jours et les salles. Réponds uniquement avec le texte extrait, sans commentaires." },
            { inlineData: { data: base64Data, mimeType: 'image/png' } }
          ]
        }
      ]
    });

    if (onProgress) onProgress(1);
    
    return response.text || "Aucun texte n'a pu être extrait.";
  } catch (error) {
    console.error('Gemini OCR Error:', error);
    throw new Error("Erreur lors de l'analyse par l'IA.");
  }
};
