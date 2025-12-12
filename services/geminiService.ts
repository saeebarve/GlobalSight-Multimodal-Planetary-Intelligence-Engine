
import { GoogleGenAI } from "@google/genai";
import { GLOBALSIGHT_SYSTEM_INSTRUCTION, MODEL_NAME } from '../constants';
import { ChatMessage } from '../types';

// We define a callback type for streaming updates
type StreamUpdateCallback = (text: string, groundingMetadata?: any) => void;

const extractErrorMessage = (error: any): string => {
  let msg = "An unknown error occurred.";

  // 1. Try to extract specific API error messages (Google GenAI often nests them)
  // We explicitly check typeof string to prevent objects from being assigned to msg
  if (error?.response?.data?.error?.message && typeof error.response.data.error.message === 'string') {
    msg = error.response.data.error.message;
  } else if (error?.error?.message && typeof error.error.message === 'string') {
    msg = error.error.message;
  } else if (error?.message && typeof error.message === 'string') {
    msg = error.message;
  } else if (error instanceof Error) {
    msg = error.message;
  } else if (typeof error === 'string') {
    msg = error;
  } else {
    try {
      const stringified = JSON.stringify(error);
      msg = stringified === '{}' ? "An unknown system error occurred." : stringified;
    } catch {
      msg = "Non-serializable error.";
    }
  }

  // Ensure msg is actually a string before string methods
  msg = String(msg);

  // 2. Filter out useless "object Object" messages that result from poor stringification upstream
  if (msg.includes("[object Object]") || msg === "{}") {
     if (error?.statusText && typeof error.statusText === 'string') return `API Error: ${error.statusText}`;
     return "Critical Error: The server returned an invalid response format.";
  }

  return msg;
};

export const analyzeContentStream = async (
  textInput: string,
  base64Image: string | undefined,
  imageMimeType: string | undefined,
  base64Audio: string | undefined,
  audioMimeType: string | undefined,
  onUpdate: StreamUpdateCallback
): Promise<void> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. Please check your environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const parts: any[] = [];

  // Add image if available
  if (base64Image && imageMimeType) {
    const cleanBase64 = base64Image.includes('base64,') 
      ? base64Image.split('base64,')[1] 
      : base64Image;

    parts.push({
      inlineData: {
        data: cleanBase64,
        mimeType: imageMimeType
      }
    });
  }

  // Add audio if available
  if (base64Audio && audioMimeType) {
     const cleanBase64 = base64Audio.includes('base64,') 
      ? base64Audio.split('base64,')[1] 
      : base64Audio;

    parts.push({
      inlineData: {
        data: cleanBase64,
        mimeType: audioMimeType
      }
    });
  }

  // Add text prompt
  if (textInput) {
    parts.push({ text: textInput });
  } else if (parts.length === 0) {
    parts.push({ text: "Analyze the current state of the world based on available data and general knowledge." });
  }

  try {
    const responseStream = await ai.models.generateContentStream({
      model: MODEL_NAME,
      contents: [{
        role: 'user',
        parts: parts
      }],
      config: {
        systemInstruction: GLOBALSIGHT_SYSTEM_INSTRUCTION,
        temperature: 0.4,
        // Only Google Search enabled for Gemini 3 Pro compatibility
        tools: [{ googleSearch: {} }] 
      }
    });

    let fullText = '';
    let accumulatedGrounding: any = { groundingChunks: [] };

    for await (const chunk of responseStream) {
      const chunkText = chunk.text;
      if (chunkText) {
        fullText += chunkText;
      }

      // Handle Grounding Metadata in streams
      const chunkMetadata = chunk.candidates?.[0]?.groundingMetadata;
      if (chunkMetadata) {
        if (chunkMetadata.groundingChunks) {
           accumulatedGrounding.groundingChunks.push(...chunkMetadata.groundingChunks);
        }
        if (chunkMetadata.webSearchQueries) {
            accumulatedGrounding.webSearchQueries = chunkMetadata.webSearchQueries;
        }
      }

      onUpdate(fullText, accumulatedGrounding);
    }
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(extractErrorMessage(error));
  }
};

export const continueConversationStream = async (
    history: ChatMessage[],
    newMessage: string,
    initialContextParts: any[], // The original image/audio context
    onUpdate: StreamUpdateCallback
): Promise<void> => {
    if (!process.env.API_KEY) throw new Error("API Key missing");
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Construct the conversation history for the model
    const contents: any[] = [];

    // Turn 1: User (Image/Audio/Prompt)
    if (initialContextParts && initialContextParts.length > 0) {
      contents.push({
          role: 'user',
          parts: initialContextParts
      });
    }

    // Subsequent turns
    history.forEach(msg => {
        contents.push({
            role: msg.role,
            parts: [{ text: msg.text }]
        });
    });

    // Add the NEW message
    contents.push({
        role: 'user',
        parts: [{ text: newMessage }]
    });

    try {
        const responseStream = await ai.models.generateContentStream({
            model: MODEL_NAME,
            contents: contents,
            config: {
                systemInstruction: GLOBALSIGHT_SYSTEM_INSTRUCTION,
                // Only Google Search enabled for Gemini 3 Pro compatibility
                tools: [{ googleSearch: {} }]
            }
        });

        let fullText = '';
        
        for await (const chunk of responseStream) {
            const chunkText = chunk.text;
            if (chunkText) fullText += chunkText;
            onUpdate(fullText);
        }

    } catch (error: any) {
        console.error("Chat Error:", error);
        throw new Error(extractErrorMessage(error));
    }
};

// Helper to convert File to Base64 with Smart Resizing for Images
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    // If it's NOT an image (e.g. PDF), just read it directly
    if (!file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
        return;
    }

    // If it IS an image, resize it to max 1024px to speed up Gemini processing
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const MAX_SIZE = 1024; // Optimal size for Gemini Vision (balances speed vs detail)

            if (width > height) {
                if (width > MAX_SIZE) {
                    height *= MAX_SIZE / width;
                    width = MAX_SIZE;
                }
            } else {
                if (height > MAX_SIZE) {
                    width *= MAX_SIZE / height;
                    height = MAX_SIZE;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            
            // Compress to JPEG 0.8 quality to reduce payload size significantly
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            resolve(dataUrl);
        };
        img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

// Helper to convert Blob (Audio) to Base64
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};