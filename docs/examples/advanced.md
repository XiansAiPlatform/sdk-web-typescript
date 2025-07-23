# Advanced Examples

This guide demonstrates complex scenarios, production-ready patterns, and best practices for using XiansAi SDKs in real-world applications.

## Multi-SDK Integration Patterns

### 1. Hybrid Communication Pattern

Combine multiple SDKs for optimal user experience - use REST for reliable operations, WebSocket for real-time chat, and SSE for notifications.

```typescript
import { RestSDK, SocketSDK, SseSDK, MessageType } from 'xiansai-sdk';

class HybridCommunicationClient {
  private restSDK: RestSDK;
  private socketSDK: SocketSDK;
  private sseSDK: SseSDK;
  private isConnected: boolean = false;

  constructor(config: {
    tenantId: string;
    getJwtToken: () => Promise<string>;
    serverUrl: string;
  }) {
    this.restSDK = new RestSDK({
      ...config,
      requestTimeout: 30000
    });

    this.socketSDK = new SocketSDK({
      ...config,
      eventHandlers: {
        onReceiveChat: this.handleChatMessage.bind(this),
        onReceiveHandoff: this.handleHandoff.bind(this),
        onConnected: () => {
          this.isConnected = true;
          console.log('Real-time chat connected');
        },
        onDisconnected: () => {
          this.isConnected = false;
          console.log('Real-time chat disconnected');
        }
      }
    });

    this.sseSDK = new SseSDK({
      ...config,
      eventHandlers: {
        onReceiveData: this.handleNotification.bind(this),
        onHeartbeat: this.handleHeartbeat.bind(this)
      }
    });
  }

  async initialize(participantId: string) {
    try {
      // Start SSE for notifications (most reliable)
      await this.sseSDK.connect({
        workflow: 'notification-service',
        participantId,
        scope: 'alerts'
      });

      // Attempt real-time chat connection
      try {
        await this.socketSDK.connect();
        await this.socketSDK.subscribeToAgent('customer-support', participantId);
      } catch (error) {
        console.warn('Real-time chat unavailable, using REST fallback');
      }

      // Load initial data via REST (most reliable)
      await this.loadInitialData(participantId);

    } catch (error) {
      console.error('Failed to initialize communication client:', error);
      throw error;
    }
  }

  private async loadInitialData(participantId: string) {
    // Get conversation history
    const historyResult = await this.restSDK.getHistory({
      workflow: 'customer-support',
      participantId,
      pageSize: 50
    });

    if (historyResult.success && historyResult.data) {
      this.displayConversationHistory(historyResult.data);
    }
  }

  async sendMessage(participantId: string, text: string): Promise<boolean> {
    const messageRequest = {
      requestId: `msg-${Date.now()}`,
      participantId,
      workflow: 'customer-support',
      type: 'Chat' as const,
      text
    };

    // Try real-time first, fallback to REST
    if (this.isConnected) {
      try {
        await this.socketSDK.sendInboundMessage(messageRequest, MessageType.Chat);
        return true;
      } catch (error) {
        console.warn('Real-time send failed, using REST fallback:', error);
      }
    }

    // REST fallback
    const result = await this.restSDK.send(messageRequest);
    return result.success;
  }

  private handleChatMessage(message: any) {
    this.displayMessage('Agent', message.text, 'incoming');
  }

  private handleHandoff(message: any) {
    this.showHandoffNotification(message.data);
  }

  private handleNotification(message: any) {
    if (message.data?.type === 'system_alert') {
      this.showSystemAlert(message.data);
    }
  }

  private handleHeartbeat(data: any) {
    this.updateConnectionStatus(`Connected (${data.subscriberCount} active)`);
  }

  private displayMessage(sender: string, text: string, direction: string) {
    console.log(`[${direction}] ${sender}: ${text}`);
    // Update your UI here
  }

  private displayConversationHistory(messages: any[]) {
    messages.forEach(msg => {
      this.displayMessage(
        msg.direction === 'Outgoing' ? 'Agent' : 'You',
        msg.text || JSON.stringify(msg.data),
        msg.direction.toLowerCase()
      );
    });
  }

  private showHandoffNotification(data: any) {
    console.log('Handoff notification:', data);
    // Show handoff UI
  }

  private showSystemAlert(data: any) {
    console.log('System alert:', data);
    // Show alert UI
  }

  private updateConnectionStatus(status: string) {
    console.log('Connection status:', status);
    // Update connection indicator
  }

  async dispose() {
    await Promise.all([
      this.socketSDK.dispose(),
      this.sseSDK.dispose(),
      this.restSDK.dispose()
    ]);
  }
}
```

### 2. Resilient Message Queue Pattern

Implement a message queue with retry logic and offline support:

```typescript
interface QueuedMessage {
  id: string;
  request: any;
  messageType: MessageType;
  attempts: number;
  maxAttempts: number;
  timestamp: number;
  priority: 'low' | 'normal' | 'high';
}

class ResilientMessageQueue {
  private queue: QueuedMessage[] = [];
  private processing: boolean = false;
  private restSDK: RestSDK;
  private socketSDK: SocketSDK;
  private offlineMode: boolean = false;

  constructor(config: any) {
    this.restSDK = new RestSDK(config);
    this.socketSDK = new SocketSDK({
      ...config,
      eventHandlers: {
        onConnected: () => {
          this.offlineMode = false;
          this.processQueue();
        },
        onDisconnected: () => {
          this.offlineMode = true;
        }
      }
    });

    // Periodically process queue
    setInterval(() => this.processQueue(), 5000);

    // Load persisted queue on startup
    this.loadPersistedQueue();
  }

  async enqueueMessage(
    request: any, 
    messageType: MessageType, 
    priority: 'low' | 'normal' | 'high' = 'normal',
    maxAttempts: number = 3
  ): Promise<string> {
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const queuedMessage: QueuedMessage = {
      id: messageId,
      request: { ...request, requestId: messageId },
      messageType,
      attempts: 0,
      maxAttempts,
      timestamp: Date.now(),
      priority
    };

    // Insert based on priority
    this.insertByPriority(queuedMessage);
    this.persistQueue();

    // Try to process immediately if not offline
    if (!this.offlineMode) {
      this.processQueue();
    }

    return messageId;
  }

  private insertByPriority(message: QueuedMessage) {
    const priorityOrder = { high: 3, normal: 2, low: 1 };
    const insertIndex = this.queue.findIndex(
      msg => priorityOrder[msg.priority] < priorityOrder[message.priority]
    );
    
    if (insertIndex === -1) {
      this.queue.push(message);
    } else {
      this.queue.splice(insertIndex, 0, message);
    }
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const message = this.queue[0];
      
      try {
        const success = await this.sendMessage(message);
        
        if (success) {
          this.queue.shift(); // Remove from queue
          console.log(`Message ${message.id} sent successfully`);
        } else {
          message.attempts++;
          
          if (message.attempts >= message.maxAttempts) {
            this.queue.shift(); // Remove failed message
            console.error(`Message ${message.id} failed after ${message.attempts} attempts`);
            this.handleFailedMessage(message);
          } else {
            // Move to end of queue for retry
            this.queue.push(this.queue.shift()!);
            console.warn(`Message ${message.id} failed, attempt ${message.attempts}/${message.maxAttempts}`);
          }
        }
      } catch (error) {
        console.error(`Error processing message ${message.id}:`, error);
        message.attempts++;
        
        if (message.attempts >= message.maxAttempts) {
          this.queue.shift();
          this.handleFailedMessage(message);
        }
      }

      this.persistQueue();
    }

    this.processing = false;
  }

  private async sendMessage(message: QueuedMessage): Promise<boolean> {
    // Try socket first, fallback to REST
    if (this.socketSDK.isConnected()) {
      try {
        await this.socketSDK.sendInboundMessage(message.request, message.messageType);
        return true;
      } catch (error) {
        console.warn('Socket send failed, trying REST:', error);
      }
    }

    // REST fallback
    const result = await this.restSDK.send(message.request);
    return result.success;
  }

  private handleFailedMessage(message: QueuedMessage) {
    // Store failed messages for manual retry or analysis
    const failedMessages = this.getFailedMessages();
    failedMessages.push({
      ...message,
      failedAt: Date.now()
    });
    localStorage.setItem('xiansai_failed_messages', JSON.stringify(failedMessages));
  }

  private getFailedMessages(): any[] {
    try {
      return JSON.parse(localStorage.getItem('xiansai_failed_messages') || '[]');
    } catch {
      return [];
    }
  }

  private persistQueue() {
    try {
      localStorage.setItem('xiansai_message_queue', JSON.stringify(this.queue));
    } catch (error) {
      console.warn('Failed to persist message queue:', error);
    }
  }

  private loadPersistedQueue() {
    try {
      const persisted = localStorage.getItem('xiansai_message_queue');
      if (persisted) {
        this.queue = JSON.parse(persisted);
        console.log(`Loaded ${this.queue.length} messages from persistent queue`);
      }
    } catch (error) {
      console.warn('Failed to load persisted queue:', error);
    }
  }

  getQueueStatus() {
    return {
      pending: this.queue.length,
      processing: this.processing,
      offlineMode: this.offlineMode,
      failed: this.getFailedMessages().length
    };
  }

  async retryFailedMessages() {
    const failedMessages = this.getFailedMessages();
    failedMessages.forEach(msg => {
      this.enqueueMessage(msg.request, msg.messageType, msg.priority, 1);
    });
    localStorage.removeItem('xiansai_failed_messages');
  }
}
```

## Production Monitoring and Analytics

### 1. SDK Performance Monitor

```typescript
interface SDKMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  connectionUptime: number;
  lastError?: string;
  requestsByType: Record<string, number>;
}

class SDKPerformanceMonitor {
  private metrics: Map<string, SDKMetrics> = new Map();
  private requestTimes: Map<string, number> = new Map();
  private connectionStartTime: number = 0;

  constructor() {
    // Initialize metrics for each SDK type
    ['rest', 'socket', 'sse'].forEach(type => {
      this.metrics.set(type, {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        connectionUptime: 0,
        requestsByType: {}
      });
    });

    // Report metrics every 60 seconds
    setInterval(() => this.reportMetrics(), 60000);
  }

  createMonitoredRestSDK(config: any): RestSDK {
    const sdk = new RestSDK({
      ...config,
      logger: this.createLogger('rest')
    });

    // Wrap methods to track metrics
    const originalSend = sdk.send.bind(sdk);
    const originalConverse = sdk.converse.bind(sdk);
    const originalGetHistory = sdk.getHistory.bind(sdk);

    sdk.send = async (request) => {
      return this.trackRequest('rest', 'send', () => originalSend(request));
    };

    sdk.converse = async (request) => {
      return this.trackRequest('rest', 'converse', () => originalConverse(request));
    };

    sdk.getHistory = async (request) => {
      return this.trackRequest('rest', 'getHistory', () => originalGetHistory(request));
    };

    return sdk;
  }

  createMonitoredSocketSDK(config: any): SocketSDK {
    const sdk = new SocketSDK({
      ...config,
      logger: this.createLogger('socket'),
      eventHandlers: {
        ...config.eventHandlers,
        onConnected: () => {
          this.connectionStartTime = Date.now();
          config.eventHandlers?.onConnected?.();
        },
        onDisconnected: (reason) => {
          this.updateConnectionUptime('socket');
          config.eventHandlers?.onDisconnected?.(reason);
        },
        onError: (error) => {
          this.recordError('socket', error);
          config.eventHandlers?.onError?.(error);
        }
      }
    });

    // Wrap send method
    const originalSend = sdk.sendInboundMessage.bind(sdk);
    sdk.sendInboundMessage = async (request, messageType) => {
      return this.trackRequest('socket', 'sendInboundMessage', () => 
        originalSend(request, messageType)
      );
    };

    return sdk;
  }

  createMonitoredSseSDK(config: any): SseSDK {
    const sdk = new SseSDK({
      ...config,
      logger: this.createLogger('sse'),
      eventHandlers: {
        ...config.eventHandlers,
        onConnected: () => {
          this.connectionStartTime = Date.now();
          config.eventHandlers?.onConnected?.();
        },
        onDisconnected: (reason) => {
          this.updateConnectionUptime('sse');
          config.eventHandlers?.onDisconnected?.(reason);
        },
        onError: (error) => {
          this.recordError('sse', error);
          config.eventHandlers?.onError?.(error);
        }
      }
    });

    return sdk;
  }

  private createLogger(sdkType: string) {
    return (level: string, message: string, data?: any) => {
      console.log(`[${sdkType.toUpperCase()}] [${level.toUpperCase()}] ${message}`, data || '');
      
      if (level === 'error') {
        this.recordError(sdkType, message);
      }
    };
  }

  private async trackRequest<T>(
    sdkType: string, 
    operation: string, 
    requestFn: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    const requestId = `${sdkType}-${operation}-${startTime}`;
    
    this.requestTimes.set(requestId, startTime);
    const metrics = this.metrics.get(sdkType)!;
    
    metrics.totalRequests++;
    metrics.requestsByType[operation] = (metrics.requestsByType[operation] || 0) + 1;

    try {
      const result = await requestFn();
      
      // Check if result indicates success
      const isSuccess = this.isSuccessfulResult(result);
      
      if (isSuccess) {
        metrics.successfulRequests++;
      } else {
        metrics.failedRequests++;
      }
      
      this.updateResponseTime(sdkType, requestId);
      return result;
    } catch (error) {
      metrics.failedRequests++;
      this.recordError(sdkType, error instanceof Error ? error.message : 'Unknown error');
      this.updateResponseTime(sdkType, requestId);
      throw error;
    }
  }

  private isSuccessfulResult(result: any): boolean {
    // Handle different result types
    if (result && typeof result === 'object' && 'success' in result) {
      return result.success === true;
    }
    return true; // Assume success if no clear indication
  }

  private updateResponseTime(sdkType: string, requestId: string) {
    const startTime = this.requestTimes.get(requestId);
    if (startTime) {
      const responseTime = Date.now() - startTime;
      const metrics = this.metrics.get(sdkType)!;
      
      // Update running average
      const totalRequests = metrics.totalRequests;
      metrics.averageResponseTime = 
        (metrics.averageResponseTime * (totalRequests - 1) + responseTime) / totalRequests;
      
      this.requestTimes.delete(requestId);
    }
  }

  private updateConnectionUptime(sdkType: string) {
    if (this.connectionStartTime > 0) {
      const uptime = Date.now() - this.connectionStartTime;
      const metrics = this.metrics.get(sdkType)!;
      metrics.connectionUptime += uptime;
      this.connectionStartTime = 0;
    }
  }

  private recordError(sdkType: string, error: string) {
    const metrics = this.metrics.get(sdkType)!;
    metrics.lastError = error;
  }

  private reportMetrics() {
    console.log('=== SDK Performance Metrics ===');
    
    this.metrics.forEach((metrics, sdkType) => {
      const successRate = metrics.totalRequests > 0 
        ? (metrics.successfulRequests / metrics.totalRequests * 100).toFixed(2)
        : '0';
      
      console.log(`${sdkType.toUpperCase()} SDK:`);
      console.log(`  Total Requests: ${metrics.totalRequests}`);
      console.log(`  Success Rate: ${successRate}%`);
      console.log(`  Avg Response Time: ${metrics.averageResponseTime.toFixed(2)}ms`);
      console.log(`  Connection Uptime: ${(metrics.connectionUptime / 1000).toFixed(2)}s`);
      
      if (metrics.lastError) {
        console.log(`  Last Error: ${metrics.lastError}`);
      }
      
      console.log(`  Requests by Type:`, metrics.requestsByType);
      console.log('');
    });

    // Send metrics to your analytics service
    this.sendToAnalytics();
  }

  private sendToAnalytics() {
    // Send metrics to your monitoring service
    const metricsData = Object.fromEntries(this.metrics);
    
    // Example: send to your analytics endpoint
    fetch('/api/analytics/sdk-metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timestamp: Date.now(),
        metrics: metricsData
      })
    }).catch(error => {
      console.warn('Failed to send metrics to analytics:', error);
    });
  }

  getMetrics(sdkType?: string) {
    if (sdkType) {
      return this.metrics.get(sdkType);
    }
    return Object.fromEntries(this.metrics);
  }
}
```

### 2. Error Recovery and Circuit Breaker

```typescript
enum CircuitState {
  Closed = 'closed',
  Open = 'open',
  HalfOpen = 'half-open'
}

interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
}

class CircuitBreaker {
  private state: CircuitState = CircuitState.Closed;
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private nextAttemptTime: number = 0;

  constructor(private config: CircuitBreakerConfig) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.Open) {
      if (Date.now() < this.nextAttemptTime) {
        throw new Error('Circuit breaker is open');
      }
      this.state = CircuitState.HalfOpen;
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = CircuitState.Closed;
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.config.failureThreshold) {
      this.state = CircuitState.Open;
      this.nextAttemptTime = Date.now() + this.config.recoveryTimeout;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getFailureCount(): number {
    return this.failures;
  }
}

class ResilientSDKWrapper {
  private restCircuitBreaker: CircuitBreaker;
  private socketCircuitBreaker: CircuitBreaker;
  private restSDK: RestSDK;
  private socketSDK: SocketSDK;
  private fallbackMode: boolean = false;

  constructor(config: any) {
    this.restCircuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      recoveryTimeout: 30000,
      monitoringPeriod: 60000
    });

    this.socketCircuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      recoveryTimeout: 15000,
      monitoringPeriod: 30000
    });

    this.restSDK = new RestSDK(config);
    this.socketSDK = new SocketSDK({
      ...config,
      eventHandlers: {
        onDisconnected: () => {
          this.fallbackMode = true;
        },
        onConnected: () => {
          this.fallbackMode = false;
        }
      }
    });
  }

  async sendMessage(request: any): Promise<any> {
    // Try real-time first if available and circuit is closed
    if (!this.fallbackMode && 
        this.socketCircuitBreaker.getState() !== CircuitState.Open) {
      try {
        return await this.socketCircuitBreaker.execute(async () => {
          return await this.socketSDK.sendInboundMessage(request, MessageType.Chat);
        });
      } catch (error) {
        console.warn('Socket send failed, falling back to REST:', error);
      }
    }

    // REST fallback
    return await this.restCircuitBreaker.execute(async () => {
      const result = await this.restSDK.send(request);
      if (!result.success) {
        throw new Error(result.error || 'REST request failed');
      }
      return result;
    });
  }

  getHealthStatus() {
    return {
      rest: {
        state: this.restCircuitBreaker.getState(),
        failures: this.restCircuitBreaker.getFailureCount()
      },
      socket: {
        state: this.socketCircuitBreaker.getState(),
        failures: this.socketCircuitBreaker.getFailureCount(),
        connected: this.socketSDK.isConnected()
      },
      fallbackMode: this.fallbackMode
    };
  }
}
```

## Advanced Authentication Patterns

### 1. Multi-Tenant Token Management

```typescript
interface TenantConfig {
  tenantId: string;
  getJwtToken: () => Promise<string>;
  serverUrl: string;
}

class MultiTenantSDKManager {
  private tenantSDKs: Map<string, {
    rest: RestSDK;
    socket: SocketSDK;
    sse: SseSDK;
  }> = new Map();

  async addTenant(config: TenantConfig) {
    const sdks = {
      rest: new RestSDK(config),
      socket: new SocketSDK({
        ...config,
        eventHandlers: {
          onConnectionError: (error) => {
            console.error(`Tenant ${config.tenantId} connection error:`, error);
            this.handleTenantConnectionError(config.tenantId, error);
          }
        }
      }),
      sse: new SseSDK(config)
    };

    this.tenantSDKs.set(config.tenantId, sdks);
    
    // Initialize connections
    await sdks.socket.connect();
  }

  async removeTenant(tenantId: string) {
    const sdks = this.tenantSDKs.get(tenantId);
    if (sdks) {
      await Promise.all([
        sdks.socket.dispose(),
        sdks.sse.dispose(),
        sdks.rest.dispose()
      ]);
      this.tenantSDKs.delete(tenantId);
    }
  }

  getSDK(tenantId: string, type: 'rest' | 'socket' | 'sse') {
    const sdks = this.tenantSDKs.get(tenantId);
    return sdks?.[type];
  }

  async broadcastMessage(message: any, excludeTenants: string[] = []) {
    const promises = Array.from(this.tenantSDKs.entries())
      .filter(([tenantId]) => !excludeTenants.includes(tenantId))
      .map(([tenantId, sdks]) => {
        return sdks.rest.send({
          ...message,
          participantId: `broadcast-${tenantId}`
        });
      });

    return await Promise.allSettled(promises);
  }

  private handleTenantConnectionError(tenantId: string, error: any) {
    // Implement tenant-specific error handling
    console.log(`Handling connection error for tenant ${tenantId}:`, error);
  }

  getAllTenantStatuses() {
    const statuses: Record<string, any> = {};
    
    this.tenantSDKs.forEach((sdks, tenantId) => {
      statuses[tenantId] = {
        socketConnected: sdks.socket.isConnected(),
        sseConnected: sdks.sse.isConnected(),
        socketState: sdks.socket.getConnectionState(),
        sseState: sdks.sse.getConnectionState()
      };
    });

    return statuses;
  }
}
```

### 2. Automatic Token Refresh with Retry Logic

```typescript
class AdvancedTokenManager {
  private tokenCache: Map<string, {
    token: string;
    expiresAt: number;
    refreshToken?: string;
  }> = new Map();

  private refreshPromises: Map<string, Promise<string>> = new Map();

  async getToken(
    tenantId: string, 
    tokenEndpoint: string, 
    credentials: any
  ): Promise<string> {
    const cacheKey = `${tenantId}-${tokenEndpoint}`;
    const cached = this.tokenCache.get(cacheKey);

    // Return valid cached token
    if (cached && cached.expiresAt > Date.now() + 300000) { // 5 min buffer
      return cached.token;
    }

    // Check if refresh is already in progress
    const existingRefresh = this.refreshPromises.get(cacheKey);
    if (existingRefresh) {
      return await existingRefresh;
    }

    // Start refresh process
    const refreshPromise = this.refreshTokenWithRetry(
      cacheKey, 
      tokenEndpoint, 
      credentials, 
      cached?.refreshToken
    );
    
    this.refreshPromises.set(cacheKey, refreshPromise);

    try {
      const token = await refreshPromise;
      return token;
    } finally {
      this.refreshPromises.delete(cacheKey);
    }
  }

  private async refreshTokenWithRetry(
    cacheKey: string,
    tokenEndpoint: string,
    credentials: any,
    refreshToken?: string,
    maxRetries: number = 3
  ): Promise<string> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const tokenData = await this.fetchToken(
          tokenEndpoint, 
          credentials, 
          refreshToken
        );

        // Cache the new token
        this.tokenCache.set(cacheKey, {
          token: tokenData.accessToken,
          expiresAt: Date.now() + (tokenData.expiresIn * 1000),
          refreshToken: tokenData.refreshToken
        });

        return tokenData.accessToken;
      } catch (error) {
        lastError = error as Error;
        console.warn(`Token refresh attempt ${attempt} failed:`, error);

        if (attempt < maxRetries) {
          // Exponential backoff
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }

    // Clear invalid cache
    this.tokenCache.delete(cacheKey);
    throw new Error(`Token refresh failed after ${maxRetries} attempts: ${lastError!.message}`);
  }

  private async fetchToken(
    endpoint: string, 
    credentials: any, 
    refreshToken?: string
  ): Promise<any> {
    const body = refreshToken 
      ? { grant_type: 'refresh_token', refresh_token: refreshToken }
      : credentials;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token request failed: ${response.status} ${errorText}`);
    }

    return await response.json();
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  clearCache() {
    this.tokenCache.clear();
  }

  getCacheStatus() {
    const status: Record<string, any> = {};
    
    this.tokenCache.forEach((data, key) => {
      status[key] = {
        hasToken: !!data.token,
        expiresAt: new Date(data.expiresAt).toISOString(),
        expiresIn: Math.max(0, data.expiresAt - Date.now()),
        hasRefreshToken: !!data.refreshToken
      };
    });

    return status;
  }
}
```

## Error Handling and Debugging

### 1. Comprehensive Error Handler

```typescript
interface ErrorContext {
  sdkType: 'rest' | 'socket' | 'sse';
  operation: string;
  tenantId: string;
  participantId?: string;
  requestId?: string;
  timestamp: number;
}

class SDKErrorHandler {
  private errorLog: Array<{
    context: ErrorContext;
    error: any;
    resolved: boolean;
  }> = [];

  handleError(error: any, context: ErrorContext): void {
    console.error(`[${context.sdkType.toUpperCase()}] Error in ${context.operation}:`, error);
    
    this.errorLog.push({
      context,
      error: this.sanitizeError(error),
      resolved: false
    });

    // Keep only last 100 errors
    if (this.errorLog.length > 100) {
      this.errorLog.shift();
    }

    switch (context.sdkType) {
      case 'rest':
        this.handleRestError(error, context);
        break;
      case 'socket':
        this.handleSocketError(error, context);
        break;
      case 'sse':
        this.handleSseError(error, context);
        break;
    }

    // Send error to monitoring service
    this.reportError(error, context);
  }

  private handleRestError(error: any, context: ErrorContext): void {
    const statusCode = error.statusCode || error.status;
    
    switch (statusCode) {
      case 401:
        console.log('Authentication failed - token may be expired');
        this.triggerTokenRefresh(context.tenantId);
        break;
      case 429:
        console.log('Rate limited - implementing backoff');
        this.implementBackoff(context);
        break;
      case 503:
        console.log('Service unavailable - switching to degraded mode');
        this.enableDegradedMode(context.tenantId);
        break;
      default:
        console.log('Generic REST error - logging for analysis');
    }
  }

  private handleSocketError(error: any, context: ErrorContext): void {
    if (error.statusCode === 401) {
      console.log('Socket authentication failed');
      this.triggerTokenRefresh(context.tenantId);
    } else if (error.message?.includes('connection')) {
      console.log('Socket connection issue - will attempt reconnection');
    }
  }

  private handleSseError(error: any, context: ErrorContext): void {
    if (error.includes('Authentication')) {
      console.log('SSE authentication failed');
      this.triggerTokenRefresh(context.tenantId);
    } else if (error.includes('Network')) {
      console.log('SSE network issue - implementing reconnection strategy');
    }
  }

  private sanitizeError(error: any): any {
    // Remove sensitive information before logging
    const sanitized = { ...error };
    
    // Remove potential tokens from error messages
    if (sanitized.message) {
      sanitized.message = sanitized.message.replace(/sk-[a-zA-Z0-9]+/g, 'sk-***');
      sanitized.message = sanitized.message.replace(/Bearer [a-zA-Z0-9.]+/g, 'Bearer ***');
    }

    return sanitized;
  }

  private triggerTokenRefresh(tenantId: string): void {
    // Trigger token refresh logic
    console.log(`Triggering token refresh for tenant: ${tenantId}`);
  }

  private implementBackoff(context: ErrorContext): void {
    // Implement exponential backoff
    console.log(`Implementing backoff for ${context.operation}`);
  }

  private enableDegradedMode(tenantId: string): void {
    // Switch to degraded mode
    console.log(`Enabling degraded mode for tenant: ${tenantId}`);
  }

  private reportError(error: any, context: ErrorContext): void {
    // Send to monitoring service
    fetch('/api/monitoring/sdk-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: this.sanitizeError(error),
        context,
        timestamp: Date.now()
      })
    }).catch(err => {
      console.warn('Failed to report error to monitoring service:', err);
    });
  }

  getErrorSummary() {
    const summary = {
      total: this.errorLog.length,
      bySDK: {} as Record<string, number>,
      byOperation: {} as Record<string, number>,
      recent: this.errorLog.slice(-10)
    };

    this.errorLog.forEach(entry => {
      const sdk = entry.context.sdkType;
      const op = entry.context.operation;
      
      summary.bySDK[sdk] = (summary.bySDK[sdk] || 0) + 1;
      summary.byOperation[op] = (summary.byOperation[op] || 0) + 1;
    });

    return summary;
  }
}
```

## Next Steps

- [Quick Start Examples](./quick-start.md) - Basic SDK usage
- [Authentication Examples](./authentication.md) - Authentication setup patterns
- [API Documentation](../../README.md) - Complete SDK reference
- [Message Types](../message-types.md) - Understanding different message structures

## Production Deployment Checklist

### Security
- [ ] Use HTTPS for all communications
- [ ] Implement proper token storage and rotation
- [ ] Validate all inputs and sanitize outputs
- [ ] Set up proper CORS policies
- [ ] Use secure headers for web applications

### Monitoring
- [ ] Implement comprehensive error logging
- [ ] Set up performance monitoring
- [ ] Monitor connection health and uptime
- [ ] Track message delivery rates
- [ ] Set up alerting for critical failures

### Resilience
- [ ] Implement circuit breakers for external dependencies
- [ ] Add retry logic with exponential backoff
- [ ] Set up fallback mechanisms
- [ ] Handle offline scenarios gracefully
- [ ] Implement proper timeout configurations

### Testing
- [ ] Unit tests for all SDK wrappers
- [ ] Integration tests for end-to-end flows
- [ ] Load testing for high-traffic scenarios
- [ ] Failover testing for resilience validation
- [ ] Security testing for authentication flows 