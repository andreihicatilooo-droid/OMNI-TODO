// Единая точка вызова любой модели. И чат, и тестовый запрос в настройках
// идут через неё — поэтому успешный тест гарантирует, что рабочий путь
// (роутинг → тело запроса → стрим/парсинг ответа) действительно функционирует.

import { resolveProvider } from './aiProviders';

const extractError = async (response) => {
  const data = await response.json().catch(() => ({}));
  const detail = data?.message || data?.error?.message || data?.error || `HTTP ${response.status}`;
  return typeof detail === 'string' ? detail : JSON.stringify(detail);
};

// Разбор SSE-потока в общем контракте `data: {"text": "..."}`.
const readStream = async (response, onChunk) => {
  let text = '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split('\n')) {
      if (line.startsWith('data: ') && line.trim() !== 'data: [DONE]') {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.text) {
            text += data.text;
            onChunk?.(data.text, text);
          }
        } catch {
          // Неполный JSON-чанк — игнорируем, дособерётся в следующей итерации
        }
      }
    }
  }
  return text;
};

/**
 * Отправляет запрос модели и возвращает её ответ.
 *
 * @param {object}   opts
 * @param {string}   opts.modelId   id модели (роутится через resolveProvider)
 * @param {string}   opts.prompt    текст запроса
 * @param {Array}    [opts.history] предыдущие сообщения [{role, content}]
 * @param {object}   [opts.settings] настройки (температура, system, ключи и т.д.)
 * @param {boolean}  [opts.stream]  использовать стриминг (если провайдер умеет)
 * @param {function} [opts.onChunk] колбэк (deltaText, fullText) для стрима
 * @returns {Promise<{text: string, provider: string, streamed: boolean}>}
 */
export async function callModel({ modelId, prompt, history = [], settings = {}, stream = false, onChunk } = {}) {
  const provider = resolveProvider(modelId);
  const useStream = Boolean(stream && provider.supportsStream);

  const response = await fetch(provider.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(provider.buildBody({ msgText: prompt, history, settings, stream: useStream })),
  });

  if (!response.ok) {
    throw new Error(await extractError(response));
  }

  if (useStream) {
    const text = await readStream(response, onChunk);
    return { text, provider: provider.provider, streamed: true };
  }

  const data = await response.json();
  return { text: provider.parseResponse(data), provider: provider.provider, streamed: false };
}
