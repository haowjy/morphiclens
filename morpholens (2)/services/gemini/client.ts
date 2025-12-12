
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || ''; 

export const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
