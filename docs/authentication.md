# Authentication

The XiansAi SDK supports two authentication methods: **API Keys** and **JWT Tokens**. Choose the method that best fits your security requirements and deployment architecture.

## Authentication Methods Comparison

| Aspect | API Key | JWT Token |
|--------|---------|-----------|
| **Use Case** | Server-to-server | Web applications with user context |
| **Security Model** | Pre-shared secret | Signed, time-limited tokens |
| **User Context** | System-level | User-specific |
| **Expiration** | No expiration | Time-limited |
| **Revocation** | Manual key rotation | Automatic token expiration |
| **Implementation** | Simple | Requires token refresh logic |
| **SDK Support** | All SDKs | All SDKs (with browser limitations) |

## API Key Authentication

### Overview

API keys are pre-shared secrets suitable for server-to-server communication where user context isn't required.

### Security Considerations

- **Storage**: Store API keys securely (environment variables, key vaults)
- **Transmission**: Always use HTTPS to protect keys in transit
- **Rotation**: Implement regular key rotation policies
- **Scope**: Use tenant-specific keys to limit access scope

### Implementation

#### Basic Setup

```typescript
import { RestSDK, SocketSDK, SseSDK } from 'xiansai-sdk';

const config = {
  tenantId: 'your-tenant-id',
  apiKey: 'sk-your-api-key-here',
  serverUrl: 'https://api.yourdomain.com'
};

// Works with all SDKs
const restSDK = new RestSDK(config);
const socketSDK = new SocketSDK(config);
const sseSDK = new SseSDK(config);
```

#### Environment Variables

```typescript
// Recommended: Use environment variables
const config = {
  tenantId: process.env.XIANSAI_TENANT_ID!,
  apiKey: process.env.XIANSAI_API_KEY!,
  serverUrl: process.env.XIANSAI_SERVER_URL!
};
```

### How API Key Authentication Works

#### REST SDK

```typescript
// API key is sent as 'apikey' query parameter
// GET /api/user/rest/history?tenantId=tenant&apikey=sk-key&workflow=wf&participantId=user
```

#### Socket SDK

```typescript
// API key is sent as 'apikey' query parameter in WebSocket URL
// wss://api.yourdomain.com/ws/chat?tenantId=tenant&apikey=sk-key
```

#### SSE SDK

```typescript
// API key is sent as 'apikey' query parameter in EventSource URL
// https://api.yourdomain.com/api/user/sse/events?tenantId=tenant&apikey=sk-key&workflow=wf
```

## JWT Token Authentication

### Overview (JWT)

JWT tokens provide user-specific authentication with time-limited access, ideal for web applications using OpenID Connect or similar authentication systems.

### Security Considerations (JWT)

- **Token Storage**: Use secure storage (HttpOnly cookies, secure storage)
- **Expiration**: Implement token refresh before expiration
- **Validation**: Server validates token signature and claims
- **Scope**: Tokens should include tenant and user context

### Implementation Patterns

#### Static Token

```typescript
const config = {
  tenantId: 'your-tenant-id',
  jwtToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  serverUrl: 'https://api.yourdomain.com'
};

const sdk = new RestSDK(config);
```

#### Dynamic Token (Recommended)

```typescript
const config = {
  tenantId: 'your-tenant-id',
  getJwtToken: async () => {
    // Fetch fresh token from your auth system
    const response = await fetch('/api/auth/token', {
      credentials: 'include' // Include cookies for session
    });
    const { accessToken } = await response.json();
    return accessToken;
  },
  serverUrl: 'https://api.yourdomain.com'
};

const sdk = new SocketSDK(config);
```

#### With Token Refresh

```typescript
class TokenManager {
  private token: string | null = null;
  private refreshPromise: Promise<string> | null = null;

  async getToken(): Promise<string> {
    if (this.token && !this.isTokenExpired(this.token)) {
      return this.token;
    }

    if (this.refreshPromise) {
      return await this.refreshPromise;
    }

    this.refreshPromise = this.refreshToken();
    try {
      this.token = await this.refreshPromise;
      return this.token;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async refreshToken(): Promise<string> {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error('Token refresh failed');
    }
    
    const { accessToken } = await response.json();
    return accessToken;
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return Date.now() >= payload.exp * 1000;
    } catch {
      return true;
    }
  }
}

const tokenManager = new TokenManager();

const config = {
  tenantId: 'your-tenant-id',
  getJwtToken: () => tokenManager.getToken(),
  serverUrl: 'https://api.yourdomain.com'
};
```

### How JWT Authentication Works

#### REST

```typescript
// JWT is sent as Authorization Bearer header
// Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Socket

```typescript
// JWT is sent via SignalR accessTokenFactory
// The token is included in the Authorization header for WebSocket connections
```

#### SSE

```typescript
// JWT authentication with EventSource has browser limitations
// Falls back to 'access_token' query parameter if headers aren't supported
// https://api.yourdomain.com/api/user/sse/events?access_token=jwt-token...
```

## Browser Compatibility

### EventSource Header Limitations

Some browsers don't support custom headers with EventSource. The SSE SDK handles this by:

1. **Preferred**: Try to use Authorization header
2. **Fallback**: Use `access_token` query parameter

```typescript
// SSE SDK automatically handles browser compatibility
const sseSDK = new SseSDK({
  tenantId: 'your-tenant-id',
  getJwtToken: async () => await getToken(),
  serverUrl: 'https://api.yourdomain.com'
});
```

## Authentication Updates

All SDKs support dynamic authentication updates:

### Update API Key

```typescript
sdk.updateApiKey('sk-new-api-key');
// Automatically reconnects if currently connected
```

### Update JWT Token

```typescript
sdk.updateJwtToken('new-jwt-token');
// Automatically reconnects if currently connected
```

### Update JWT Callback

```typescript
sdk.updateJwtTokenCallback(async () => {
  return await getNewTokenFromSomewhere();
});
// Automatically reconnects if currently connected
```

## Error Handling

### Authentication Failures

```typescript
const sdk = new RestSDK({
  tenantId: 'your-tenant-id',
  getJwtToken: async () => {
    try {
      return await fetchToken();
    } catch (error) {
      console.error('Token fetch failed:', error);
      throw new Error('Authentication failed');
    }
  },
  serverUrl: 'https://api.yourdomain.com'
});

// Handle authentication errors
const result = await sdk.send({ /* request */ });
if (!result.success) {
  if (result.statusCode === 401) {
    console.error('Authentication failed:', result.error);
    // Redirect to login or refresh token
  }
}
```

### Real-time SDK Error Handling

```typescript
const socketSDK = new SocketSDK({
  tenantId: 'your-tenant-id',
  getJwtToken: async () => await getToken(),
  eventHandlers: {
    onConnectionError: (error) => {
      if (error.statusCode === 401) {
        console.error('Authentication failed');
        // Handle authentication failure
      }
    },
    onError: (error) => {
      console.error('SDK error:', error);
    }
  }
});
```

## Best Practices

### 1. Choose the Right Method

- **API Keys**: Use for server-to-server, automated systems
- **JWT Tokens**: Use for web applications with user sessions

### 2. Secure Storage

```typescript
// ❌ Don't hardcode credentials
const apiKey = 'sk-1234567890';

// ✅ Use environment variables
const apiKey = process.env.XIANSAI_API_KEY;

// ✅ Use secure token storage in browsers
const getToken = async () => {
  // Get from secure storage or refresh endpoint
  return await secureTokenStorage.getToken();
};
```

### 3. Handle Token Expiration

```typescript
// ✅ Implement proper token refresh
const config = {
  getJwtToken: async () => {
    const token = await getCurrentToken();
    if (isTokenExpired(token)) {
      return await refreshToken();
    }
    return token;
  }
};
```

### 4. Error Recovery

```typescript
// ✅ Handle authentication errors gracefully
const sdk = new SocketSDK({
  eventHandlers: {
    onConnectionError: (error) => {
      if (error.statusCode === 401) {
        // Clear invalid tokens and redirect to login
        clearTokens();
        redirectToLogin();
      }
    }
  }
});
```

## Next Steps

- [Message Types](./message-types.md) - Understand message structures
- [REST SDK](./rest-sdk.md) - HTTP-based communication
- [Socket SDK](./socket-sdk.md) - Real-time bidirectional communication
- [SSE SDK](./sse-sdk.md) - Server-sent events
