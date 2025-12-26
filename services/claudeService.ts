import Anthropic from '@anthropic-ai/sdk';
import { DetectionResult, RecognitionResult, User } from '../types';
import { ollamaService } from './ollamaService';

const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true // Required for browser usage
});

// Using Claude 3.5 Sonnet for best vision capabilities
const MODEL_NAME = 'claude-sonnet-4-20250514';

export const claudeService = {
  /**
   * Analyzes an image for registration: checks for face presence, quality, and generates a description.
   * Falls back to Ollama if Claude fails.
   */
  analyzeRegistrationImage: async (base64Image: string): Promise<DetectionResult> => {
    try {
      // Strip data URL prefix if present
      const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

      const response = await anthropic.messages.create({
        model: MODEL_NAME,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: cleanBase64
                }
              },
              {
                type: 'text',
                text: `Analyze this image for a facial recognition registration system.
                1. Are there any faces?
                2. Are there multiple faces? (We need exactly one)
                3. Is the face clear and unobstructed (good quality)?
                4. Provide a detailed physical description of the face (hair, glasses, facial hair, distinctive features) to use as a semantic embedding.
                5. Return the bounding box of the face using a 0-1000 scale (ymin, xmin, ymax, xmax).

                Return ONLY valid JSON with this exact structure:
                {
                  "faceDetected": boolean,
                  "multipleFaces": boolean,
                  "qualityCheckPassed": boolean,
                  "description": "string with face description",
                  "boundingBox": { "ymin": number, "xmin": number, "ymax": number, "xmax": number }
                }`
              }
            ]
          }
        ]
      });

      // Extract the text content from response
      const textContent = response.content.find(c => c.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new Error("No text response from Claude");
      }

      // Parse JSON from response (handle potential markdown code blocks)
      let jsonText = textContent.text;
      const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1].trim();
      }

      const result = JSON.parse(jsonText) as DetectionResult;
      return result;

    } catch (error: any) {
      console.warn("Claude Analysis Error, trying Ollama fallback:", error.message);

      // Fallback to Ollama for offline face detection
      try {
        const ollamaUp = await ollamaService.checkConnection();
        if (ollamaUp) {
          console.log('Using Ollama for face detection');
          const result = await ollamaService.detectFaceForRegistration(base64Image);
          if (result.description) {
            result.description += ' (Offline Mode)';
          }
          return result;
        }
      } catch (ollamaError) {
        console.error("Ollama fallback also failed:", ollamaError);
      }

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
   * Falls back to Ollama if Claude fails.
   */
  recognizeUser: async (base64Image: string, knownUsers: User[]): Promise<RecognitionResult> => {
    try {
      const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

      if (knownUsers.length === 0) {
        return { matchFound: false, error: "No users in database.", confidence: 0 };
      }

      // Construct a prompt with the known users' "embeddings" (descriptions)
      const userProfiles = knownUsers.map(u => `ID: ${u.id}, Name: ${u.name}, Description: ${u.faceDescription}`).join('\n');

      const response = await anthropic.messages.create({
        model: MODEL_NAME,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: cleanBase64
                }
              },
              {
                type: 'text',
                text: `You are a biometric matching engine.
              Here is a list of registered users:
              ${userProfiles}

              Task:
              1. Is there a person in the image?
              2. Does this person match ANY of the registered users above based on visual features?
              3. If a match is found, generate a short, friendly, personalized greeting based on the time of day and their name.
              4. If no match, provide a standard polite greeting for a visitor.
              5. Return the bounding box of the face using a 0-1000 scale (ymin, xmin, ymax, xmax).

              Return ONLY valid JSON with this exact structure:
              {
                "matchFound": boolean,
                "userId": "string ID of matched user or null",
                "confidence": number between 0 and 1,
                "greeting": "string",
                "boundingBox": { "ymin": number, "xmin": number, "ymax": number, "xmax": number }
              }`
              }
            ]
          }
        ]
      });

      // Extract the text content from response
      const textContent = response.content.find(c => c.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new Error("No text response from Claude");
      }

      // Parse JSON from response (handle potential markdown code blocks)
      let jsonText = textContent.text;
      const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1].trim();
      }

      const result = JSON.parse(jsonText) as RecognitionResult;
      return result;

    } catch (error: any) {
      console.warn("Claude Recognition Error, trying Ollama fallback:", error.message);

      // Fallback to Ollama for offline recognition
      try {
        const ollamaUp = await ollamaService.checkConnection();
        if (ollamaUp) {
          console.log('Using Ollama for face recognition');
          const result = await ollamaService.recognizeUser(base64Image, knownUsers);
          if (result.greeting) {
            result.greeting += ' (Offline Mode)';
          }
          return result;
        }
      } catch (ollamaError) {
        console.error("Ollama fallback also failed:", ollamaError);
      }

      return {
        matchFound: false,
        confidence: 0,
        error: "AI Processing Failed"
      };
    }
  }
};
