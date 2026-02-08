
import { GoogleGenAI } from "@google/genai";

export async function getBusinessInsights(dataSummary: string) {
  // On utilise directement la chaîne que Vite va remplacer lors du build
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey === "") {
    console.warn("Gemini API Key missing or empty.");
    return "L'IA est en attente de configuration.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Tu es un expert Business Analyst pour une startup de livraison de gaz en Afrique de l'Ouest. 
      Analyse ces données et donne 3 conseils stratégiques courts (max 2 phrases chacun) pour optimiser les ventes ou la logistique.
      Données : ${dataSummary}`,
      config: {
        temperature: 0.7,
      },
    });
    
    return response.text || "Impossible de générer des analyses.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Erreur lors de la connexion à l'IA d'analyse.";
  }
}
