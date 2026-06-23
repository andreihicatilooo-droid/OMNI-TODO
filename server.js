import express from 'express';
import cors from 'cors';
import { GoogleAuth } from 'google-auth-library';
import fs from 'fs';
import path from 'path';

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// Инициализация Google Auth
const auth = new GoogleAuth({
  scopes: 'https://www.googleapis.com/auth/cloud-platform'
});

// Путь к инструкциям OMNI (если они потребуются для локального контекста)
const OMNI_INSTRUCTIONS_PATH = 'C:/Users/G6E6N/Downloads/exported_app_OMNI (1)/OMNI/agents/OMNI_AI_Assistant/instruction.txt';

app.post('/api/omni', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Текст запроса обязателен' });
    }

    // Читаем инструкции OMNI
    let instructions = "";
    try {
      instructions = fs.readFileSync(OMNI_INSTRUCTIONS_PATH, 'utf8');
    } catch (e) {
      console.warn("Could not read OMNI instructions, using default.");
    }

    // 1. Получаем токен
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const token = tokenResponse.token;

    // 2. Формируем тело запроса (включаем инструкции как контекст)
    const requestBody = {
      config: {
        session: "projects/cerber-495808/locations/us/apps/b8f55bf4-97f9-46dc-a611-5186b266e2db/sessions/53Odf2neBR",
        app_version: "projects/cerber-495808/locations/us/apps/b8f55bf4-97f9-46dc-a611-5186b266e2db/versions/af8053b4-c2cb-46e1-b432-4f8de56fe79d",
        deployment: "projects/cerber-495808/locations/us/apps/b8f55bf4-97f9-46dc-a611-5186b266e2db/deployments/358feb09-d469-457d-8096-fab7cd35be25"
      },
      inputs: [
        {
          text: `SYSTEM_INSTRUCTIONS: ${instructions}\n\nUSER_REQUEST: ${text}`
        }
      ]
    };


    // 3. Отправляем запрос к API
    const response = await fetch("https://ces.googleapis.com/v1beta/projects/cerber-495808/locations/us/apps/b8f55bf4-97f9-46dc-a611-5186b266e2db/sessions/53Odf2neBR:runSession", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error("API Error Response:", data);
      return res.status(response.status).json({ error: 'Ошибка API', details: data });
    }

    // Логика Mind Extractor (пока просто пробрасываем ответ)
    res.json(data);

  } catch (error) {
    console.error("OMNI Proxy Server Error:", error);
    res.status(500).json({ error: 'Внутренняя ошибка прокси-сервера OMNI', message: error.message });
  }
});

app.post('/api/generate_image', async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Промпт обязателен' });
    }

    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const token = tokenResponse.token;

    const requestBody = {
      instances: [
        {
          prompt: prompt
        }
      ],
      parameters: {
        sampleCount: 1,
        aspectRatio: "1:1"
      }
    };

    const response = await fetch("https://us-central1-aiplatform.googleapis.com/v1/projects/cerber-495808/locations/us-central1/publishers/google/models/imagen-3.0-generate-001:predict", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error("Vertex AI Error Response:", data);
      return res.status(response.status).json({ error: 'Ошибка генерации', details: data });
    }

    res.json(data);

  } catch (error) {
    console.error("Image Generation Server Error:", error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера при генерации', message: error.message });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`OMNI Cloud Proxy Server is running on http://0.0.0.0:${port}`);
});

