import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface FarmIngredient {
  id: string;
  name: string;
  price: number;
  farmerName: string;
  stock: number;
  unit: string;
  isSeasonal?: boolean;
}

export interface SuggestedRecipe {
  title: string;
  description: string;
  ingredients: { name: string; amount: string; id: string | null; farmerName?: string }[];
  carbonSavings: string;
  instructions: string[];
  yields: string;
}

export const getRecipeSuggestions = async (availableProduce: FarmIngredient[]): Promise<SuggestedRecipe[]> => {
  const ingredientBrief = availableProduce.map(p => ({
    name: p.name,
    stock: p.stock,
    unit: p.unit,
    seasonal: p.isSeasonal,
    farmer: p.farmerName
  }));

  const prompt = `You are a localized farm-to-table chef for AgriRoute (Pangasinan, Philippines). 
Given the following fresh ingredients from local farms: ${JSON.stringify(ingredientBrief)}.

CORE MISSION:
1. Suggest 3 healthy, seasonal recipes.
2. CRITICAL: Prioritize using ingredients that have HIGH STOCK and are marked as SEASONAL (seasonal: true).
3. Attempt to minimize the use of low-stock items to prevent supply strain.
4. For each ingredient used, identify which specific farm it is sourced from based on the provided list.
5. For each recipe, calculate estimated 'carbon savings' (e.g., "4.2kg CO2eq") compared to supermarket sourcing.
6. Use local Pangasinan/Filipino flavor profiles where appropriate.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            ingredients: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  amount: { type: Type.STRING },
                  id: { type: Type.STRING, nullable: true },
                  farmerName: { type: Type.STRING, description: "The name of the farm supplying this ingredient" }
                }
              }
            },
            carbonSavings: { type: Type.STRING },
            instructions: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            yields: { type: Type.STRING, description: "Estimated yield or servings, e.g., 'Serves 4'" }
          },
          required: ["title", "description", "ingredients", "carbonSavings", "instructions", "yields"]
        }
      }
    }
  });

  const text = response.text;
  if (!text) return [];
  return JSON.parse(text);
};
