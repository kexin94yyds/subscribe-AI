import { GoogleGenAI, Type } from "@google/genai";
import { ParsedAccountData } from '../types';

export const parseAccountInfo = async (text: string): Promise<ParsedAccountData | null> => {
  if (!process.env.API_KEY) {
    console.error("API Key is missing");
    throw new Error("API Key is missing");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Extract account subscription details from the following text. 
      If the exact date is not mentioned but a duration is (e.g., '1 year'), calculate the date starting from today (${new Date().toISOString().split('T')[0]}).
      Format the date as YYYY-MM-DD.
      
      Text: "${text}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: {
              type: Type.STRING,
              description: "The name of the service or account (e.g., Github Copilot, OpenAI, Netflix).",
            },
            expirationDate: {
              type: Type.STRING,
              description: "The expiration date in YYYY-MM-DD format.",
            },
            notes: {
              type: Type.STRING,
              description: "Any extra context found in the text, or a brief summary.",
            },
          },
          required: ["name", "expirationDate"],
        },
      },
    });

    const resultText = response.text;
    if (!resultText) return null;

    const parsed: ParsedAccountData = JSON.parse(resultText);
    return parsed;
  } catch (error) {
    console.error("Gemini parsing error:", error);
    throw error;
  }
};