# AnyType Integration Guide

## Overview

OMNI-TODO now includes full integration with AnyType, a local-first, end-to-end encrypted personal workspace. This integration provides:

1. **Challenge-Based Authentication** - Secure connection using AnyType's native challenge-response flow
2. **Vault Backend Storage** - Store your encrypted vault data in AnyType spaces
3. **Bidirectional Sync** - Sync your OMNI items to AnyType as individual objects
4. **Local-First Architecture** - All data stays on your device, nothing synced to cloud

## Prerequisites

1. **AnyType Desktop App** (v0.46.6 or later)
   - Download from [https://anytype.io](https://anytype.io)
   - Must be running while using the integration
   - API runs on `http://localhost:31009`

2. **OMNI-TODO Server** must be configured to communicate with the local AnyType API

## Setup Instructions

### Step 1: Start AnyType Desktop Application

1. Download and install AnyType from [https://anytype.io](https://anytype.io)
2. Open the application and create/open your workspace
3. The local API will automatically start on `http://localhost:31009`

### Step 2: Connect OMNI-TODO to AnyType

1. Open the OMNI-TODO application
2. Go to **Settings** → **Data & Storage**
3. Scroll to **AnyType Integration**
4. Click **"Подключить AnyType"** (Connect to AnyType)

### Step 3: Complete Challenge-Based Authentication

1. Click the Connect button
2. AnyType will generate a 4-digit code displayed in your desktop app
3. Enter the code in the OMNI-TODO interface (exactly 4 digits)
4. Click "Подтвердить" (Confirm)

### Step 4: Select Workspace and Sync

1. Choose which AnyType space to sync your vault to
2. Click **"Синхронизировать"** (Sync) to create/update your vault object
3. Your data will be stored as an encrypted object in AnyType

## Architecture

### Authentication Flow

```
OMNI-TODO Client
    ↓
POST /api/anytype/challenge
    ↓ (returns challenge_id)
AnyType Desktop App
    ↓ (user enters 4-digit code)
POST /api/anytype/exchange-code
    ↓ (returns API token)
OMNI Server
    ↓ (stores token in session)
Ready for API calls
```

### Data Sync Flow

```
OMNI State (items, projects, mindmaps, etc.)
    ↓
POST /api/anytype/vault/create
    ↓
AnyType API (localhost:31009)
    ↓
Creates/Updates object in selected space
    ↓
Local AnyType Database (encrypted)
```

## API Endpoints

### Authentication

- **POST** `/api/anytype/check`
  - Check if AnyType API is available
  - No auth required
  - Response: `{ available: boolean }`

- **POST** `/api/anytype/challenge`
  - Initiate authentication challenge
  - Body: `{ appName?: string }`
  - Response: `{ ok: boolean, challengeId: string }`

- **POST** `/api/anytype/exchange-code`
  - Exchange challenge code for API token
  - Body: `{ challengeId: string, code: number }`
  - Response: `{ ok: boolean, token: string }`

### Workspace Management

- **GET** `/api/anytype/spaces`
  - List available AnyType spaces
  - Auth: Bearer token (session)
  - Response: `{ ok: boolean, spaces: Space[] }`

### Vault Storage

- **POST** `/api/anytype/vault/create`
  - Create new vault object in space
  - Body: `{ spaceId: string, vaultData: object }`
  - Response: `{ ok: boolean, objectId: string }`

- **PATCH** `/api/anytype/vault/:objectId`
  - Update existing vault object
  - Body: `{ spaceId: string, vaultData: object }`
  - Response: `{ ok: boolean }`

- **GET** `/api/anytype/vault/:spaceId/:objectId`
  - Retrieve vault data from object
  - Response: `{ ok: boolean, vaultData: object }`

### Data Sync

- **POST** `/api/anytype/sync-items`
  - Create individual AnyType objects for each OMNI item
  - Body: `{ spaceId: string, items: Item[] }`
  - Response: `{ ok: boolean, results: SyncResult[] }`

### Disconnection

- **POST** `/api/anytype/disconnect`
  - Disconnect from AnyType (clears session)
  - Response: `{ ok: boolean }`

## Feature Overview

### 1. Vault Storage Backend

Your encrypted vault can be stored in AnyType:
- Creates a "OMNI Vault" object in your selected space
- Stores entire state as JSON in the object body
- Preserves encryption during sync
- Can be updated on each save

### 2. Item Synchronization

Individual items can be synced as AnyType objects:
- Tasks → AnyType "todo" type objects
- Ideas/Notes → AnyType "note" type objects
- Preserves titles, descriptions, status, priority
- Allows further editing in AnyType

### 3. Multi-Space Support

Connect to different AnyType spaces for different purposes:
- Personal workspace vault
- Work-related items in another space
- Backup vault in a separate space

## Important Notes

### Local-First Architecture
- AnyType API runs **only on localhost:31009**
- Requires AnyType desktop app to be running
- No cloud sync (data stays on your device)
- Perfect for private, encrypted workflows

### Data Security
- All data is end-to-end encrypted by AnyType
- API tokens are stored in session (not persistent)
- No credentials exposed to external services
- All operations happen locally on your machine

### Rate Limiting
- No documented rate limits for local API
- Performance depends on your local system
- Suitable for personal use cases

## Troubleshooting

### "AnyType API не доступен" (API Not Available)

**Problem**: Connection refused on localhost:31009

**Solutions**:
1. Ensure AnyType desktop app is running
2. Check that it's version 0.46.6 or later
3. Verify no other app is using port 31009
4. Try restarting both AnyType and OMNI-TODO

### Challenge Code Doesn't Work

**Problem**: "Code exchange failed"

**Solutions**:
1. Make sure you're entering exactly 4 digits
2. Code expires after ~5 minutes, start new challenge if needed
3. Verify AnyType app is still open
4. Try creating a new challenge

### Sync Failed

**Problem**: "Sync failed" error when syncing vault

**Solutions**:
1. Verify you've selected a space
2. Check AnyType app is still running
3. Ensure your vault data is valid JSON
4. Try disconnecting and reconnecting

### Port Already in Use

**Problem**: Another app is using localhost:31009

**Solutions**:
1. Kill the other process: `lsof -i :31009 | kill -9`
2. Change AnyType settings to use different port
3. Restart your system

## Advanced Usage

### Manual API Calls

You can make direct API calls to AnyType using the provided endpoints:

```bash
# Check availability
curl -X POST http://localhost:3001/api/anytype/check

# Create vault
curl -X POST http://localhost:3001/api/anytype/vault/create \
  -H "Content-Type: application/json" \
  -d '{"spaceId":"...", "vaultData":{...}}'
```

### Client Library

Use the provided `src/lib/anytype.js` for client-side integration:

```javascript
import {
  checkAnytypeConnectivity,
  initiateAnytypeChallenge,
  exchangeAnytypeChallengeForToken,
  getAnytypeSpaces,
  createAnytypeVaultObject,
  syncItemsToAnytype
} from './src/lib/anytype.js';

// Example: Check connectivity
const isAvailable = await checkAnytypeConnectivity();
```

## Integration with Other Backends

AnyType can be used alongside other storage backends:

- **Google Drive**: Cloud backup of vault structure
- **File System (FS)**: Local file-based vault
- **AnyType**: Local-first workspace sync
- **localStorage**: Fallback browser storage

Priority: Drive → FS → AnyType → localStorage

## Resources

- [AnyType Official Website](https://anytype.io)
- [AnyType Developer Portal](https://developers.anytype.io)
- [AnyType API Docs](https://developers.anytype.io/docs/reference)
- [Authentication Guide](https://developers.anytype.io/docs/guides/get-started/authentication)
- [Local API Documentation](https://doc.anytype.io/anytype-docs/advanced/feature-list-by-platform/local-api)

## Support

For issues with:
- **AnyType app**: Visit [https://anytype.io/support](https://anytype.io/support)
- **OMNI-TODO integration**: Check logs in browser console
- **API connectivity**: Verify AnyType app is running on localhost:31009

## License

AnyType is open source. OMNI-TODO's AnyType integration is built using their open API.
