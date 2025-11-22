import { GoogleGenAI, Type } from "@google/genai";
import { DetectionResult, RecognitionResult, User } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Model specifically chosen for speed and vision capabilities
const MODEL_NAME = 'gemini-2.5-flash';

export const geminiService = {
  /**
   * Analyzes an image for registration: checks for face presence, quality, and generates a description.
   */
  analyzeRegistrationImage: async (base64Image: string): Promise<DetectionResult> => {
    try {
      // Strip data URL prefix if present
      const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: cleanBase64
              }
            },
            {
              text: `Analyze this image for a facial recognition registration system.
              1. Are there any faces?
              2. Are there multiple faces? (We need exactly one)
              3. Is the face clear and unobstructed (good quality)?
              4. Provide a detailed physical description of the face (hair, glasses, facial hair, distinctive features) to use as a semantic embedding.
              5. Return the bounding box of the face using a 0-1000 scale (ymin, xmin, ymax, xmax).

              Return strictly JSON.`
            }
          ]
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              faceDetected: { type: Type.BOOLEAN },
              multipleFaces: { type: Type.BOOLEAN },
              qualityCheckPassed: { type: Type.BOOLEAN },
              description: { type: Type.STRING },
              error: { type: Type.STRING },
              boundingBox: {
                type: Type.OBJECT,
                properties: {
                  ymin: { type: Type.NUMBER },
                  xmin: { type: Type.NUMBER },
                  ymax: { type: Type.NUMBER },
                  xmax: { type: Type.NUMBER },
                }
              }
            },
            required: ['faceDetected', 'multipleFaces', 'qualityCheckPassed']
          }
        }
      });

      if (!response.text) throw new Error("No response from AI");
      const result = JSON.parse(response.text) as DetectionResult;
      return result;

    } catch (error: any) {
      console.error("Gemini Analysis Error:", error);
      return {
        faceDetected: false,
        multipleFaces: false,
        qualityCheckPassed: false,
        error: error.message || "Failed to connect to AI service"
      };
    }
  },

  /**
   * Compares current frame against known users.
   */
  recognizeUser: async (base64Image: string, knownUsers: User[]): Promise<RecognitionResult> => {
    try {
       const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
       
       if (knownUsers.length === 0) {
         return { matchFound: false, error: "No users in database." , confidence: 0};
       }

       // Construct a prompt with the known users' "embeddings" (descriptions)
       const userProfiles = knownUsers.map(u => `ID: ${u.id}, Name: ${u.name}, Description: ${u.faceDescription}`).join('\n');

       const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: cleanBase64
              }
            },
            {
              text: `You are a biometric matching engine.
              Here is a list of registered users:
              ${userProfiles}

              Task:
              1. Is there a person in the image?
              2. Does this person match ANY of the registered users above based on visual features?
              3. If a match is found, generate a short, friendly, personalized greeting based on the time of day and their name.
              4. If no match, provide a standard polite greeting for a visitor.
              5. Return the bounding box of the face using a 0-1000 scale (ymin, xmin, ymax, xmax).

              Strict JSON output.`
            }
          ]
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              matchFound: { type: Type.BOOLEAN },
              userId: { type: Type.STRING, description: "The ID of the matched user, or null if no match" },
              confidence: { type: Type.NUMBER, description: "0 to 1 confidence score" },
              greeting: { type: Type.STRING },
              boundingBox: {
                type: Type.OBJECT,
                properties: {
                  ymin: { type: Type.NUMBER },
                  xmin: { type: Type.NUMBER },
                  ymax: { type: Type.NUMBER },
                  xmax: { type: Type.NUMBER },
                }
              }
            }
          }
        }
      });

      if (!response.text) throw new Error("No response from AI");
      const result = JSON.parse(response.text) as RecognitionResult;
      return result;

    } catch (error: any) {
      console.error("Gemini Recognition Error:", error);
      return {
        matchFound: false,
        confidence: 0,
        error: "AI Processing Failed"
      };
    }
  }
};