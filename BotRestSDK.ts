/**
 * Bot REST SDK for HTTP-based bot communication
 */

/**
 * Bot request structure for REST API communication
 */
export interface BotRequest {
  requestId?: string;
  participantId: string;
  workflowId?: string;
  workflowType?: string;
  scope?: string;
  hint?: string;
  data?: any;
  text?: string;
  threadId?: string;
  authorization?: string;
}

/**
 * Bot response structure from REST API
 */
export interface BotResponse {
  requestId?: string;
  threadId: string;
  participantId: string;
  text?: string;
  data?: any;
  isComplete: boolean;
  error?: string;
  timestamp: string;
}

/**
 * Bot history message structure
 */
export interface BotHistoryMessage {
  id: string;
  createdAt: string;
  direction: 'Incoming' | 'Outgoing';
  messageType?: string;
  text?: string;
  data?: any;
  hint?: string;
  requestId?: string;
}

/**
 * Error response structure
 */
export interface BotError {
  requestId?: string;
  statusCode: number;
  message: string;
}

/**
 * Connection metrics structure
 */
export interface ConnectionMetrics {
  activeConnections: number;
  cachedGroupNames: number;
  averageConnectionDuration: string;
}

/**
 * Bot service metrics structure
 */
export interface BotMetrics {
  timestamp: string;
  service: string;
  hubMetrics: ConnectionMetrics;
  status: string;
}

/**
 * Bot history response structure
 */
export interface BotHistoryResponse {
  messages: BotHistoryMessage[];
  page: number;
  pageSize: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * HTTP retry configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableStatusCodes: number[];
}

/**
 * Configuration options for the Bot REST SDK
 */
export interface BotRestSDKOptions {
  /**
   * Tenant ID for authentication
   */
  tenantId: string;
  
  /**
   * API Key for authentication (required if getJwtToken is not provided)
   */
  apiKey?: string;
  
  /**
   * JWT Token for authentication (optional, used as fallback if getJwtToken fails)
   */
  jwtToken?: string;
  
  /**
   * Function to get JWT token - called for every request when using JWT authentication
   * If provided, this takes precedence over the static jwtToken
   */
  getJwtToken?: () => Promise<string> | string;
  
  /**
   * Server URL for REST API
   */
  serverUrl: string;
  
  /**
   * Custom logger function. Defaults to console.log
   */
  logger?: (level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any) => void;
  
  /**
   * Optional namespace/prefix for logging
   */
  namespace?: string;
  
  /**
   * Request timeout in milliseconds (default: 30000)
   */
  requestTimeout?: number;
  
  /**
   * Retry configuration for failed requests
   */
  retryConfig?: Partial<RetryConfig>;
  
  /**
   * Custom headers to include with every request
   */
  defaultHeaders?: Record<string, string>;
  
  /**
   * Whether to include credentials in requests (default: true)
   */
  withCredentials?: boolean;
}

/**
 * Bot REST SDK class for HTTP-based bot communication
 */
export class BotRestSDK {
  private options: BotRestSDKOptions & {
    logger: (level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any) => void;
    requestTimeout: number;
    retryConfig: RetryConfig;
    defaultHeaders: Record<string, string>;
    withCredentials: boolean;
  };
  private isDisposed: boolean = false;
  private readonly defaultRetryConfig: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
    retryableStatusCodes: [408, 429, 500, 502, 503, 504]
  };

  constructor(options: BotRestSDKOptions) {
    // Validate required fields
    if (!options.tenantId) {
      throw new Error('tenantId is required');
    }
    if (!options.apiKey && !options.getJwtToken && !options.jwtToken) {
      throw new Error('Either apiKey, jwtToken, or getJwtToken callback is required');
    }
    if (options.apiKey && (options.jwtToken || options.getJwtToken)) {
      throw new Error('Cannot provide apiKey with jwtToken or getJwtToken. Please use only one authentication method.');
    }
    if (!options.serverUrl) {
      throw new Error('serverUrl is required');
    }
    
    this.options = {
      ...options,
      logger: options.logger || ((level, message, data) => console.log(`[${level.toUpperCase()}] ${message}`, data || '')),
      requestTimeout: options.requestTimeout || 30000,
      retryConfig: { ...this.defaultRetryConfig, ...options.retryConfig },
      defaultHeaders: options.defaultHeaders || {},
      withCredentials: options.withCredentials !== false
    };
  }

  /**
   * Gets the authentication token based on the configured method
   */
  private async getAuthToken(): Promise<string> {
    if (this.options.apiKey) {
      return this.options.apiKey;
    } else if (this.options.getJwtToken) {
      try {
        return await this.options.getJwtToken();
      } catch (error) {
        if (this.options.logger) {
          this.options.logger('error', 'Failed to get JWT token', error);
        }
        throw new Error(`Failed to get JWT token: ${error}`);
      }
    } else if (this.options.jwtToken) {
      return this.options.jwtToken;
    } else {
      throw new Error('No authentication method available');
    }
  }

  /**
   * Builds request headers with authentication
   */
  private async buildHeaders(additionalHeaders?: Record<string, string>): Promise<Record<string, string>> {
    const authToken = await this.getAuthToken();
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
      ...this.options.defaultHeaders,
      ...additionalHeaders
    };

    return headers;
  }

  /**
   * Builds URL with query parameters for authentication and tenant
   */
  private buildUrl(endpoint: string, queryParams?: Record<string, string>): string {
    const url = new URL(`${this.options.serverUrl}${endpoint}`);
    
    // Always include tenantId
    url.searchParams.set('tenantId', this.options.tenantId);
    
    // Add API key to query params if using API key authentication
    if (this.options.apiKey) {
      url.searchParams.set('apikey', this.options.apiKey);
    }
    
    // Add additional query parameters
    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, value);
        }
      });
    }
    
    return url.toString();
  }

  /**
   * Makes an HTTP request with retry logic
   */
  private async makeRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    options: {
      body?: any;
      queryParams?: Record<string, string>;
      headers?: Record<string, string>;
      timeout?: number;
    } = {}
  ): Promise<T> {
    if (this.isDisposed) {
      throw new Error('SDK has been disposed');
    }

    const url = this.buildUrl(endpoint, options.queryParams);
    const headers = await this.buildHeaders(options.headers);
    const timeout = options.timeout || this.options.requestTimeout;

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.options.retryConfig.maxAttempts; attempt++) {
      try {
        if (this.options.logger) {
          this.options.logger('debug', `Making ${method} request (attempt ${attempt})`, { 
            url: url.replace(/apikey=[^&]+/, 'apikey=***'), 
            method 
          });
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const requestInit: RequestInit = {
          method,
          headers,
          signal: controller.signal,
          credentials: this.options.withCredentials ? 'include' : 'omit'
        };

        if (options.body && (method === 'POST' || method === 'PUT')) {
          requestInit.body = JSON.stringify(options.body);
        }

        const response = await fetch(url, requestInit);
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          const error = new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
          (error as any).statusCode = response.status;
          
          // Check if this is a retryable error
          if (this.options.retryConfig.retryableStatusCodes.includes(response.status) && 
              attempt < this.options.retryConfig.maxAttempts) {
            lastError = error;
            await this.delay(this.calculateRetryDelay(attempt));
            continue;
          }
          
          throw error;
        }

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const result = await response.json();
          
          if (this.options.logger) {
            this.options.logger('debug', `Request successful on attempt ${attempt}`, { method, url: url.replace(/apikey=[^&]+/, 'apikey=***') });
          }
          
          return result;
        } else {
          // For non-JSON responses, return the response text
          const result = await response.text();
          return result as unknown as T;
        }

      } catch (error) {
        lastError = error as Error;
        
        if (this.options.logger && lastError) {
          this.options.logger('error', `Request failed on attempt ${attempt}`, { 
            method, 
            url: url.replace(/apikey=[^&]+/, 'apikey=***'), 
            error: lastError.message 
          });
        }

        // Don't retry on certain errors
        if (error instanceof TypeError || 
            (error as any).name === 'AbortError' ||
            attempt >= this.options.retryConfig.maxAttempts) {
          break;
        }

        await this.delay(this.calculateRetryDelay(attempt));
      }
    }

    throw lastError || new Error('Request failed after all retry attempts');
  }

  /**
   * Calculates delay for retry attempts with exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    const delay = Math.min(
      this.options.retryConfig.baseDelay * Math.pow(this.options.retryConfig.backoffMultiplier, attempt - 1),
      this.options.retryConfig.maxDelay
    );
    
    // Add jitter (±25%)
    const jitter = delay * 0.25 * (Math.random() * 2 - 1);
    return Math.max(0, delay + jitter);
  }

  /**
   * Delays execution for specified milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Sends a bot request
   */
  public async sendBotRequest(request: BotRequest): Promise<BotResponse> {
    if (!request.participantId) {
      throw new Error('participantId is required');
    }

    if (this.options.logger) {
      this.options.logger('debug', 'Sending bot request', request);
    }

    try {
      const response = await this.makeRequest<BotResponse>('POST', '/api/user/bot/', {
        body: request
      });

      if (this.options.logger) {
        this.options.logger('debug', 'Bot request completed', { requestId: request.requestId });
      }

      return response;
    } catch (error) {
      if (this.options.logger) {
        this.options.logger('error', 'Failed to send bot request', error);
      }
      throw error;
    }
  }

  /**
   * Gets bot history for a workflow and participant
   */
  public async getBotHistory(
    workflowId: string, 
    participantId: string, 
    page: number = 1, 
    pageSize: number = 50, 
    scope?: string
  ): Promise<BotHistoryResponse> {
    if (!workflowId) {
      throw new Error('workflowId is required');
    }
    if (!participantId) {
      throw new Error('participantId is required');
    }

    if (this.options.logger) {
      this.options.logger('debug', 'Getting bot history', { workflowId, participantId, page, pageSize, scope });
    }

    try {
      const queryParams: Record<string, string> = {
        page: page.toString(),
        pageSize: pageSize.toString()
      };

      if (scope) {
        queryParams.scope = scope;
      }

      const response = await this.makeRequest<BotHistoryResponse>(
        'GET', 
        `/api/user/bot/history/${encodeURIComponent(workflowId)}/${encodeURIComponent(participantId)}`,
        { queryParams }
      );

             if (this.options.logger) {
         this.options.logger('debug', 'Bot history retrieved', { 
           workflowId, 
           participantId, 
           messageCount: Array.isArray(response.messages) ? response.messages.length : 0 
         });
       }

      return response;
    } catch (error) {
      if (this.options.logger) {
        this.options.logger('error', 'Failed to get bot history', error);
      }
      throw error;
    }
  }

  /**
   * Gets bot service metrics
   */
  public async getBotMetrics(): Promise<BotMetrics> {
    if (this.options.logger) {
      this.options.logger('debug', 'Getting bot metrics');
    }

    try {
      const response = await this.makeRequest<BotMetrics>('GET', '/api/user/bot/metrics');

      if (this.options.logger) {
        this.options.logger('debug', 'Bot metrics retrieved', { 
          service: response.service, 
          status: response.status 
        });
      }

      return response;
    } catch (error) {
      if (this.options.logger) {
        this.options.logger('error', 'Failed to get bot metrics', error);
      }
      throw error;
    }
  }

  /**
   * Gets the tenant ID
   */
  public getTenantId(): string {
    return this.options.tenantId;
  }

  /**
   * Gets the authentication type being used
   */
  public getAuthType(): 'apiKey' | 'jwtToken' | 'jwtCallback' {
    if (this.options.apiKey) return 'apiKey';
    if (this.options.getJwtToken !== undefined) return 'jwtCallback';
    return 'jwtToken';
  }

  /**
   * Updates the API key (switches to API key authentication)
   */
  public updateApiKey(apiKey: string): void {
    if (!apiKey) {
      throw new Error('apiKey cannot be empty');
    }
    this.options.apiKey = apiKey;
    this.options.jwtToken = undefined;
    
    if (this.options.logger) {
      this.options.logger('info', 'API key updated');
    }
  }

  /**
   * Updates the JWT token (switches to JWT token authentication)
   */
  public updateJwtToken(jwtToken: string): void {
    if (!jwtToken) {
      throw new Error('jwtToken cannot be empty');
    }
    this.options.jwtToken = jwtToken;
    this.options.apiKey = undefined;
    
    if (this.options.logger) {
      this.options.logger('info', 'JWT token updated');
    }
  }

  /**
   * Updates default headers for all requests
   */
  public updateDefaultHeaders(headers: Record<string, string>): void {
    this.options.defaultHeaders = { ...this.options.defaultHeaders, ...headers };
    
    if (this.options.logger) {
      this.options.logger('info', 'Default headers updated');
    }
  }

  /**
   * Updates retry configuration
   */
  public updateRetryConfig(retryConfig: Partial<RetryConfig>): void {
    this.options.retryConfig = { ...this.options.retryConfig, ...retryConfig };
    
    if (this.options.logger) {
      this.options.logger('info', 'Retry configuration updated', this.options.retryConfig);
    }
  }

  /**
   * Tests the connection to the bot service
   */
  public async testConnection(): Promise<boolean> {
    if (this.options.logger) {
      this.options.logger('debug', 'Testing connection to bot service');
    }

    try {
      await this.getBotMetrics();
      
      if (this.options.logger) {
        this.options.logger('info', 'Connection test successful');
      }
      
      return true;
    } catch (error) {
      if (this.options.logger) {
        this.options.logger('error', 'Connection test failed', error);
      }
      
      return false;
    }
  }

  /**
   * Disposes the SDK and cleans up resources
   */
  public dispose(): void {
    this.isDisposed = true;
    
    if (this.options.logger) {
      this.options.logger('info', 'BotRestSDK disposed');
    }
  }
}

/**
 * Example usage:
 * 
 * ```typescript
 * // Option 1: Create Bot REST SDK with API key authentication
 * const botRestSDKWithApiKey = new BotRestSDK({
 *   tenantId: 'my-tenant-123',
 *   apiKey: 'sk-1234567890',
 *   serverUrl: 'http://localhost:5000',
 *   namespace: 'MyApp',
 *   requestTimeout: 10000,
 *   retryConfig: {
 *     maxAttempts: 3,
 *     baseDelay: 1000
 *   },
 *   logger: (level, message, data) => {
 *     console.log(`[${level.toUpperCase()}] ${message}`, data || '');
 *   }
 * });
 * 
 * // Option 2: Create Bot REST SDK with callback-based JWT authentication (recommended)
 * const botRestSDKWithCallback = new BotRestSDK({
 *   tenantId: 'my-tenant-123',
 *   serverUrl: 'http://localhost:5000',
 *   getJwtToken: async () => {
 *     // This is called for every request when using JWT authentication
 *     const response = await fetch('/api/auth/token');
 *     const { token } = await response.json();
 *     return token;
 *   },
 *   requestTimeout: 15000,
 *   defaultHeaders: {
 *     'X-Custom-Header': 'my-value'
 *   }
 * });
 * 
 * // Test connection
 * const isConnected = await botRestSDKWithCallback.testConnection();
 * console.log('Connection test:', isConnected ? 'Success' : 'Failed');
 * 
 * // Send a bot request
 * const response = await botRestSDKWithCallback.sendBotRequest({
 *   requestId: 'req-123',
 *   participantId: 'user-123',
 *   workflowType: 'customer-support',
 *   text: 'Hello, I need help with my order',
 *   parameters: { priority: 'high' }
 * });
 * console.log('Bot response:', response.text);
 * 
 * // Get bot history
 * const history = await botRestSDKWithCallback.getBotHistory('customer-support', 'user-123', 1, 20);
 * console.log('History:', history.messages.length, 'messages');
 * 
 * // Get performance metrics
 * const metrics = await botRestSDKWithCallback.getBotMetrics();
 * console.log('Active connections:', metrics.hubMetrics.activeConnections);
 * 
 * // Update authentication
 * botRestSDKWithCallback.updateApiKey('new-api-key');
 * 
 * // Update retry settings
 * botRestSDKWithCallback.updateRetryConfig({
 *   maxAttempts: 5,
 *   baseDelay: 2000
 * });
 * 
 * // Clean up when done
 * botRestSDKWithCallback.dispose();
 * ```
 */

export default BotRestSDK;
