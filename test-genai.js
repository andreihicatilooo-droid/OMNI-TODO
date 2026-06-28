import { GoogleGenAI } from '@google/genai';

// Initialize with your API key
const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_CLOUD_API_KEY,
});
const model = 'gemini-3.1-pro-preview';

const tools = [
  {
    googleSearch: {},
  },
  {
    googleMaps: {
    }
  },
];
const toolConfig = {
  retrievalConfig: {
    languageCode: "en_US",
  },
};

// Set up generation config
const generationConfig = {
  maxOutputTokens: 65535,
  temperature: 1,
  topP: 0.95,
  thinkingConfig: {
    thinkingLevel: "HIGH",
  },
  safetySettings: [
    {
      category: 'HARM_CATEGORY_HATE_SPEECH',
      threshold: 'OFF',
    },
    {
      category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
      threshold: 'OFF',
    },
    {
      category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
      threshold: 'OFF',
    },
    {
      category: 'HARM_CATEGORY_HARASSMENT',
      threshold: 'OFF',
    }
  ],
  tools: tools,
  toolConfig: toolConfig,
};

async function generateContent() {
  const req = {
    model: model,
    contents: [
      { role: 'user', parts: [{ text: 'Расскажи короткую шутку про программистов' }] }
    ],
    config: generationConfig,
  };

  try {
    const streamingResp = await ai.models.generateContentStream(req);

    for await (const chunk of streamingResp) {
      if (chunk.text) {
        process.stdout.write(chunk.text);
      } else {
        process.stdout.write(JSON.stringify(chunk) + '\n');
      }
    }
  } catch (error) {
    console.error("Error generating content:", error);
  }
}

generateContent();
