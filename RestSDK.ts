/**
 * Rest SDK for HTTP-based chat communication with UserApi endpoints
 */

import { 
  Message, 
  BaseMessageRequest, 
  BaseSDKOptions, 
  AuthType,
  SDK_DEFAULTS
} from './types';

/**
 * Rest request structure for HTTP communication
 * Similar to MessageRequest but tailored for REST endpoints
 */
export interface RestMessageRequest extends BaseMessageRequest {
  timeoutSeconds?: number;
}

/**
 * Response structure for REST endpoints
 */
export interface RestResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

/**
 * History request parameters
 */
export interface HistoryRequest {
  workflow: string;
  participantId: string;
  page?: number;
  pageSize?: number;
  scope?: string;
}

/**
 * Configuration options for the Rest SDK
 * 
 * @example
 * ```typescript
 * const restSDK = new RestSDK({
 *   tenantId: 'my-tenant',
 *   apiKey: 'sk-123',
 *   serverUrl: 'https://api.example.com'
 * });
 * ```
 */
export interface RestSDKOptions extends BaseSDKOptions {
  
  /**
   * Request timeout in milliseconds (default: 30000)
   */
  requestTimeout?: number;
  
  /**
   * Default timeout for converse operations in seconds (default: 60)
   */
  defaultConverseTimeout?: number;
  
  /**
   * Maximum timeout for converse operations in seconds (default: 300)
   */
  maxConverseTimeout?: number;
}

/**
 * Rest SDK class for HTTP-based chat communication
 */
export class RestSDK {
  private options: RestSDKOptions;
  private isDisposed: boolean = false;

  constructor(options: RestSDKOptions) {
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
      logger: (level, message, data) => console.log(`[${level.toUpperCase()}] ${message}`, data || ''),
      requestTimeout: SDK_DEFAULTS.requestTimeout,
      defaultConverseTimeout: 60,
      maxConverseTimeout: 300,
      ...options
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
   * Builds query parameters for requests
   */
  private buildQueryParams(params: Record<string, string | number | undefined>): string {
    const searchParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.set(key, value.toString());
      }
    });
    
    return searchParams.toString();
  }

  /**
   * Makes an HTTP request with authentication and error handling
   * Supports multiple authentication methods: apikey query param, Authorization header, or access_token query param fallback
   */
  private async makeRequest<T>(
    endpoint: string, 
    method: 'GET' | 'POST' = 'GET',
    queryParams?: Record<string, string | number | undefined>,
    body?: any
  ): Promise<RestResponse<T>> {
    if (this.isDisposed) {
      throw new Error('SDK has been disposed');
    }

    try {
      const authToken = await this.getAuthToken();
      const url = new URL(`${this.options.serverUrl}${endpoint}`);
      
      // Always add tenantId to query params as required by the server
      const finalQueryParams: Record<string, string | number | undefined> = {
        ...queryParams,
        tenantId: this.options.tenantId
      };

      // Add authentication based on method
      if (this.options.apiKey) {
        // For API key authentication: add apikey to query params
        finalQueryParams.apikey = authToken;
      }
      
      if (finalQueryParams) {
        const params = this.buildQueryParams(finalQueryParams);
        if (params) {
          url.search = params;
        }
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // For JWT authentication: use Authorization header (preferred method)
      // Note: RestSDK primarily uses Authorization header, but server also supports access_token query parameter
      if (this.options.jwtToken || this.options.getJwtToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
        
        if (this.options.logger) {
          this.options.logger('debug', 'Using Authorization header for JWT authentication');
        }
      }

      const requestOptions: RequestInit = {
        method,
        headers,
        signal: AbortSignal.timeout(this.options.requestTimeout!),
      };

      if (body && method === 'POST') {
        requestOptions.body = JSON.stringify(body);
      }

      if (this.options.logger) {
        this.options.logger('debug', `Making ${method} request to ${url.toString()}`, {
          hasBody: !!body,
          hasAuth: !!authToken,
          authMethod: this.getAuthType(),
          tenantId: this.options.tenantId
        });
      }

      const response = await fetch(url.toString(), requestOptions);
      
      let data: T | undefined;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        if (text) {
          data = text as any;
        }
      }

      if (!response.ok) {
        const error = typeof data === 'object' && data && 'message' in data 
          ? (data as any).message 
          : `HTTP ${response.status}: ${response.statusText}`;
        
        if (this.options.logger) {
          this.options.logger('error', `Request failed: ${error}`, {
            status: response.status,
            statusText: response.statusText,
            data
          });
        }

        return {
          success: false,
          error,
          statusCode: response.status,
          data
        };
      }

      if (this.options.logger) {
        this.options.logger('debug', `Request successful`, { status: response.status });
      }

      return {
        success: true,
        data,
        statusCode: response.status
      };

    } catch (error) {
      if (this.options.logger) {
        this.options.logger('error', 'Request failed with exception', error);
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Sends a message to a workflow without waiting for response
   */
  public async send(request: RestMessageRequest): Promise<RestResponse<any>> {
    if (!request.workflow) {
      throw new Error('workflow is required');
    }
    if (!request.type) {
      throw new Error('type is required');
    }
    if (!request.participantId) {
      throw new Error('participantId is required');
    }

    const queryParams: Record<string, string | undefined> = {
      workflow: request.workflow,
      type: request.type,
      participantId: request.participantId,
      requestId: request.requestId,
      text: request.text
    };

    if (this.options.logger) {
      this.options.logger('info', 'Sending message to workflow', {
        workflow: request.workflow,
        type: request.type,
        participantId: request.participantId,
        hasText: !!request.text,
        hasData: !!request.data
      });
    }

    return await this.makeRequest<any>(
      '/api/user/rest/send',
      'POST',
      queryParams,
      request.data
    );
  }

  /**
   * Sends a message to a workflow and waits synchronously for response
   */
  public async converse(request: RestMessageRequest): Promise<RestResponse<Message[]>> {
    if (!request.workflow) {
      throw new Error('workflow is required');
    }
    if (!request.type) {
      throw new Error('type is required');
    }
    if (!request.participantId) {
      throw new Error('participantId is required');
    }

    const timeoutSeconds = request.timeoutSeconds;
    
    const queryParams: Record<string, string | number | undefined> = {
      workflow: request.workflow,
      type: request.type,
      participantId: request.participantId,
      timeoutSeconds,
      requestId: request.requestId,
      text: request.text
    };

    if (this.options.logger) {
      this.options.logger('info', 'Starting conversation with workflow', {
        workflow: request.workflow,
        type: request.type,
        participantId: request.participantId,
        timeoutSeconds,
        hasText: !!request.text,
        hasData: !!request.data
      });
    }

    try {
      const result = await this.makeRequest<Message[]>(
        '/api/user/rest/converse',
        'POST',
        queryParams,
        request.data
      );

      if (this.options.logger) {
        this.options.logger('info', 'Conversation completed', {
          success: result.success,
          messageCount: result.data?.length || 0
        });
      }

      return result;
    } catch (error) {
      if (this.options.logger) {
        this.options.logger('error', 'Conversation failed', error);
      }
      throw error;
    }
  }

  /**
   * Gets conversation history for a workflow and participant
   */
  public async getHistory(request: HistoryRequest): Promise<RestResponse<Message[]>> {
    if (!request.workflow) {
      throw new Error('workflow is required');
    }
    if (!request.participantId) {
      throw new Error('participantId is required');
    }

    const queryParams: Record<string, string | number | undefined> = {
      workflow: request.workflow,
      participantId: request.participantId,
      page: request.page || 1,
      pageSize: request.pageSize || 50,
      scope: request.scope
    };

    if (this.options.logger) {
      this.options.logger('debug', 'Requesting conversation history', {
        workflow: request.workflow,
        participantId: request.participantId,
        page: queryParams.page,
        pageSize: queryParams.pageSize,
        scope: request.scope
      });
    }

    return await this.makeRequest<Message[]>(
      '/api/user/rest/history',
      'GET',
      queryParams
    );
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
  public getAuthType(): AuthType {
    if (this.options.apiKey) return 'apiKey';
    if (this.options.getJwtToken) return 'jwtCallback';
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
    this.options.getJwtToken = undefined;
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
    this.options.getJwtToken = undefined;
  }

  /**
   * Updates the JWT token callback (switches to JWT callback authentication)
   */
  public updateJwtTokenCallback(getJwtToken: () => Promise<string> | string): void {
    if (!getJwtToken) {
      throw new Error('getJwtToken callback cannot be null');
    }
    this.options.getJwtToken = getJwtToken;
    this.options.apiKey = undefined;
    this.options.jwtToken = undefined;
  }

  /**
   * Disposes the SDK and cleans up resources
   */
  public dispose(): void {
    this.isDisposed = true;
    
    if (this.options.logger) {
      this.options.logger('info', 'RestSDK disposed');
    }
  }
}

/**
 * Example usage:
 * 
 * ```typescript
 * // Option 1: Create Rest SDK with API key authentication
 * const restSDKWithApiKey = new RestSDK({
 *   tenantId: 'my-tenant-123',
 *   apiKey: 'sk-1234567890',
 *   serverUrl: 'http://localhost:5000',
 *   namespace: 'MyApp',
 *   logger: (level, message, data) => {
 *     console.log(`[${level.toUpperCase()}] ${message}`, data || '');
 *   }
 * });
 * 
 * // Option 2: Create Rest SDK with callback-based JWT authentication (recommended)
 * const restSDKWithCallback = new RestSDK({
 *   tenantId: 'my-tenant-123',
 *   serverUrl: 'http://localhost:5000',
 *   getJwtToken: async () => {
 *     const response = await fetch('/api/auth/token');
 *     const { token } = await response.json();
 *     return token;
 *   }
 * });
 * 
 * // Send a message without waiting for response
 * const sendResult = await restSDKWithCallback.send({
 *   workflow: 'customer-support',
 *   type: 'Chat',
 *   participantId: 'user-123',
 *   text: 'Hello, I need help with my order',
 *   data: { priority: 'high' }
 * });
 * 
 * if (sendResult.success) {
 *   console.log('Message sent successfully');
 * } else {
 *   console.error('Failed to send message:', sendResult.error);
 * }
 * 
 * // Send a message and wait for response
 * const converseResult = await restSDKWithCallback.converse({
 *   workflow: 'customer-support',
 *   type: 'Chat',
 *   participantId: 'user-123',
 *   text: 'What is my order status?',
 *   timeoutSeconds: 30
 * });
 * 
 * if (converseResult.success && converseResult.data) {
 *   console.log('Received responses:', converseResult.data);
 * } else {
 *   console.error('Conversation failed:', converseResult.error);
 * }
 * 
 * // Get conversation history
 * const historyResult = await restSDKWithCallback.getHistory({
 *   workflow: 'customer-support',
 *   participantId: 'user-123',
 *   page: 1,
 *   pageSize: 20,
 *   scope: 'support'
 * });
 * 
 * if (historyResult.success && historyResult.data) {
 *   console.log('History loaded:', historyResult.data.length, 'messages');
 * }
 * 
 * // Clean up when done
 * restSDKWithCallback.dispose();
 * ```
 */

export default RestSDK; 