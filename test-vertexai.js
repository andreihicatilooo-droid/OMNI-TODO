import { VertexAI } from '@google-cloud/vertexai';

// Инициализация
const vertex_ai = new VertexAI({
  project: 'cerber-495808', 
  location: 'us-central1'
});

const model = 'gemini-1.5-flash';

async function generateContent() {
  const generativeModel = vertex_ai.getGenerativeModel({
    model: model,
  });

  const request = {
    contents: [{ role: 'user', parts: [{ text: 'Привет! Расскажи короткую шутку про программистов.' }] }],
  };

  try {
    const streamingResp = await generativeModel.generateContentStream(request);

    for await (const item of streamingResp.stream) {
      if (item.candidates && item.candidates[0].content && item.candidates[0].content.parts[0].text) {
          process.stdout.write(item.candidates[0].content.parts[0].text);
      }
    }
  } catch (error) {
    console.error("Ошибка при генерации контента:", error);
  }
}

generateContent();
