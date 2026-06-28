// AnyType integration library
// Local-first API for syncing OMNI-TODO data with AnyType workspace

const ANYTYPE_API_BASE = 'http://localhost:31009/api';
const ANYTYPE_TOKEN_KEY = 'anytype_api_token';
const ANYTYPE_SPACE_ID_KEY = 'anytype_space_id';

// Load stored AnyType credentials from localStorage
export const loadAnytypeCredentials = () => {
  try {
    const token = localStorage.getItem(ANYTYPE_TOKEN_KEY);
    const spaceId = localStorage.getItem(ANYTYPE_SPACE_ID_KEY);
    return { token, spaceId };
  } catch {
    return { token: null, spaceId: null };
  }
};

// Save AnyType credentials to localStorage
export const saveAnytypeCredentials = (token, spaceId) => {
  try {
    localStorage.setItem(ANYTYPE_TOKEN_KEY, token);
    localStorage.setItem(ANYTYPE_SPACE_ID_KEY, spaceId);
  } catch (e) {
    console.error('Failed to save AnyType credentials:', e.message);
  }
};

// Clear stored AnyType credentials
export const clearAnytypeCredentials = () => {
  try {
    localStorage.removeItem(ANYTYPE_TOKEN_KEY);
    localStorage.removeItem(ANYTYPE_SPACE_ID_KEY);
  } catch (e) {
    console.error('Failed to clear AnyType credentials:', e.message);
  }
};

// Check if AnyType API is accessible
export const checkAnytypeConnectivity = async () => {
  try {
    const response = await fetch(`${ANYTYPE_API_BASE}/v1/spaces`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    return response.status < 400;
  } catch {
    return false;
  }
};

// Initiate authentication challenge
export const initiateAnytypeChallenge = async (appName = 'OMNI-TODO') => {
  try {
    const response = await fetch(`${ANYTYPE_API_BASE}/v1/auth/challenges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appName })
    });

    if (!response.ok) {
      throw new Error(`Challenge failed: ${response.statusText}`);
    }

    const data = await response.json();
    return { challengeId: data.challenge_id, success: true };
  } catch (e) {
    console.error('Challenge initiation error:', e.message);
    return { challengeId: null, success: false, error: e.message };
  }
};

// Exchange challenge code for API key
export const exchangeAnytypeChallengeForToken = async (challengeId, code) => {
  try {
    const response = await fetch(`${ANYTYPE_API_BASE}/v1/auth/api_keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challenge_id: challengeId,
        code: String(code).padStart(4, '0')
      })
    });

    if (!response.ok) {
      throw new Error(`Code exchange failed: ${response.statusText}`);
    }

    const data = await response.json();
    return { apiKey: data.api_key, success: true };
  } catch (e) {
    console.error('Code exchange error:', e.message);
    return { apiKey: null, success: false, error: e.message };
  }
};

// Get user's spaces
export const getAnytypeSpaces = async (token) => {
  try {
    const response = await fetch(`${ANYTYPE_API_BASE}/v1/spaces`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) throw new Error(`Failed to fetch spaces: ${response.statusText}`);

    const data = await response.json();
    return { spaces: data.spaces || [], success: true };
  } catch (e) {
    console.error('Get spaces error:', e.message);
    return { spaces: [], success: false, error: e.message };
  }
};

// Create OMNI vault object in AnyType
export const createAnytypeVaultObject = async (token, spaceId, vaultData) => {
  try {
    const vaultContent = JSON.stringify(vaultData, null, 2);

    const response = await fetch(`${ANYTYPE_API_BASE}/v1/spaces/${spaceId}/objects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: `OMNI Vault - ${new Date().toLocaleDateString()}`,
        type: 'note',
        properties: {
          description: 'OMNI-TODO vault backup'
        },
        body: vaultContent
      })
    });

    if (!response.ok) throw new Error(`Failed to create vault: ${response.statusText}`);

    const data = await response.json();
    return { objectId: data.id, success: true };
  } catch (e) {
    console.error('Create vault error:', e.message);
    return { objectId: null, success: false, error: e.message };
  }
};

// Update existing OMNI vault object
export const updateAnytypeVaultObject = async (token, spaceId, objectId, vaultData) => {
  try {
    const vaultContent = JSON.stringify(vaultData, null, 2);

    const response = await fetch(`${ANYTYPE_API_BASE}/v1/spaces/${spaceId}/objects/${objectId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        body: vaultContent
      })
    });

    if (!response.ok) throw new Error(`Failed to update vault: ${response.statusText}`);

    return { success: true };
  } catch (e) {
    console.error('Update vault error:', e.message);
    return { success: false, error: e.message };
  }
};

// Sync OMNI items to AnyType (create individual task objects)
export const syncItemsToAnytype = async (token, spaceId, items) => {
  const results = [];

  for (const item of items) {
    try {
      const response = await fetch(`${ANYTYPE_API_BASE}/v1/spaces/${spaceId}/objects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: item.title || 'Untitled',
          type: item.type === 'task' ? 'todo' : 'note',
          properties: {
            status: item.status || 'open',
            priority: item.priority || 'medium',
            created: item.created || new Date().toISOString()
          },
          body: item.description || ''
        })
      });

      if (response.ok) {
        const data = await response.json();
        results.push({ itemId: item.id, anytypeId: data.id, success: true });
      } else {
        results.push({ itemId: item.id, success: false, error: response.statusText });
      }
    } catch (e) {
      results.push({ itemId: item.id, success: false, error: e.message });
    }
  }

  return results;
};

// Retrieve vault data from AnyType
export const retrieveAnytypeVault = async (token, spaceId, objectId) => {
  try {
    const response = await fetch(`${ANYTYPE_API_BASE}/v1/spaces/${spaceId}/objects/${objectId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) throw new Error(`Failed to retrieve vault: ${response.statusText}`);

    const data = await response.json();
    const vaultData = JSON.parse(data.body || '{}');
    return { vaultData, success: true };
  } catch (e) {
    console.error('Retrieve vault error:', e.message);
    return { vaultData: null, success: false, error: e.message };
  }
};

// List OMNI vault objects in AnyType
export const listAnytypeVaults = async (token, spaceId) => {
  try {
    const response = await fetch(`${ANYTYPE_API_BASE}/v1/spaces/${spaceId}/objects?filter=name:OMNI`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) throw new Error(`Failed to list vaults: ${response.statusText}`);

    const data = await response.json();
    return { objects: data.objects || [], success: true };
  } catch (e) {
    console.error('List vaults error:', e.message);
    return { objects: [], success: false, error: e.message };
  }
};

// Test AnyType connection with credentials
export const testAnytypeConnection = async (token) => {
  try {
    const response = await fetch(`${ANYTYPE_API_BASE}/v1/spaces`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      return { connected: false, error: `Authentication failed: ${response.statusText}` };
    }

    const data = await response.json();
    const defaultSpace = data.spaces?.[0];

    if (!defaultSpace) {
      return { connected: false, error: 'No spaces found' };
    }

    return {
      connected: true,
      spaceId: defaultSpace.id,
      spaceName: defaultSpace.name,
      accountInfo: `Space: ${defaultSpace.name}`
    };
  } catch (e) {
    return { connected: false, error: e.message };
  }
};
