import express from 'express';
import cors from 'cors';
import { HfInference } from '@huggingface/inference';

const app = express();
app.use(cors());
app.use(express.json());

// ВАЖНО: Замените "hf_ТВОЙ_СЕКРЕТНЫЙ_ТОКЕН" на ваш реальный токен от Hugging Face
// В реальном проекте токен должен храниться в переменных окружения (process.env.HF_TOKEN)
const HF_TOKEN = process.env.HF_TOKEN || "hf_ТВОЙ_СЕКРЕТНЫЙ_ТОКЕН";
const hf = new HfInference(HF_TOKEN);

app.post('/api/chat', async (req, res) => {
  try {
    const userMessage = req.body.message;

    if (!userMessage) {
        return res.status(400).json({ error: "Сообщение не может быть пустым" });
    }

    console.log(`Получено сообщение: ${userMessage}`);

    // Вызываем модель чата. Здесь используем Qwen 2.5 72B
    const out = await hf.chatCompletion({
      model: "Qwen/Qwen2.5-72B-Instruct", 
      messages: [
        { role: "system", content: "Ты дружелюбный ИИ-помощник. Отвечай кратко и по делу." },
        { role: "user", content: userMessage }
      ],
      max_tokens: 500,
    });

    const reply = out.choices[0].message.content;
    console.log(`Ответ ИИ сгенерирован.`);

    // Отправляем сгенерированный текст обратно на фронтенд
    res.json({ reply: reply });
    
  } catch (error) {
    console.error("Ошибка при обращении к Hugging Face API:", error);
    res.status(500).json({ error: "Произошла ошибка при генерации ответа от ИИ." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущен. Бэкенд слушает на http://localhost:${PORT}`);
  console.log(`Не забудьте вставить свой Hugging Face токен в код или передать через переменную окружения HF_TOKEN!`);
});
