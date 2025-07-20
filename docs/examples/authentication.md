# Authentication Examples

This guide provides practical examples for setting up authentication with API keys and JWT tokens across all XiansAi SDKs.

## API Key Authentication

API keys are ideal for server-to-server communication and provide simple, reliable authentication.

### Environment Setup

```bash
# .env file
XIANSAI_TENANT_ID=your-tenant-id
XIANSAI_API_KEY=sk-your-api-key-here
XIANSAI_SERVER_URL=https://api.yourdomain.com
```

### Basic API Key Setup

```typescript
import { RestSDK, SocketSDK, SseSDK } from 'xiansai-sdk';

const config = {
  tenantId: process.env.XIANSAI_TENANT_ID!,
  apiKey: process.env.XIANSAI_API_KEY!,
  serverUrl: process.env.XIANSAI_SERVER_URL!
};

// Works with all SDKs
const restSDK = new RestSDK(config);
const socketSDK = new SocketSDK(config);
const sseSDK = new SseSDK(config);
```

### Server-to-Server Integration Example

```typescript
class ServerIntegration {
  private restSDK: RestSDK;
  
  constructor() {
    this.restSDK = new RestSDK({
      tenantId: process.env.XIANSAI_TENANT_ID!,
      apiKey: process.env.XIANSAI_API_KEY!,
      serverUrl: process.env.XIANSAI_SERVER_URL!,
      logger: (level, message, data) => {
        console.log(`[${level.toUpperCase()}] ${message}`, data || '');
      }
    });
  }

  async processUserRequest(userId: string, requestData: any) {
    try {
      const result = await this.restSDK.converse({
        workflow: 'user-request-processor',
        type: 'Data',
        participantId: userId,
        data: {
          requestType: requestData.type,
          payload: requestData.payload,
          timestamp: new Date().toISOString()
        },
        timeoutSeconds: 60
      });

      if (result.success && result.data) {
        console.log(`Request processed for user ${userId}`);
        return result.data;
      } else {
        throw new Error(result.error || 'Processing failed');
      }
    } catch (error) {
      console.error(`Failed to process request for user ${userId}:`, error);
      throw error;
    }
  }

  async batchProcess(requests: Array<{userId: string, data: any}>) {
    const promises = requests.map(req => 
      this.processUserRequest(req.userId, req.data)
    );
    
    return await Promise.allSettled(promises);
  }
}

// Usage
const integration = new ServerIntegration();
await integration.processUserRequest('user-123', {
  type: 'data_analysis',
  payload: { dataset: 'sales_data_q4.csv' }
});
```

### API Key Rotation Example

```typescript
class ApiKeyManager {
  private currentSDK: RestSDK;
  private keyRotationInterval: NodeJS.Timeout;

  constructor() {
    this.currentSDK = new RestSDK({
      tenantId: process.env.XIANSAI_TENANT_ID!,
      apiKey: process.env.XIANSAI_API_KEY!,
      serverUrl: process.env.XIANSAI_SERVER_URL!
    });

    // Rotate key every 24 hours (adjust as needed)
    this.keyRotationInterval = setInterval(() => {
      this.rotateApiKey();
    }, 24 * 60 * 60 * 1000);
  }

  private async rotateApiKey() {
    try {
      // Fetch new API key from your key management system
      const newApiKey = await this.fetchNewApiKey();
      
      // Update the SDK with new key
      this.currentSDK.updateApiKey(newApiKey);
      
      console.log('API key rotated successfully');
    } catch (error) {
      console.error('Failed to rotate API key:', error);
      // Implement your error handling strategy
    }
  }

  private async fetchNewApiKey(): Promise<string> {
    // Implement your key rotation logic
    // This could involve calling your key management API
    const response = await fetch('/internal/api/rotate-key', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.INTERNAL_API_TOKEN}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch new API key');
    }
    
    const { apiKey } = await response.json();
    return apiKey;
  }

  getSDK(): RestSDK {
    return this.currentSDK;
  }

  dispose() {
    if (this.keyRotationInterval) {
      clearInterval(this.keyRotationInterval);
    }
  }
}
```

## JWT Token Authentication

JWT tokens are ideal for web applications where you need user-specific authentication and token expiration.

### Static JWT Token

```typescript
// Use when you have a long-lived token
const config = {
  tenantId: 'your-tenant-id',
  jwtToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  serverUrl: 'https://api.yourdomain.com'
};

const restSDK = new RestSDK(config);
```

### Dynamic JWT Token (Recommended)

```typescript
import { SocketSDK } from 'xiansai-sdk';

class WebAppAuthentication {
  private socketSDK: SocketSDK;
  
  constructor() {
    this.socketSDK = new SocketSDK({
      tenantId: 'your-tenant-id',
      getJwtToken: this.getJwtToken.bind(this),
      serverUrl: 'https://api.yourdomain.com',
      eventHandlers: {
        onConnected: () => {
          console.log('Connected with fresh JWT token');
        },
        onConnectionError: (error) => {
          if (error.statusCode === 401) {
            console.log('JWT token expired, will refresh on next request');
            this.handleAuthenticationError();
          }
        }
      }
    });
  }

  private async getJwtToken(): Promise<string> {
    try {
      // Get token from your authentication system
      const response = await fetch('/api/auth/token', {
        credentials: 'include', // Include cookies for session
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired, redirect to login
          this.redirectToLogin();
          throw new Error('Authentication required');
        }
        throw new Error(`Failed to get token: ${response.statusText}`);
      }

      const { accessToken } = await response.json();
      
      if (!accessToken) {
        throw new Error('No access token received');
      }

      return accessToken;
    } catch (error) {
      console.error('Failed to get JWT token:', error);
      throw error;
    }
  }

  private handleAuthenticationError() {
    // Clear any cached tokens
    this.clearCachedTokens();
    
    // Redirect to login or show authentication modal
    this.redirectToLogin();
  }

  private clearCachedTokens() {
    // Clear any local storage tokens
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }

  private redirectToLogin() {
    window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
  }

  async connect() {
    await this.socketSDK.connect();
  }

  async dispose() {
    await this.socketSDK.dispose();
  }
}

// Usage in a React component or similar
const auth = new WebAppAuthentication();
await auth.connect();
```

### Advanced JWT Token Management

```typescript
class TokenManager {
  private token: string | null = null;
  private refreshToken: string | null = null;
  private refreshPromise: Promise<string> | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Load tokens from secure storage
    this.loadTokensFromStorage();
  }

  async getToken(): Promise<string> {
    // If we have a valid token, return it
    if (this.token && !this.isTokenExpired(this.token)) {
      return this.token;
    }

    // If we're already refreshing, wait for it
    if (this.refreshPromise) {
      return await this.refreshPromise;
    }

    // Start refresh process
    this.refreshPromise = this.refreshTokens();
    try {
      this.token = await this.refreshPromise;
      return this.token;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async refreshTokens(): Promise<string> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.refreshToken}`
        },
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Refresh token expired
          this.clearTokens();
          throw new Error('Refresh token expired');
        }
        throw new Error(`Token refresh failed: ${response.statusText}`);
      }

      const { accessToken, refreshToken, expiresIn } = await response.json();
      
      this.token = accessToken;
      this.refreshToken = refreshToken;
      
      // Save to secure storage
      this.saveTokensToStorage();
      
      // Schedule next refresh before expiration
      this.scheduleTokenRefresh(expiresIn);
      
      return accessToken;
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.clearTokens();
      throw error;
    }
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const now = Math.floor(Date.now() / 1000);
      // Consider token expired 5 minutes before actual expiration
      return now >= (payload.exp - 300);
    } catch {
      return true;
    }
  }

  private scheduleTokenRefresh(expiresIn: number) {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    // Refresh 5 minutes before expiration
    const refreshIn = (expiresIn - 300) * 1000;
    
    if (refreshIn > 0) {
      this.refreshTimer = setTimeout(() => {
        this.refreshTokens().catch(console.error);
      }, refreshIn);
    }
  }

  private loadTokensFromStorage() {
    // In a real app, use secure storage
    this.token = localStorage.getItem('access_token');
    this.refreshToken = localStorage.getItem('refresh_token');
  }

  private saveTokensToStorage() {
    if (this.token) {
      localStorage.setItem('access_token', this.token);
    }
    if (this.refreshToken) {
      localStorage.setItem('refresh_token', this.refreshToken);
    }
  }

  private clearTokens() {
    this.token = null;
    this.refreshToken = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  dispose() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
  }
}

// Usage with SDK
const tokenManager = new TokenManager();

const socketSDK = new SocketSDK({
  tenantId: 'your-tenant-id',
  getJwtToken: () => tokenManager.getToken(),
  serverUrl: 'https://api.yourdomain.com'
});
```

### OpenID Connect Integration Example

```typescript
class OIDCAuthentication {
  private oidcClient: any; // Your OIDC client library
  private sdks: Map<string, any> = new Map();

  constructor(oidcConfig: any) {
    // Initialize your OIDC client (e.g., oidc-client-ts)
    this.oidcClient = new OidcClient(oidcConfig);
  }

  async initializeSDKs() {
    const restSDK = new RestSDK({
      tenantId: 'your-tenant-id',
      getJwtToken: this.getAccessToken.bind(this),
      serverUrl: 'https://api.yourdomain.com'
    });

    const socketSDK = new SocketSDK({
      tenantId: 'your-tenant-id',
      getJwtToken: this.getAccessToken.bind(this),
      serverUrl: 'https://api.yourdomain.com',
      eventHandlers: {
        onConnectionError: (error) => {
          if (error.statusCode === 401) {
            this.handleTokenExpiration();
          }
        }
      }
    });

    this.sdks.set('rest', restSDK);
    this.sdks.set('socket', socketSDK);
  }

  private async getAccessToken(): Promise<string> {
    try {
      // Get current user from OIDC
      const user = await this.oidcClient.getUser();
      
      if (!user || user.expired) {
        // Try to silently renew token
        const renewedUser = await this.oidcClient.signinSilent();
        return renewedUser.access_token;
      }

      return user.access_token;
    } catch (error) {
      console.error('Failed to get access token:', error);
      
      // Redirect to login
      await this.oidcClient.signinRedirect();
      throw new Error('Authentication required');
    }
  }

  private async handleTokenExpiration() {
    try {
      // Try silent renewal first
      await this.oidcClient.signinSilent();
      console.log('Token renewed successfully');
    } catch (error) {
      console.error('Silent renewal failed:', error);
      
      // Redirect to login
      await this.oidcClient.signinRedirect();
    }
  }

  getSDK(type: 'rest' | 'socket'): any {
    return this.sdks.get(type);
  }

  async dispose() {
    for (const sdk of this.sdks.values()) {
      if (sdk.dispose) {
        await sdk.dispose();
      }
    }
  }
}
```

## Framework-Specific Examples

### React Hook Example

```typescript
import { useEffect, useState, useCallback } from 'react';
import { SocketSDK, ConnectionState } from 'xiansai-sdk';

interface UseXiansAiSDKOptions {
  tenantId: string;
  getJwtToken: () => Promise<string>;
  serverUrl: string;
}

export function useXiansAiSDK(options: UseXiansAiSDKOptions) {
  const [sdk, setSDK] = useState<SocketSDK | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const socketSDK = new SocketSDK({
      ...options,
      eventHandlers: {
        onConnectionStateChanged: (oldState, newState) => {
          setConnectionState(newState);
        },
        onConnectionError: (error) => {
          setError(`Connection error: ${error.message}`);
        },
        onError: (error) => {
          setError(error);
        }
      }
    });

    setSDK(socketSDK);

    return () => {
      socketSDK.dispose();
    };
  }, [options.tenantId, options.serverUrl]);

  const connect = useCallback(async () => {
    if (sdk && connectionState === ConnectionState.Disconnected) {
      try {
        await sdk.connect();
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Connection failed');
      }
    }
  }, [sdk, connectionState]);

  const disconnect = useCallback(async () => {
    if (sdk && connectionState === ConnectionState.Connected) {
      await sdk.disconnect();
    }
  }, [sdk, connectionState]);

  return {
    sdk,
    connectionState,
    error,
    connect,
    disconnect,
    isConnected: connectionState === ConnectionState.Connected
  };
}

// Usage in React component
function ChatComponent() {
  const { sdk, isConnected, connect, error } = useXiansAiSDK({
    tenantId: 'your-tenant-id',
    getJwtToken: async () => {
      // Your token fetching logic
      const response = await fetch('/api/auth/token');
      const { token } = await response.json();
      return token;
    },
    serverUrl: 'https://api.yourdomain.com'
  });

  useEffect(() => {
    connect();
  }, [connect]);

  // Rest of your component...
}
```

### Vue.js Composition API Example

```typescript
import { ref, onMounted, onUnmounted } from 'vue';
import { SseSDK, ConnectionState } from 'xiansai-sdk';

export function useNotifications(tenantId: string, participantId: string) {
  const sseSDK = ref<SseSDK | null>(null);
  const connectionState = ref<ConnectionState>(ConnectionState.Disconnected);
  const notifications = ref<any[]>([]);

  onMounted(async () => {
    sseSDK.value = new SseSDK({
      tenantId,
      getJwtToken: async () => {
        // Your Vue.js auth store token getter
        return await $auth.getToken();
      },
      serverUrl: process.env.VUE_APP_API_URL!,
      eventHandlers: {
        onReceiveData: (message) => {
          if (message.data?.type === 'notification') {
            notifications.value.unshift(message.data);
          }
        },
        onConnected: () => {
          connectionState.value = ConnectionState.Connected;
        },
        onDisconnected: () => {
          connectionState.value = ConnectionState.Disconnected;
        }
      }
    });

    await sseSDK.value.connect({
      workflow: 'notification-service',
      participantId
    });
  });

  onUnmounted(() => {
    if (sseSDK.value) {
      sseSDK.value.dispose();
    }
  });

  return {
    connectionState: readonly(connectionState),
    notifications: readonly(notifications),
    isConnected: computed(() => connectionState.value === ConnectionState.Connected)
  };
}
```

## Security Best Practices

### Secure Token Storage

```typescript
class SecureTokenStorage {
  private static readonly ACCESS_TOKEN_KEY = 'xiansai_access_token';
  private static readonly REFRESH_TOKEN_KEY = 'xiansai_refresh_token';

  static saveTokens(accessToken: string, refreshToken: string) {
    // In production, consider using secure storage libraries
    // For web: Consider encrypted local storage or secure cookies
    // For mobile: Use secure keychain/keystore
    
    try {
      // Example using sessionStorage for access token (more secure than localStorage)
      sessionStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
      
      // Store refresh token in httpOnly cookie (most secure option)
      // This would be set by your authentication endpoint
      document.cookie = `${this.REFRESH_TOKEN_KEY}=${refreshToken}; Secure; HttpOnly; SameSite=Strict`;
      
    } catch (error) {
      console.error('Failed to save tokens:', error);
    }
  }

  static getAccessToken(): string | null {
    try {
      return sessionStorage.getItem(this.ACCESS_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  static clearTokens() {
    try {
      sessionStorage.removeItem(this.ACCESS_TOKEN_KEY);
      // Clear refresh token cookie via API call
      fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Failed to clear tokens:', error);
    }
  }
}
```

### Input Validation

```typescript
function validateAuthConfig(config: any): void {
  if (!config.tenantId || typeof config.tenantId !== 'string') {
    throw new Error('Invalid tenant ID');
  }

  if (!config.serverUrl || !isValidUrl(config.serverUrl)) {
    throw new Error('Invalid server URL');
  }

  if (!config.apiKey && !config.jwtToken && !config.getJwtToken) {
    throw new Error('No authentication method provided');
  }

  if (config.apiKey && !config.apiKey.startsWith('sk-')) {
    throw new Error('Invalid API key format');
  }
}

function isValidUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'https:' || 
           (parsedUrl.protocol === 'http:' && parsedUrl.hostname === 'localhost');
  } catch {
    return false;
  }
}

// Usage
try {
  validateAuthConfig({
    tenantId: 'your-tenant-id',
    apiKey: 'sk-your-api-key',
    serverUrl: 'https://api.yourdomain.com'
  });
} catch (error) {
  console.error('Invalid configuration:', error.message);
}
```

## Troubleshooting Authentication Issues

### Common Error Patterns

```typescript
class AuthErrorHandler {
  static handleAuthError(error: any, sdkType: string) {
    console.error(`${sdkType} authentication error:`, error);

    switch (error.statusCode || error.status) {
      case 401:
        console.log('Authentication failed - token may be expired or invalid');
        this.handleTokenExpiration();
        break;
        
      case 403:
        console.log('Access forbidden - insufficient permissions');
        this.handleInsufficientPermissions();
        break;
        
      case 429:
        console.log('Rate limited - too many requests');
        this.handleRateLimit();
        break;
        
      default:
        console.log('Unknown authentication error');
        this.handleGenericError(error);
    }
  }

  private static handleTokenExpiration() {
    // Clear tokens and redirect to login
    SecureTokenStorage.clearTokens();
    window.location.href = '/login';
  }

  private static handleInsufficientPermissions() {
    // Show permission error to user
    alert('You do not have permission to access this resource');
  }

  private static handleRateLimit() {
    // Implement exponential backoff
    setTimeout(() => {
      // Retry the request
    }, 5000);
  }

  private static handleGenericError(error: any) {
    // Log error for debugging
    console.error('Authentication error details:', error);
    
    // Show user-friendly message
    alert('Authentication error occurred. Please try again.');
  }
}
```

### Debug Authentication Flow

```typescript
class AuthDebugger {
  static debugTokenFlow(token: string) {
    try {
      const header = JSON.parse(atob(token.split('.')[0]));
      const payload = JSON.parse(atob(token.split('.')[1]));
      
      console.log('Token Header:', header);
      console.log('Token Payload:', payload);
      console.log('Token Expiry:', new Date(payload.exp * 1000));
      console.log('Token Valid:', payload.exp * 1000 > Date.now());
      
      return {
        header,
        payload,
        isValid: payload.exp * 1000 > Date.now(),
        expiresAt: new Date(payload.exp * 1000)
      };
    } catch (error) {
      console.error('Invalid token format:', error);
      return null;
    }
  }

  static async testAuthentication(sdk: any, sdkType: string) {
    console.log(`Testing ${sdkType} authentication...`);
    
    try {
      if (sdkType === 'rest') {
        // Test with a simple request
        const result = await sdk.getHistory({
          workflow: 'test',
          participantId: 'test-user'
        });
        console.log('Authentication test result:', result.success);
      } else if (sdkType === 'socket') {
        // Test connection
        await sdk.connect();
        console.log('Socket connection successful');
        await sdk.disconnect();
      } else if (sdkType === 'sse') {
        // Test SSE connection
        await sdk.connect({
          workflow: 'test',
          participantId: 'test-user'
        });
        console.log('SSE connection successful');
        sdk.disconnect();
      }
    } catch (error) {
      console.error(`${sdkType} authentication test failed:`, error);
      AuthErrorHandler.handleAuthError(error, sdkType);
    }
  }
}
```

## Next Steps

- [Advanced Examples](./advanced.md) - Complex scenarios and integration patterns
- [Quick Start Examples](./quick-start.md) - Basic SDK usage examples
- [Authentication Guide](../authentication.md) - Detailed authentication concepts
- [REST SDK](../rest-sdk.md) - REST SDK specific authentication details 