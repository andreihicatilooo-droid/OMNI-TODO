import express from 'express';
import cors from 'cors';
import session from 'express-session';
import dotenv from 'dotenv';
import { GoogleAuth, OAuth2Client } from 'google-auth-library';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3001;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'omni-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true, sameSite: 'lax' }
}));

const auth = new GoogleAuth({
  scopes: 'https://www.googleapis.com/auth/cloud-platform'
});

const closeWindowHtml = (provider) => `<!doctype html><html><head><meta charset="utf-8"></head><body><script>window.opener?.postMessage({ provider: '${provider}' }, '*');setTimeout(() => window.close(), 500);</script><p>Authentication complete. You can close this window.</p></body></html>`;
const closeWindowErrorHtml = (provider, error) => `<!doctype html><html><head><meta charset="utf-8"></head><body><script>window.opener?.postMessage({ provider: '${provider}', error: ${JSON.stringify(error)} }, '*');setTimeout(() => window.close(), 1200);</script><p>Authentication failed: ${error}</p></body></html>`;

const DEFAULT_FRONTEND_URL = 'http://localhost:1337';
const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434';

const getFrontendUrl = (req) => {
  const candidate = req.headers.origin || req.headers.referer || getRuntimeConfig().frontendUrl;
  try {
    return new URL(candidate).origin;
  } catch {
    return DEFAULT_FRONTEND_URL;
  }
};

const parseAuthState = (state) => {
  if (!state) return { mode: 'popup' };
  try {
    const parsed = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
    return { ...parsed, mode: parsed.mode === 'redirect' ? 'redirect' : 'popup' };
  } catch {
    return { mode: 'popup' };
  }
};

const buildAuthRedirectUrl = (req, provider, state = {}) => {
  const fallbackOrigin = getFrontendUrl(req);
  const origin = state.frontendOrigin && /^https?:\/\//.test(state.frontendOrigin)
    ? state.frontendOrigin
    : fallbackOrigin;
  return `${origin}/?auth=success&provider=${provider}`;
};

const respondWithAuthCompletion = (req, res, provider, mode = 'popup', state = {}) => {
  if (mode === 'redirect') {
    return res.redirect(buildAuthRedirectUrl(req, provider, state));
  }
  return res.send(closeWindowHtml(provider));
};

const respondWithAuthError = (req, res, provider, error, mode = 'popup', state = {}) => {
  if (mode === 'redirect') {
    const fallbackOrigin = getFrontendUrl(req);
    const origin = state.frontendOrigin && /^https?:\/\//.test(state.frontendOrigin)
      ? state.frontendOrigin
      : fallbackOrigin;
    return res.redirect(`${origin}/?auth=error&provider=${provider}&message=${encodeURIComponent(error)}`);
  }
  return res.status(500).send(closeWindowErrorHtml(provider, error));
};

// Путь к инструкциям OMNI (если они потребуются для локального контекста)
const OMNI_INSTRUCTIONS_PATH = 'C:/Users/G6E6N/Downloads/exported_app_OMNI (1)/OMNI/agents/OMNI_AI_Assistant/instruction.txt';
const ENV_FILE_PATH = path.resolve(process.cwd(), '.env');

const parseEnvFile = () => {
  if (!fs.existsSync(ENV_FILE_PATH)) {
    return {};
  }

  return fs.readFileSync(ENV_FILE_PATH, 'utf8')
    .split(/\r?\n/)
    .reduce((acc, rawLine) => {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) {
        return acc;
      }

      const separatorIndex = line.indexOf('=');
      if (separatorIndex === -1) {
        return acc;
      }

      const key = line.slice(0, separatorIndex).trim();
      let value = line.slice(separatorIndex + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      acc[key] = value;
      return acc;
    }, {});
};

const getRuntimeConfig = () => {
  const fileEnv = parseEnvFile();
  return {
    googleClientId: fileEnv.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '',
    googleClientSecret: fileEnv.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '',
    googleRedirectUri: fileEnv.GOOGLE_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI || `http://localhost:${port}/auth/google/callback`,
    githubClientId: fileEnv.GITHUB_CLIENT_ID || process.env.GITHUB_CLIENT_ID || '',
    githubClientSecret: fileEnv.GITHUB_CLIENT_SECRET || process.env.GITHUB_CLIENT_SECRET || '',
    githubRedirectUri: fileEnv.GITHUB_REDIRECT_URI || process.env.GITHUB_REDIRECT_URI || `http://localhost:${port}/auth/github/callback`,
    googleGeminiProject: fileEnv.GOOGLE_GEMINI_PROJECT || process.env.GOOGLE_GEMINI_PROJECT || '',
    googleGeminiLocation: fileEnv.GOOGLE_GEMINI_LOCATION || process.env.GOOGLE_GEMINI_LOCATION || 'us-central1',
    googleGeminiModel: fileEnv.GOOGLE_GEMINI_MODEL || process.env.GOOGLE_GEMINI_MODEL || 'imagen-3.0',
    googleGeminiPublisher: fileEnv.GOOGLE_GEMINI_PUBLISHER || process.env.GOOGLE_GEMINI_PUBLISHER || 'google',
    googleGeminiApiKey: fileEnv.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || '',
    googleGeminiChatModel: fileEnv.GOOGLE_GEMINI_CHAT_MODEL || process.env.GOOGLE_GEMINI_CHAT_MODEL || 'gemini-2.0-flash',
    frontendUrl: fileEnv.FRONTEND_URL || process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL,
    ollamaBaseUrl: fileEnv.OLLAMA_BASE_URL || process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL,
  };
};

const applyRuntimeConfigToProcess = (runtimeConfig) => {
  process.env.GOOGLE_CLIENT_ID = runtimeConfig.googleClientId;
  process.env.GOOGLE_CLIENT_SECRET = runtimeConfig.googleClientSecret;
  process.env.GOOGLE_REDIRECT_URI = runtimeConfig.googleRedirectUri;
  process.env.GITHUB_CLIENT_ID = runtimeConfig.githubClientId;
  process.env.GITHUB_CLIENT_SECRET = runtimeConfig.githubClientSecret;
  process.env.GITHUB_REDIRECT_URI = runtimeConfig.githubRedirectUri;
  process.env.FRONTEND_URL = runtimeConfig.frontendUrl;
  process.env.GOOGLE_GEMINI_PROJECT = runtimeConfig.googleGeminiProject;
  process.env.OLLAMA_BASE_URL = runtimeConfig.ollamaBaseUrl;
};

const buildServiceUrl = (baseUrl, pathname) => {
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return new URL(pathname.replace(/^\//, ''), normalizedBaseUrl).toString();
};

const normalizeOllamaModels = (payload) => {
  if (!Array.isArray(payload?.models)) {
    return [];
  }

  return payload.models
    .map((model) => ({
      name: model?.name || '',
      size: model?.size || 0,
      modifiedAt: model?.modified_at || null,
    }))
    .filter((model) => model.name);
};

const createGoogleOAuthClient = (runtimeConfig) => new OAuth2Client(
  runtimeConfig.googleClientId,
  runtimeConfig.googleClientSecret,
  runtimeConfig.googleRedirectUri
);

const normalizeGoogleUser = (profile = {}) => ({
  provider: 'google',
  id: profile.sub || profile.id || null,
  name: profile.name || profile.email || 'Google User',
  email: profile.email || '',
  picture: profile.picture || '',
  avatar_url: profile.picture || '',
});

const normalizeGitHubUser = (profile = {}) => ({
  provider: 'github',
  id: profile.id || null,
  login: profile.login || '',
  name: profile.name || profile.login || 'GitHub User',
  email: profile.email || '',
  picture: profile.avatar_url || '',
  avatar_url: profile.avatar_url || '',
  html_url: profile.html_url || '',
});

const clearProviderSession = (req, provider) => {
  if (provider === 'google' || provider === 'all') {
    delete req.session.googleAuth;
    delete req.session.googleUser;
  }

  if (provider === 'github' || provider === 'copilot' || provider === 'all') {
    delete req.session.githubAuth;
    delete req.session.githubUser;
    delete req.session.copilotAuth;
    delete req.session.copilotUser;
  }
};

const upsertEnvValue = (text, key, value) => {
  const escaped = String(value ?? '').replace(/\r?\n/g, '');
  const line = `${key}=${escaped}`;
  const keyRegex = new RegExp(`^${key}=.*$`, 'm');
  if (keyRegex.test(text)) {
    return text.replace(keyRegex, line);
  }
  return text.endsWith('\n') ? `${text}${line}\n` : `${text}\n${line}\n`;
};

const mergeRuntimeConfigPayload = (payload = {}, baseConfig = getRuntimeConfig()) => ({
  googleClientId: payload.googleClientId ?? baseConfig.googleClientId,
  googleClientSecret: payload.googleClientSecret?.trim()
    ? payload.googleClientSecret
    : baseConfig.googleClientSecret,
  googleRedirectUri: payload.googleRedirectUri ?? baseConfig.googleRedirectUri,
  githubClientId: payload.githubClientId ?? baseConfig.githubClientId,
  githubClientSecret: payload.githubClientSecret?.trim()
    ? payload.githubClientSecret
    : baseConfig.githubClientSecret,
  githubRedirectUri: payload.githubRedirectUri ?? baseConfig.githubRedirectUri,
  frontendUrl: payload.frontendUrl ?? baseConfig.frontendUrl,
  googleGeminiProject: payload.googleGeminiProject ?? baseConfig.googleGeminiProject,
  googleGeminiApiKey: payload.googleGeminiApiKey?.trim()
    ? payload.googleGeminiApiKey
    : baseConfig.googleGeminiApiKey,
  ollamaBaseUrl: payload.ollamaBaseUrl?.trim()
    ? payload.ollamaBaseUrl.trim()
    : baseConfig.ollamaBaseUrl || DEFAULT_OLLAMA_BASE_URL,
});

const saveRuntimeConfigToEnv = (payload) => {
  const {
    googleClientId,
    googleClientSecret,
    googleRedirectUri,
    githubClientId,
    githubClientSecret,
    githubRedirectUri,
    frontendUrl,
    googleGeminiProject,
    googleGeminiApiKey,
    ollamaBaseUrl,
  } = mergeRuntimeConfigPayload(payload);

  let envText = '';
  if (fs.existsSync(ENV_FILE_PATH)) {
    envText = fs.readFileSync(ENV_FILE_PATH, 'utf8');
  }

  envText = upsertEnvValue(envText, 'GOOGLE_CLIENT_ID', googleClientId);
  envText = upsertEnvValue(envText, 'GOOGLE_CLIENT_SECRET', googleClientSecret);
  envText = upsertEnvValue(envText, 'GOOGLE_REDIRECT_URI', googleRedirectUri);
  envText = upsertEnvValue(envText, 'GITHUB_CLIENT_ID', githubClientId);
  envText = upsertEnvValue(envText, 'GITHUB_CLIENT_SECRET', githubClientSecret);
  envText = upsertEnvValue(envText, 'GITHUB_REDIRECT_URI', githubRedirectUri);
  envText = upsertEnvValue(envText, 'FRONTEND_URL', frontendUrl);
  envText = upsertEnvValue(envText, 'GOOGLE_GEMINI_PROJECT', googleGeminiProject);
  if (googleGeminiApiKey) {
    envText = upsertEnvValue(envText, 'GOOGLE_GEMINI_API_KEY', googleGeminiApiKey);
  }
  envText = upsertEnvValue(envText, 'OLLAMA_BASE_URL', ollamaBaseUrl);

  fs.writeFileSync(ENV_FILE_PATH, envText, 'utf8');
};

app.get('/auth/status', (req, res) => {
  const runtimeConfig = getRuntimeConfig();
  res.json({
    configured: {
      google: Boolean(runtimeConfig.googleClientId && runtimeConfig.googleClientSecret),
      github: Boolean(runtimeConfig.githubClientId && runtimeConfig.githubClientSecret),
    },
    google: {
      connected: Boolean(req.session.googleAuth),
      user: req.session.googleUser || null
    },
    github: {
      connected: Boolean(req.session.githubAuth),
      user: req.session.githubUser || null
    },
    copilot: {
      connected: Boolean(req.session.copilotAuth),
      user: req.session.copilotUser || null
    }
  });
});

app.get('/api/config/oauth', (req, res) => {
  const runtimeConfig = getRuntimeConfig();
  res.json({
    googleClientId: runtimeConfig.googleClientId,
    googleClientSecretConfigured: Boolean(runtimeConfig.googleClientSecret),
    googleRedirectUri: runtimeConfig.googleRedirectUri,
    githubClientId: runtimeConfig.githubClientId,
    githubClientSecretConfigured: Boolean(runtimeConfig.githubClientSecret),
    githubRedirectUri: runtimeConfig.githubRedirectUri,
    frontendUrl: runtimeConfig.frontendUrl,
    googleGeminiProject: runtimeConfig.googleGeminiProject,
    geminiApiKeyConfigured: Boolean(runtimeConfig.googleGeminiApiKey),
    ollamaBaseUrl: runtimeConfig.ollamaBaseUrl,
    configured: {
      google: Boolean(runtimeConfig.googleClientId && runtimeConfig.googleClientSecret),
      github: Boolean(runtimeConfig.githubClientId && runtimeConfig.githubClientSecret),
    },
  });
});

app.post('/api/config/oauth', (req, res) => {
  try {
    saveRuntimeConfigToEnv(req.body || {});
    applyRuntimeConfigToProcess(mergeRuntimeConfigPayload(req.body || {}));
    return res.json({ ok: true, message: 'Runtime config saved to .env and applied to the current server session.' });
  } catch (error) {
    console.error('OAuth config save error:', error);
    return res.status(500).json({ ok: false, error: 'Failed to save OAuth config', message: error.message });
  }
});

app.get('/auth/logout', (req, res) => {
  clearProviderSession(req, 'all');
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.post('/auth/logout/:provider', (req, res) => {
  const { provider } = req.params;
  if (!['google', 'github', 'copilot'].includes(provider)) {
    return res.status(400).json({ ok: false, error: 'Unknown provider' });
  }

  clearProviderSession(req, provider);
  req.session.save((error) => {
    if (error) {
      console.error('Provider logout error:', error);
      return res.status(500).json({ ok: false, error: 'Failed to clear provider session' });
    }
    return res.json({ ok: true, provider });
  });
});

app.get('/auth/google', (req, res) => {
  const runtimeConfig = getRuntimeConfig();
  if (!runtimeConfig.googleClientId || !runtimeConfig.googleClientSecret) {
    const missing = [
      !runtimeConfig.googleClientId ? 'GOOGLE_CLIENT_ID' : null,
      !runtimeConfig.googleClientSecret ? 'GOOGLE_CLIENT_SECRET' : null,
    ].filter(Boolean);
    return res.status(500).json({
      error: 'Google OAuth is not configured.',
      missing,
    });
  }

  const googleOAuthClient = createGoogleOAuthClient(runtimeConfig);
  const flowMode = req.query.mode === 'redirect' ? 'redirect' : 'popup';
  const frontendOrigin = req.query.frontendOrigin || req.headers.origin || runtimeConfig.frontendUrl;
  const stateValue = Buffer.from(JSON.stringify({ provider: 'google', mode: flowMode, frontendOrigin })).toString('base64');
  const url = googleOAuthClient.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    state: stateValue,
    scope: ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/cloud-platform']
  });
  res.redirect(url);
});

app.get('/auth/google/callback', async (req, res) => {
  const state = parseAuthState(req.query.state);
  try {
    const runtimeConfig = getRuntimeConfig();
    const googleOAuthClient = createGoogleOAuthClient(runtimeConfig);
    const code = req.query.code;
    if (!code) {
      return res.status(400).send('Google OAuth callback missing code');
    }

    const { tokens } = await googleOAuthClient.getToken(code.toString());
    req.session.googleAuth = tokens;
    googleOAuthClient.setCredentials(tokens);

    const userinfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    req.session.googleUser = normalizeGoogleUser(await userinfoResponse.json());
    return respondWithAuthCompletion(req, res, 'google', state.mode, state);
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    return respondWithAuthError(req, res, 'google', error.message || 'Ошибка авторизации Google', state.mode, state);
  }
});

const startGitHubOAuth = (req, res, callbackPath = 'github/callback') => {
  const runtimeConfig = getRuntimeConfig();
  if (!runtimeConfig.githubClientId || !runtimeConfig.githubClientSecret) {
    const missing = [
      !runtimeConfig.githubClientId ? 'GITHUB_CLIENT_ID' : null,
      !runtimeConfig.githubClientSecret ? 'GITHUB_CLIENT_SECRET' : null,
    ].filter(Boolean);
    return res.status(500).json({ error: 'GitHub OAuth is not configured.', missing });
  }

  const flowMode = req.query.mode === 'redirect' ? 'redirect' : 'popup';
  const frontendOrigin = req.query.frontendOrigin || req.headers.origin || runtimeConfig.frontendUrl;
  const stateValue = Buffer.from(JSON.stringify({ provider: 'github', mode: flowMode, frontendOrigin })).toString('base64');
  const redirectUri = runtimeConfig.githubRedirectUri || `http://localhost:${port}/auth/${callbackPath}`;
  const params = new URLSearchParams({
    client_id: runtimeConfig.githubClientId,
    redirect_uri: redirectUri,
    scope: 'read:user user:email',
    state: stateValue,
    allow_signup: 'true'
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
};

const handleGitHubCallback = async (req, res, callbackPath = 'github/callback') => {
  const state = parseAuthState(req.query.state);
  try {
    const runtimeConfig = getRuntimeConfig();
    const code = req.query.code;
    if (!code) {
      return res.status(400).send('GitHub OAuth callback missing code');
    }

    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: runtimeConfig.githubClientId,
        client_secret: runtimeConfig.githubClientSecret,
        code: code.toString(),
        redirect_uri: runtimeConfig.githubRedirectUri || `http://localhost:${port}/auth/${callbackPath}`
      })
    });

    const tokenData = await tokenResponse.json();
    if (tokenData.error) {
      throw new Error(tokenData.error_description || tokenData.error);
    }

    req.session.githubAuth = tokenData;
    req.session.copilotAuth = tokenData;
    const profileResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'User-Agent': 'omni-todo'
      }
    });
    const profile = normalizeGitHubUser(await profileResponse.json());
    req.session.githubUser = profile;
    req.session.copilotUser = profile;
    return respondWithAuthCompletion(req, res, 'github', state.mode, state);
  } catch (error) {
    console.error('GitHub OAuth callback error:', error);
    return respondWithAuthError(req, res, 'github', error.message || 'Ошибка авторизации GitHub', state.mode, state);
  }
};

app.get('/auth/copilot', (req, res) => startGitHubOAuth(req, res, 'copilot/callback'));

app.get('/auth/copilot/callback', async (req, res) => handleGitHubCallback(req, res, 'copilot/callback'));

app.get('/auth/github', (req, res) => startGitHubOAuth(req, res, 'github/callback'));

app.get('/auth/github/callback', async (req, res) => handleGitHubCallback(req, res, 'github/callback'));

app.post('/api/gemini', async (req, res) => {
  try {
    const runtimeConfig = getRuntimeConfig();
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Промпт обязателен' });
    }

    if (!req.session.googleAuth?.access_token) {
      return res.status(401).json({ error: 'Google OAuth требуется для Gemini' });
    }

    if (!runtimeConfig.googleGeminiProject) {
      return res.status(500).json({
        error: 'Google Gemini project is not configured',
        missing: ['GOOGLE_GEMINI_PROJECT'],
      });
    }

    const response = await fetch(`https://us-central1-aiplatform.googleapis.com/v1/projects/${runtimeConfig.googleGeminiProject}/locations/${runtimeConfig.googleGeminiLocation}/publishers/${runtimeConfig.googleGeminiPublisher}/models/${runtimeConfig.googleGeminiModel}:predict`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${req.session.googleAuth.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { temperature: 0.7, maxOutputTokens: 512 }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Ошибка Gemini', details: data });
    }

    res.json(data);
  } catch (error) {
    console.error('Gemini API Error:', error);
    res.status(500).json({ error: 'Внутренняя ошибка Gemini API', message: error.message });
  }
});

app.post('/api/gemini/chat', async (req, res) => {
  try {
    const runtimeConfig = getRuntimeConfig();
    const { text, history = [] } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Текст запроса обязателен' });
    }

    const contents = [];
    for (const msg of history) {
      if (msg.role === 'user') {
        contents.push({ role: 'user', parts: [{ text: msg.content }] });
      } else if (msg.role === 'assistant') {
        contents.push({ role: 'model', parts: [{ text: msg.content }] });
      }
    }
    contents.push({ role: 'user', parts: [{ text }] });

    let apiUrl;
    const headers = { 'Content-Type': 'application/json' };
    let modelName = runtimeConfig.googleGeminiChatModel || 'gemini-2.0-flash';

    if (runtimeConfig.googleGeminiApiKey) {
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${runtimeConfig.googleGeminiApiKey}`;
    } else if (req.session.googleAuth?.access_token && runtimeConfig.googleGeminiProject) {
      const loc = runtimeConfig.googleGeminiLocation || 'us-central1';
      const vertexModel = modelName.includes('-00') ? modelName : `${modelName}-001`;
      apiUrl = `https://${loc}-aiplatform.googleapis.com/v1/projects/${runtimeConfig.googleGeminiProject}/locations/${loc}/publishers/google/models/${vertexModel}:generateContent`;
      headers['Authorization'] = `Bearer ${req.session.googleAuth.access_token}`;
    } else if (req.session.googleAuth?.access_token) {
      return res.status(500).json({ error: 'GOOGLE_GEMINI_PROJECT не настроен', missing: ['GOOGLE_GEMINI_PROJECT'] });
    } else {
      return res.status(401).json({ error: 'Необходим Gemini API Key или авторизация Google OAuth', missing: ['GOOGLE_GEMINI_API_KEY'] });
    }

    const geminiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ contents }),
    });

    const data = await geminiResponse.json();
    if (!geminiResponse.ok) {
      return res.status(geminiResponse.status).json({ error: 'Ошибка Gemini API', details: data });
    }

    const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return res.json({ response: responseText, model: modelName });
  } catch (error) {
    console.error('Gemini Chat Error:', error);
    return res.status(500).json({ error: 'Ошибка Gemini Chat', message: error.message });
  }
});

app.post('/api/github/repos', async (req, res) => {
  try {
    if (!req.session.githubAuth?.access_token) {
      return res.status(401).json({ error: 'GitHub OAuth требуется' });
    }

    const response = await fetch('https://api.github.com/user/repos?per_page=20', {
      headers: {
        Authorization: `Bearer ${req.session.githubAuth.access_token}`,
        'User-Agent': 'omni-todo'
      }
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Ошибка GitHub', details: data });
    }

    res.json(data);
  } catch (error) {
    console.error('GitHub repos error:', error);
    res.status(500).json({ error: 'Внутренняя ошибка GitHub', message: error.message });
  }
});

app.get('/api/ollama/models', async (req, res) => {
  try {
    const runtimeConfig = getRuntimeConfig();
    const response = await fetch(buildServiceUrl(runtimeConfig.ollamaBaseUrl, '/api/tags'));
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Не удалось получить список моделей Ollama', details: data });
    }

    return res.json({ models: normalizeOllamaModels(data) });
  } catch (error) {
    console.error('Ollama models error:', error);
    return res.status(502).json({
      error: 'Не удалось подключиться к Ollama',
      message: error.message,
    });
  }
});

app.post('/api/ollama', async (req, res) => {
  try {
    const runtimeConfig = getRuntimeConfig();
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    const model = typeof req.body?.model === 'string' ? req.body.model.trim() : '';

    if (!prompt) {
      return res.status(400).json({ error: 'Промпт обязателен' });
    }

    if (!model) {
      return res.status(400).json({ error: 'Название модели обязательно' });
    }

    const response = await fetch(buildServiceUrl(runtimeConfig.ollamaBaseUrl, '/api/generate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Ошибка Ollama', details: data });
    }

    return res.json({
      model: data.model || model,
      response: data.response || data.message?.content || '',
      done: Boolean(data.done),
      doneReason: data.done_reason || null,
      raw: data,
    });
  } catch (error) {
    console.error('Ollama generation error:', error);
    return res.status(502).json({
      error: 'Не удалось выполнить запрос к Ollama',
      message: error.message,
    });
  }
});

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
          text: text
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
      const errorMessage = data?.error?.message || data?.error?.status || 'Ошибка API';
      return res.status(response.status).json({ error: errorMessage, details: data });
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

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get(/.*/, (req, res) => {
  const __dirname = path.resolve();
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`OMNI Cloud Proxy Server is running on http://0.0.0.0:${port}`);
});
