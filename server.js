/* global process */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { GoogleAuth } from 'google-auth-library';
import OpenAI from 'openai';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const app = express();
const port = 3001;

const githubModelsClient = process.env.GITHUB_TOKEN
  ? new OpenAI({
    baseURL: 'https://models.github.ai/inference',
    apiKey: process.env.GITHUB_TOKEN,
    defaultQuery: {
      'api-version': '2024-08-01-preview',
    },
  })
  : null;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================================================================
// OAuth Web Flow для интеграции нейросетей (Google Gemini, GitHub Copilot, Claude)
// ==========================================================================

// Конфигурация провайдеров. Client ID / Secret берутся из .env (см. .env.example).
const OAUTH_PROVIDERS = {
  gemini: {
    name: 'Google Gemini',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    scope: 'openid email profile https://www.googleapis.com/auth/generative-language.retriever',
    extraAuthParams: { access_type: 'offline', prompt: 'consent' },
    accountField: (user) => user.email || user.name,
  },
  copilot: {
    name: 'GitHub Copilot',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    scope: 'read:user copilot',
    extraAuthParams: {},
    accountField: (user) => user.login || user.name,
  },
  claude: {
    name: 'Claude Code',
    authUrl: process.env.ANTHROPIC_AUTH_URL || 'https://claude.ai/oauth/authorize',
    tokenUrl: process.env.ANTHROPIC_TOKEN_URL || 'https://console.anthropic.com/v1/oauth/token',
    userInfoUrl: null,
    clientId: process.env.ANTHROPIC_CLIENT_ID,
    clientSecret: process.env.ANTHROPIC_CLIENT_SECRET,
    scope: 'org:create_api_key user:profile user:inference',
    extraAuthParams: {},
    accountField: () => 'Claude account',
  },
};

// Хранилище токенов на бэкенде (персистится локально, в git не попадает).
const TOKENS_FILE = path.join(process.cwd(), '.oauth-tokens.json');

const loadTokens = () => {
  try {
    return JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
  } catch {
    return {};
  }
};

const saveTokens = (tokens) => {
  try {
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2));
  } catch (e) {
    console.error('Не удалось сохранить токены OAuth:', e.message);
  }
};

// Временное хранилище CSRF-state между start и callback (живёт в памяти).
const oauthStates = new Map();

// HTML-страница, которая возвращается в popup после callback: шлёт сообщение
// родительскому окну и закрывается.
const popupResponse = (payload, source = 'omni-oauth') => `<!doctype html>
<html><head><meta charset="utf-8"><title>OAuth</title></head>
<body style="font-family:system-ui;background:#1a1a1a;color:#eee;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<div style="text-align:center">
  <p style="font-size:18px">${payload.ok ? '✅ Авторизация успешна' : '❌ Ошибка авторизации'}</p>
  <p style="opacity:.6;font-size:13px">${payload.ok ? 'Окно закроется автоматически…' : (payload.error || '')}</p>
</div>
<script>
  (function(){
    var msg = ${JSON.stringify({ source, ...payload })};
    if (window.opener) { window.opener.postMessage(msg, '*'); }
    setTimeout(function(){ window.close(); }, ${payload.ok ? 800 : 3000});
  })();
</script>
</body></html>`;

// Инициация OAuth: строим authorize URL и редиректим в окно провайдера.
app.get('/api/auth/:provider/start', (req, res) => {
  const provider = OAUTH_PROVIDERS[req.params.provider];
  if (!provider) return res.status(404).send(popupResponse({ ok: false, error: 'Неизвестный провайдер' }));

  if (!provider.clientId || !provider.clientSecret) {
    return res.send(popupResponse({
      ok: false,
      provider: req.params.provider,
      error: `${provider.name} не настроен. Задайте Client ID/Secret в .env`,
    }));
  }

  // origin фронтенда нужен, чтобы redirect_uri вёл обратно на тот же ориджин
  // (через Vite proxy /api) и popup мог сделать postMessage в opener.
  const origin = req.query.origin || `${req.protocol}://${req.get('host')}`;
  const redirectUri = `${origin}/api/auth/${req.params.provider}/callback`;
  const state = crypto.randomBytes(16).toString('hex');
  oauthStates.set(state, { provider: req.params.provider, redirectUri, ts: Date.now() });

  const params = new URLSearchParams({
    client_id: provider.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: provider.scope,
    state,
    ...provider.extraAuthParams,
  });

  res.redirect(`${provider.authUrl}?${params.toString()}`);
});

// Callback: обмениваем код на токен, получаем данные аккаунта, сохраняем.
app.get('/api/auth/:provider/callback', async (req, res) => {
  const providerKey = req.params.provider;
  const provider = OAUTH_PROVIDERS[providerKey];
  if (!provider) return res.status(404).send(popupResponse({ ok: false, error: 'Неизвестный провайдер' }));

  const { code, state, error: providerError } = req.query;
  if (providerError) return res.send(popupResponse({ ok: false, provider: providerKey, error: String(providerError) }));

  const stored = oauthStates.get(state);
  if (!stored || stored.provider !== providerKey) {
    return res.send(popupResponse({ ok: false, provider: providerKey, error: 'Неверный или истёкший state (CSRF)' }));
  }
  oauthStates.delete(state);

  try {
    // 1. Обмен authorization code на access token
    const tokenResp = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
      body: new URLSearchParams({
        client_id: provider.clientId,
        client_secret: provider.clientSecret,
        code: String(code),
        redirect_uri: stored.redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });
    const tokenData = await tokenResp.json();
    if (!tokenResp.ok || tokenData.error) {
      throw new Error(tokenData.error_description || tokenData.error || 'Не удалось обменять код на токен');
    }

    // 2. Получаем информацию об аккаунте (если провайдер это поддерживает)
    let account = provider.name;
    if (provider.userInfoUrl) {
      try {
        const userResp = await fetch(provider.userInfoUrl, {
          headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'OMNI-TODO', Accept: 'application/json' },
        });
        if (userResp.ok) account = provider.accountField(await userResp.json()) || account;
      } catch { /* информация об аккаунте необязательна */ }
    }

    // 3. Сохраняем токены на бэкенде
    const tokens = loadTokens();
    tokens[providerKey] = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || null,
      expires_in: tokenData.expires_in || null,
      account,
      connectedAt: new Date().toISOString(),
    };
    saveTokens(tokens);

    res.send(popupResponse({ ok: true, provider: providerKey, account }));
  } catch (e) {
    console.error(`OAuth callback error (${providerKey}):`, e);
    res.send(popupResponse({ ok: false, provider: providerKey, error: e.message }));
  }
});

// Статус подключений всех провайдеров (без выдачи самих токенов наружу).
app.get('/api/auth/status', (req, res) => {
  const tokens = loadTokens();
  const status = {};
  for (const key of Object.keys(OAUTH_PROVIDERS)) {
    const p = OAUTH_PROVIDERS[key];
    status[key] = {
      name: p.name,
      configured: Boolean(p.clientId && p.clientSecret),
      connected: Boolean(tokens[key]?.access_token),
      account: tokens[key]?.account || null,
      connectedAt: tokens[key]?.connectedAt || null,
    };
  }
  res.json(status);
});

// Отключение провайдера: удаляем сохранённый токен.
app.post('/api/auth/:provider/disconnect', (req, res) => {
  const providerKey = req.params.provider;
  if (!OAUTH_PROVIDERS[providerKey]) return res.status(404).json({ error: 'Неизвестный провайдер' });
  const tokens = loadTokens();
  delete tokens[providerKey];
  saveTokens(tokens);
  res.json({ ok: true });
});

app.post('/api/auth/telegram/callback', (req, res) => {
  const { hash, ...fields } = req.body || {};
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    return res.send(popupResponse({ ok: false, provider: 'telegram', error: 'Telegram bot token is not configured' }, 'omni-telegram-auth'));
  }

  if (!hash) {
    return res.send(popupResponse({ ok: false, provider: 'telegram', error: 'Telegram auth data is missing' }, 'omni-telegram-auth'));
  }

  const dataCheckString = Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (computedHash !== hash) {
    return res.send(popupResponse({ ok: false, provider: 'telegram', error: 'Telegram auth data is invalid' }, 'omni-telegram-auth'));
  }

  const user = {
    id: Number(fields.id),
    first_name: fields.first_name || null,
    last_name: fields.last_name || null,
    username: fields.username || null,
    photo_url: fields.photo_url || null,
    auth_date: Number(fields.auth_date),
  };

  return res.send(popupResponse({ ok: true, provider: 'telegram', user }, 'omni-telegram-auth'));
});

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
    } catch {
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


app.post('/api/gemini', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Требуется промпт' });
    }

    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const token = tokenResponse.token;

    const requestBody = {
      contents: [{
        parts: [{ text: prompt }]
      }]
    };

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Gemini API Error Response:", data);
      return res.status(response.status).json({ error: 'Ошибка вызова Gemini API', details: data });
    }

    res.json(data);

  } catch (error) {
    console.error("Ошибка прокси-сервера Gemini:", error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера для прокси Gemini', message: error.message });
  }
});

app.post('/api/github-models/chat', async (req, res) => {
  try {
    const { prompt, system, model, temperature, top_p } = req.body || {};

    if (!githubModelsClient) {
      return res.status(500).json({
        error: 'GitHub Models не настроен',
        message: 'Добавьте GITHUB_TOKEN в .env',
      });
    }

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Требуется текстовый prompt' });
    }

    const safeTemperature = typeof temperature === 'number' ? temperature : 0.7;
    const safeTopP = typeof top_p === 'number' ? top_p : 1;
    const safeModel = typeof model === 'string' && model.trim() ? model : 'openai/gpt-5-chat';

    const messages = [
      {
        role: 'system',
        content: typeof system === 'string' && system.trim()
          ? system
          : 'Ты полезный ассистент. Отвечай кратко и по делу.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ];

    const response = await githubModelsClient.chat.completions.create({
      model: safeModel,
      messages,
      temperature: safeTemperature,
      top_p: safeTopP,
    });

    const choice = response.choices?.[0];
    const text = choice?.message?.content ?? '';

    return res.json({
      ok: true,
      model: response.model,
      text,
      usage: response.usage || null,
    });
  } catch (error) {
    console.error('GitHub Models proxy error:', error);
    return res.status(500).json({
      error: 'Внутренняя ошибка прокси GitHub Models',
      message: error?.message || 'Unknown error',
    });
  }
});

app.post('/api/github-models/responses', async (req, res) => {
  try {
    const { input, instructions, model, temperature, max_output_tokens } = req.body || {};

    if (!githubModelsClient) {
      return res.status(500).json({
        error: 'GitHub Models не настроен',
        message: 'Добавьте GITHUB_TOKEN в .env',
      });
    }

    if (!input || typeof input !== 'string') {
      return res.status(400).json({ error: 'Требуется текстовое поле input' });
    }

    const safeModel = typeof model === 'string' && model.trim()
      ? model
      : 'xai/grok-4.20-non-reasoning';

    const requestBody = {
      model: safeModel,
      input,
    };

    if (typeof instructions === 'string' && instructions.trim()) {
      requestBody.instructions = instructions;
    }
    if (typeof temperature === 'number') {
      requestBody.temperature = temperature;
    }
    if (typeof max_output_tokens === 'number') {
      requestBody.max_output_tokens = max_output_tokens;
    }

    const response = await githubModelsClient.responses.create(requestBody);

    let text = response.output_text || '';
    if (!text && Array.isArray(response.output)) {
      text = response.output
        .flatMap((item) => item?.content || [])
        .filter((part) => part?.type === 'output_text')
        .map((part) => part?.text || '')
        .join('\n')
        .trim();
    }

    return res.json({
      ok: true,
      id: response.id,
      model: response.model,
      text,
      usage: response.usage || null,
      raw: response,
    });
  } catch (error) {
    console.error('GitHub Models responses proxy error:', error);
    return res.status(500).json({
      error: 'Внутренняя ошибка Responses API',
      message: error?.message || 'Unknown error',
    });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`OMNI Cloud Proxy Server is running on http://0.0.0.0:${port}`);
});

