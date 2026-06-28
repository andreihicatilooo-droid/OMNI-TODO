import { GoogleGenAI } from '@google/genai';
import { OAuth2Client } from 'google-auth-library';
const authClient = new OAuth2Client();
authClient.setCredentials({ access_token: "ya29.fake" });
const ai = new GoogleGenAI({ vertexai: true, project: 'test', location: 'us-central1', authClient });
console.log(ai.models.generateContent ? "OK" : "FAIL");
