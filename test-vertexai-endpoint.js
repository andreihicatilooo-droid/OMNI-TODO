import { GoogleAuth } from 'google-auth-library';

// Dedicated Endpoint ID из результатов деплоя
const ENDPOINT_ID = 'mg-endpoint-6305fba2-7460-4baa-bb69-45d791b965c2';
const PROJECT_ID = 'cerber-495808';
const REGION = 'europe-west4';

async function queryModel() {
  try {
    const auth = new GoogleAuth({
      scopes: 'https://www.googleapis.com/auth/cloud-platform'
    });

    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const token = tokenResponse.token;
    
    // Dedicated Endpoint DNS, полученный из gcloud
    const dedicatedDns = 'mg-endpoint-6305fba2-7460-4baa-bb69-45d791b965c2.europe-west4-334404516833.prediction.vertexai.goog';
    const url = `https://${dedicatedDns}/v1beta1/projects/${PROJECT_ID}/locations/${REGION}/endpoints/${ENDPOINT_ID}:rawPredict`;

    console.log(`Отправка запроса к Endpoint ${ENDPOINT_ID}...`);

    // Формат запроса для этой модели требует поля "prompt"
    const requestBody = {
      instances: [
        {
          prompt: "Привет! Расскажи короткую шутку про программистов.",
          max_tokens: 256,
          temperature: 0.7
        }
      ]
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error("Ошибка API:", JSON.stringify(data, null, 2));
      return;
    }

    console.log("\nОтвет модели:");
    if (data.choices && data.choices[0] && data.choices[0].message) {
      console.log(data.choices[0].message.content);
    } else {
      console.log(JSON.stringify(data, null, 2));
    }

  } catch (error) {
    console.error("Ошибка при выполнении запроса:", error);
  }
}

queryModel();
