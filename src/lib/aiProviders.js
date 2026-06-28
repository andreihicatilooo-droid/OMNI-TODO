// Единый реестр AI-провайдеров — источник истины для роутинга запросов и UI.
//
// Раньше выбор провайдера размазывался по лестнице if/else во фронтенде
// (парсинг строки модели) и дублировался с захардкоженным <select>.
// Теперь каждая модель описывается одной записью: куда слать запрос,
// как собрать тело и как извлечь текст из не-стримингового ответа.
//
// Контракт стриминга: эндпоинты со `stream: true` обязаны эмитить SSE-строки
// вида `data: {"text": "..."}` и финальную `data: [DONE]`.

const DEFAULT_SYSTEM = 'Вы — полезный, вежливый и честный помощник.';

// Фабрики провайдеров. Каждая возвращает дескриптор для конкретного modelId.

const githubModelsProvider = (modelId) => ({
  provider: 'github-models',
  endpoint: '/api/github-models/chat',
  supportsStream: true,
  buildBody: ({ msgText, history, settings, stream }) => ({
    prompt: msgText,
    system: settings?.aiSystemPrompt || DEFAULT_SYSTEM,
    model: modelId,
    temperature: settings?.aiTemperature ?? 0.7,
    history,
    stream,
  }),
  parseResponse: (data) => data.text || 'Пустой ответ от модели.',
});

const vertexProvider = () => ({
  provider: 'vertex',
  endpoint: '/api/vertex-ai/chat',
  // Стриминг vLLM-эндпоинта возвращал пустой поток (формат не подтверждён),
  // а non-stream-путь отдаёт полный текст надёжно — используем его.
  supportsStream: false,
  // Vertex (vLLM) не принимает структурированную историю — сворачиваем диалог в промпт.
  buildBody: ({ msgText, history, settings, stream }) => ({
    prompt: history.length
      ? history.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n') + `\nUser: ${msgText}`
      : msgText,
    system: settings?.aiSystemPrompt || DEFAULT_SYSTEM,
    temperature: settings?.aiTemperature ?? 0.7,
    max_tokens: settings?.aiMaxTokens || 256,
    stream,
  }),
  parseResponse: (data) => data.text || 'Пустой ответ от модели.',
});

const anthropicProvider = (modelId) => ({
  provider: 'anthropic',
  endpoint: '/api/anthropic/chat',
  supportsStream: true,
  buildBody: ({ msgText, history, settings, stream }) => ({
    prompt: msgText,
    system: settings?.aiSystemPrompt || DEFAULT_SYSTEM,
    model: modelId,
    temperature: settings?.aiTemperature ?? 0.7,
    max_tokens: settings?.aiMaxTokens || 1024,
    history,
    stream,
    // Ключ из локального хранилища имеет приоритет; сервер падает на .env, если пусто.
    apiKey: settings?.apiKeys?.anthropic || undefined,
  }),
  parseResponse: (data) => data.text || 'Пустой ответ от модели.',
});

const geminiProvider = (modelId) => ({
  provider: 'gemini',
  endpoint: '/api/gemini/chat',
  supportsStream: false,
  buildBody: ({ msgText, history }) => ({
    text: msgText,
    // Сервер ожидает историю в поле `history` с role user/assistant.
    history,
    model: modelId,
  }),
  parseResponse: (data) => data.response || 'Пустой ответ от модели.',
});

const ollamaProvider = (modelId) => ({
  provider: 'ollama',
  endpoint: '/api/ollama',
  supportsStream: false,
  buildBody: ({ msgText, history, settings }) => ({
    // Ollama-эндпоинт принимает один промпт — сворачиваем контекст.
    prompt: history.length
      ? history.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n') + `\nUser: ${msgText}`
      : msgText,
    model: modelId,
    system: settings?.aiSystemPrompt || DEFAULT_SYSTEM,
  }),
  parseResponse: (data) => data.response || 'Пустой ответ от модели.',
});

const inceptionProvider = (modelId) => ({
  provider: 'inception',
  endpoint: '/api/inception/chat',
  supportsStream: true,
  buildBody: ({ msgText, history, settings, stream }) => ({
    prompt: msgText,
    system: settings?.aiSystemPrompt || DEFAULT_SYSTEM,
    model: modelId,
    temperature: settings?.aiTemperature ?? 0.7,
    // Mercury поддерживает reasoning_effort: low | medium | high.
    reasoning_effort: settings?.aiReasoningEffort || undefined,
    history,
    stream,
  }),
  parseResponse: (data) => data.text || 'Пустой ответ от модели.',
});

const huggingfaceProvider = (modelId) => ({
  provider: 'huggingface',
  endpoint: '/api/huggingface/chat',
  supportsStream: false,
  buildBody: ({ msgText, history, settings }) => ({
    text: msgText,
    history,
    model: modelId,
    apiKey: settings?.apiKeys?.huggingface || undefined,
  }),
  parseResponse: (data) => data.response || 'Пустой ответ от модели.',
});

const omniProvider = () => ({
  provider: 'omni',
  endpoint: '/api/omni',
  supportsStream: false,
  buildBody: ({ msgText }) => ({ text: msgText }),
  // Реальный ответ OMNI (Google CES): { outputs: [{ text }] }.
  // Старые поля responses/reply оставлены как фолбэк на случай иной версии API.
  parseResponse: (data) =>
    data.outputs?.[0]?.text
    || data.responses?.[0]?.text
    || data.reply?.[0]?.text
    || JSON.stringify(data),
});

// Курируемый список моделей для дропдауна. Порядок = порядок отображения.
// `group` управляет <optgroup>.
export const MODEL_OPTIONS = [
  { id: 'openai/gpt-5-chat', label: 'GPT-5 Chat', group: 'GitHub Models' },
  { id: 'openai/gpt-5-mini', label: 'GPT-5 Mini', group: 'GitHub Models' },
  { id: 'vertex/qwen3.6-27b', label: 'Qwen3.6-27B', group: 'Vertex AI' },
  { id: 'claude-opus-4-8', label: 'Claude Opus 4.8', group: 'Anthropic' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', group: 'Anthropic' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', group: 'Anthropic' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', group: 'Google Gemini' },
  { id: 'Qwen/Qwen2.5-72B-Instruct', label: 'Qwen 2.5 72B (HF)', group: 'Hugging Face' },
  { id: 'meta-llama/Meta-Llama-3-8B-Instruct', label: 'Llama 3 8B (HF)', group: 'Hugging Face' },
  { id: 'ollama/gemma2:2b', label: 'Gemma 2 (Local)', group: 'Локальные (Ollama)' },
  { id: 'ollama/llama3.2:3b', label: 'Llama 3.2 (Local)', group: 'Локальные (Ollama)' },
  { id: 'mercury-2', label: 'Mercury 2', group: 'Inception' },
  { id: 'omni', label: 'OMNI Orchestrator', group: 'OMNI' },
];

export const DEFAULT_MODEL = 'openai/gpt-5-chat';

// Разрешает modelId в дескриптор провайдера. Сначала пробуем точные/префиксные
// правила, затем — безопасный фолбэк на OMNI.
export const resolveProvider = (modelId) => {
  const id = (modelId || '').trim();

  if (id.startsWith('claude-')) return anthropicProvider(id);
  if (id.startsWith('ollama/')) return ollamaProvider(id.slice('ollama/'.length));
  if (id.startsWith('gemini')) return geminiProvider(id);
  if (id.startsWith('Qwen/') || id.startsWith('meta-llama/')) return huggingfaceProvider(id);
  if (id.startsWith('mercury')) return inceptionProvider(id);
  if (id === 'vertex/qwen3.6-27b' || id.startsWith('vertex/')) return vertexProvider();
  if (id === 'omni') return omniProvider();
  if (id.includes('/')) return githubModelsProvider(id); // openai/*, xai/*, …

  return omniProvider();
};

// Готовит историю в каноничный вид {role, content}, отбрасывая системные
// сообщения и сообщение, которое отправляется прямо сейчас.
export const normalizeHistory = (messages = []) =>
  messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: m.content }));

// Имя провайдера для модели (для сопоставления со статусом /api/ai/status).
export const providerOf = (modelId) => resolveProvider(modelId).provider;

// Человекочитаемые названия провайдеров.
export const PROVIDER_LABELS = {
  'github-models': 'GitHub Models',
  anthropic: 'Anthropic',
  gemini: 'Google Gemini',
  vertex: 'Vertex AI',
  ollama: 'Ollama',
  inception: 'Inception (Mercury)',
  huggingface: 'Hugging Face',
  omni: 'OMNI',
};
