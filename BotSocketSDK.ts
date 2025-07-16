/**
 * Bot Socket SDK for real-time bot communication using SignalR
 */

import * as signalR from '@microsoft/signalr';

/**
 * Bot request structure for WebSocket communication
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
 * Bot response structure from WebSocket
 */
export interface BotResponse {
  requestId?: string;
  threadId: string;
  participantId: string;
  text?: string;
  data?: any;
  scope?: string;
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
 * Connection state enum
 */
export enum ConnectionState {
  Disconnected = 'Disconnected',
  Connecting = 'Connecting',
  Connected = 'Connected',
  Disconnecting = 'Disconnecting',
  Reconnecting = 'Reconnecting'
}

/**
 * Event handlers interface
 */
export interface BotEventHandlers {
  onBotResponse?: (response: BotResponse) => void;
  onBotError?: (error: BotError) => void;
  onBotHistory?: (history: BotHistoryMessage[]) => void;
  onBotHistoryError?: (error: BotError) => void;
  onConnectionError?: (error: { statusCode: number; message: string }) => void;
  onSubscriptionError?: (error: { message: string }) => void;
  onUnsubscriptionError?: (error: { message: string }) => void;
  onConnectionStateChanged?: (oldState: ConnectionState, newState: ConnectionState) => void;
  onReconnecting?: (error?: Error) => void;
  onReconnected?: (connectionId?: string) => void;
}

/**
 * Configuration options for the Bot Socket SDK
 */
export interface BotSocketSDKOptions {
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
   * Function to get JWT token - called for every connection when using JWT authentication
   * If provided, this takes precedence over the static jwtToken
   */
  getJwtToken?: () => Promise<string> | string;
  
  /**
   * Server URL for WebSocket connection
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
   * Whether to automatically reconnect on connection loss
   */
  autoReconnect?: boolean;
  
  /**
   * Reconnection delay in milliseconds (default: 5000)
   */
  reconnectDelay?: number;
  
  /**
   * Maximum number of reconnection attempts (default: 5)
   */
  maxReconnectAttempts?: number;
  
  /**
   * Connection timeout in milliseconds (default: 30000)
   */
  connectionTimeout?: number;
  
  /**
   * Event handlers for bot communication
   */
  eventHandlers?: BotEventHandlers;
}

/**
 * Bot Socket SDK class for real-time bot communication
 */
export class BotSocketSDK {
  private options: BotSocketSDKOptions;
  private connection: signalR.HubConnection | null = null;
  private connectionState: ConnectionState = ConnectionState.Disconnected;
  private reconnectAttempts: number = 0;
  private isDisposed: boolean = false;
  private eventHandlers: BotEventHandlers = {};

  constructor(options: BotSocketSDKOptions) {
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
      autoReconnect: true,
      reconnectDelay: 5000,
      maxReconnectAttempts: 5,
      connectionTimeout: 30000,
      ...options
    };

    this.eventHandlers = options.eventHandlers || {};
    // Note: setupConnection is now called in connect() method since it's async
  }

  /**
   * Sets up the SignalR connection with authentication
   */
  private async setupConnection(): Promise<void> {
    // Build the complete URL with query parameters
    const hubUrl = await this.buildConnectionUrl();
    
    const connectionBuilder = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: async () => {
          return await this.getAuthToken();
        },
        transport: signalR.HttpTransportType.WebSockets,
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: () => this.options.reconnectDelay!
      })
      .configureLogging(signalR.LogLevel.Information);

    this.connection = connectionBuilder.build();
    this.setupEventHandlers();
  }

  /**
   * Builds the complete connection URL with query parameters
   */
  private async buildConnectionUrl(): Promise<string> {
    const url = new URL(`${this.options.serverUrl}/ws/user/bot`);
    
    // Always include tenantId
    url.searchParams.set('tenantId', this.options.tenantId);
    
    // Add authentication parameters based on the method used
    if (this.options.apiKey) {
      url.searchParams.set('apikey', this.options.apiKey);
    } else if (this.options.getJwtToken) {
      try {
        const token = await this.options.getJwtToken();
        url.searchParams.set('jwtToken', token);
      } catch (error) {
        if (this.options.logger) {
          this.options.logger('error', 'Failed to get JWT token for connection URL', error);
        }
        throw new Error(`Failed to get JWT token: ${error}`);
      }
    } else if (this.options.jwtToken) {
      url.searchParams.set('jwtToken', this.options.jwtToken);
    }
    
    const finalUrl = url.toString();
    
    // Debug logging to verify URL construction
    if (this.options.logger) {
      this.options.logger('debug', 'Built connection URL', { url: finalUrl, tenantId: this.options.tenantId, hasApiKey: !!this.options.apiKey });
    }
    
    return finalUrl;
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
   * Sets up event handlers for the SignalR connection
   */
  private setupEventHandlers(): void {
    if (!this.connection) return;

    // Connection state events
    this.connection.onclose((error) => {
      this.updateConnectionState(ConnectionState.Disconnected);
      if (this.options.logger) {
        this.options.logger('info', 'Connection closed', error);
      }
      
      if (this.options.autoReconnect && !this.isDisposed && error) {
        this.handleReconnection();
      }
    });

    this.connection.onreconnecting((error) => {
      this.updateConnectionState(ConnectionState.Reconnecting);
      if (this.options.logger) {
        this.options.logger('info', 'Attempting to reconnect', error);
      }
      this.eventHandlers.onReconnecting?.(error);
    });

    this.connection.onreconnected((connectionId) => {
      this.updateConnectionState(ConnectionState.Connected);
      this.reconnectAttempts = 0;
      if (this.options.logger) {
        this.options.logger('info', 'Reconnected successfully', connectionId);
      }
      this.eventHandlers.onReconnected?.(connectionId);
    });

    // Bot communication events
    this.connection.on('BotResponse', (response: BotResponse) => {
      if (this.options.logger) {
        this.options.logger('debug', 'Received bot response', response);
      }
      this.eventHandlers.onBotResponse?.(response);
    });

    this.connection.on('BotError', (error: BotError) => {
      if (this.options.logger) {
        this.options.logger('error', 'Received bot error', error);
      }
      this.eventHandlers.onBotError?.(error);
    });

    this.connection.on('BotHistory', (history: BotHistoryMessage[]) => {
      if (this.options.logger) {
        this.options.logger('debug', 'Received bot history', { count: history.length });
      }
      this.eventHandlers.onBotHistory?.(history);
    });

    this.connection.on('BotHistoryError', (error: BotError) => {
      if (this.options.logger) {
        this.options.logger('error', 'Received bot history error', error);
      }
      this.eventHandlers.onBotHistoryError?.(error);
    });

    this.connection.on('ConnectionError', (error: { statusCode: number; message: string }) => {
      if (this.options.logger) {
        this.options.logger('error', 'Connection error', error);
      }
      this.eventHandlers.onConnectionError?.(error);
    });

    this.connection.on('SubscriptionError', (error: { message: string }) => {
      if (this.options.logger) {
        this.options.logger('error', 'Subscription error', error);
      }
      this.eventHandlers.onSubscriptionError?.(error);
    });

    this.connection.on('UnsubscriptionError', (error: { message: string }) => {
      if (this.options.logger) {
        this.options.logger('error', 'Unsubscription error', error);
      }
      this.eventHandlers.onUnsubscriptionError?.(error);
    });
  }

  /**
   * Updates the connection state and notifies handlers
   */
  private updateConnectionState(newState: ConnectionState): void {
    const oldState = this.connectionState;
    this.connectionState = newState;
    this.eventHandlers.onConnectionStateChanged?.(oldState, newState);
  }

  /**
   * Handles reconnection logic with exponential backoff
   */
  private async handleReconnection(): Promise<void> {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts! || this.isDisposed) {
      if (this.options.logger) {
        this.options.logger('error', 'Max reconnection attempts reached');
      }
      return;
    }

    this.reconnectAttempts++;
    const delay = this.options.reconnectDelay! * Math.pow(2, this.reconnectAttempts - 1);
    
    if (this.options.logger) {
      this.options.logger('info', `Reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);
    }

    setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        if (this.options.logger) {
          this.options.logger('error', 'Reconnection attempt failed', error);
        }
        this.handleReconnection();
      }
    }, delay);
  }

  /**
   * Connects to the SignalR hub
   */
  public async connect(): Promise<void> {
    if (this.isDisposed) {
      throw new Error('Connection has been disposed');
    }

    // Setup connection if not already done
    if (!this.connection) {
      if (this.options.logger) {
        this.options.logger('debug', 'Setting up new connection', { tenantId: this.options.tenantId, authType: this.getAuthType() });
      }
      await this.setupConnection();
    }

    if (!this.connection) {
      throw new Error('Failed to initialize connection');
    }

    if (this.connectionState === ConnectionState.Connected || 
        this.connectionState === ConnectionState.Connecting) {
      return;
    }

    this.updateConnectionState(ConnectionState.Connecting);

    if (this.options.logger) {
      this.options.logger('debug', 'Starting SignalR connection', { connectionState: this.connectionState });
    }

    try {
      await this.connection.start();
      this.updateConnectionState(ConnectionState.Connected);
      this.reconnectAttempts = 0;
      
      if (this.options.logger) {
        this.options.logger('info', 'Connected to bot hub successfully');
      }
    } catch (error) {
      this.updateConnectionState(ConnectionState.Disconnected);
      if (this.options.logger) {
        this.options.logger('error', 'Failed to connect to bot hub', error);
      }
      throw error;
    }
  }

  /**
   * Disconnects from the SignalR hub
   */
  public async disconnect(): Promise<void> {
    if (!this.connection || this.connectionState === ConnectionState.Disconnected) {
      return;
    }

    this.updateConnectionState(ConnectionState.Disconnecting);

    try {
      await this.connection.stop();
      this.updateConnectionState(ConnectionState.Disconnected);
      
      if (this.options.logger) {
        this.options.logger('info', 'Disconnected from bot hub');
      }
    } catch (error) {
      if (this.options.logger) {
        this.options.logger('error', 'Error during disconnection', error);
      }
      throw error;
    }
  }

  /**
   * Sends a bot request
   */
  public async sendBotRequest(request: BotRequest): Promise<void> {
    if (!this.connection || this.connectionState !== ConnectionState.Connected) {
      throw new Error('Connection is not established');
    }

    try {
      // Ensure participantId is set
      if (!request.participantId) {
        throw new Error('participantId is required');
      }

      if (this.options.logger) {
        this.options.logger('debug', 'Sending bot request', request);
      }

      await this.connection.invoke('RequestBot', request);
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
    workflow: string, 
    participantId: string, 
    page: number = 1, 
    pageSize: number = 50, 
    scope?: string
  ): Promise<void> {
    if (!this.connection || this.connectionState !== ConnectionState.Connected) {
      throw new Error('Connection is not established');
    }

    try {
      if (this.options.logger) {
        this.options.logger('debug', 'Requesting bot history', { workflow, participantId, page, pageSize, scope });
      }

      await this.connection.invoke('GetBotHistory', workflow, participantId, page, pageSize, scope);
    } catch (error) {
      if (this.options.logger) {
        this.options.logger('error', 'Failed to get bot history', error);
      }
      throw error;
    }
  }

  /**
   * Subscribes to bot notifications for a workflow
   */
  public async subscribeToBots(workflow: string, participantId: string): Promise<void> {
    if (!this.connection || this.connectionState !== ConnectionState.Connected) {
      throw new Error('Connection is not established');
    }

    try {
      if (this.options.logger) {
        this.options.logger('debug', 'Subscribing to bots', { workflow, participantId, tenantId: this.options.tenantId });
      }

      await this.connection.invoke('SubscribeToBots', workflow, participantId, this.options.tenantId);
    } catch (error) {
      if (this.options.logger) {
        this.options.logger('error', 'Failed to subscribe to bots', error);
      }
      throw error;
    }
  }

  /**
   * Unsubscribes from bot notifications for a workflow
   */
  public async unsubscribeFromBots(workflow: string, participantId: string): Promise<void> {
    if (!this.connection || this.connectionState !== ConnectionState.Connected) {
      throw new Error('Connection is not established');
    }

    try {
      if (this.options.logger) {
        this.options.logger('debug', 'Unsubscribing from bots', { workflow, participantId, tenantId: this.options.tenantId });
      }

      await this.connection.invoke('UnsubscribeFromBots', workflow, participantId, this.options.tenantId);
    } catch (error) {
      if (this.options.logger) {
        this.options.logger('error', 'Failed to unsubscribe from bots', error);
      }
      throw error;
    }
  }

  /**
   * Batch subscribes to multiple bot workflows
   */
  public async batchSubscribeToBots(workflows: string[], participantId: string): Promise<void> {
    if (!this.connection || this.connectionState !== ConnectionState.Connected) {
      throw new Error('Connection is not established');
    }

    try {
      if (this.options.logger) {
        this.options.logger('debug', 'Batch subscribing to bots', { workflows, participantId, tenantId: this.options.tenantId });
      }

      await this.connection.invoke('BatchSubscribeToBots', workflows, participantId, this.options.tenantId);
    } catch (error) {
      if (this.options.logger) {
        this.options.logger('error', 'Failed to batch subscribe to bots', error);
      }
      throw error;
    }
  }

  /**
   * Gets bot service metrics via HTTP call
   */
  public async getBotMetrics(): Promise<BotMetrics> {
    try {
      const authToken = await this.getAuthToken();
      
      // Build URL with query parameters for authentication
      const url = new URL(`${this.options.serverUrl}/api/user/bot/metrics`);
      url.searchParams.set('tenantId', this.options.tenantId);
      
      if (this.options.apiKey) {
        url.searchParams.set('apikey', this.options.apiKey);
      }
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get bot metrics: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (this.options.logger) {
        this.options.logger('error', 'Failed to get bot metrics', error);
      }
      throw error;
    }
  }

  /**
   * Updates event handlers
   */
  public updateEventHandlers(handlers: Partial<BotEventHandlers>): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  /**
   * Gets the current connection state
   */
  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Checks if the connection is established
   */
  public isConnected(): boolean {
    return this.connectionState === ConnectionState.Connected;
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
    
    // Recreate connection with new auth
    this.recreateConnection();
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
    
    // Recreate connection with new auth
    this.recreateConnection();
  }

  /**
   * Recreates the connection with new authentication
   */
  private async recreateConnection(): Promise<void> {
    const wasConnected = this.isConnected();
    
    if (wasConnected) {
      await this.disconnect();
    }
    
    // Clear the current connection
    this.connection = null;
    
    if (wasConnected) {
      await this.connect();
    }
  }

  /**
   * Disposes the SDK and cleans up resources
   */
  public async dispose(): Promise<void> {
    this.isDisposed = true;
    
    if (this.connection) {
      await this.disconnect();
      this.connection = null;
    }
    
    this.eventHandlers = {};
    
    if (this.options.logger) {
      this.options.logger('info', 'BotSocketSDK disposed');
    }
  }
}

/**
 * Example usage:
 * 
 * ```typescript
 * // Option 1: Create Bot Socket SDK with API key authentication
 * const botSocketSDKWithApiKey = new BotSocketSDK({
 *   tenantId: 'my-tenant-123',
 *   apiKey: 'sk-1234567890',
 *   serverUrl: 'http://localhost:5000',
 *   namespace: 'MyApp',
 *   autoReconnect: true,
 *   eventHandlers: {
 *     onBotResponse: (response) => {
 *       console.log('Bot responded:', response.text);
 *     },
 *     onBotError: (error) => {
 *       console.error('Bot error:', error.message);
 *     },
 *     onConnectionStateChanged: (oldState, newState) => {
 *       console.log(`Connection state changed: ${oldState} -> ${newState}`);
 *     }
 *   },
 *   logger: (level, message, data) => {
 *     console.log(`[${level.toUpperCase()}] ${message}`, data || '');
 *   }
 * });
 * 
 * // Option 2: Create Bot Socket SDK with callback-based JWT authentication (recommended)
 * const botSocketSDKWithCallback = new BotSocketSDK({
 *   tenantId: 'my-tenant-123',
 *   serverUrl: 'http://localhost:5000',
 *   getJwtToken: async () => {
 *     // This is called for connection and reconnections
 *     const response = await fetch('/api/auth/token');
 *     const { token } = await response.json();
 *     return token;
 *   },
 *   autoReconnect: true,
 *   eventHandlers: {
 *     onBotResponse: (response) => {
 *       console.log('Bot responded:', response.text);
 *     }
 *   }
 * });
 * 
 * // Connect to the bot hub
 * await botSocketSDKWithCallback.connect();
 * 
 * // Subscribe to bot notifications
 * await botSocketSDKWithCallback.subscribeToBots('customer-support', 'user-123');
 * 
 * // Send a bot request
 * await botSocketSDKWithCallback.sendBotRequest({
 *   requestId: 'req-123',
 *   participantId: 'user-123',
 *   workflowType: 'customer-support',
 *   text: 'Hello, I need help with my order',
 *   parameters: { priority: 'high' }
 * });
 * 
 * // Get bot history
 * await botSocketSDKWithCallback.getBotHistory('customer-support', 'user-123', 1, 20);
 * 
 * // Get performance metrics
 * const metrics = await botSocketSDKWithCallback.getBotMetrics();
 * console.log('Active connections:', metrics.hubMetrics.activeConnections);
 * 
 * // Check connection state
 * console.log('Is connected:', botSocketSDKWithCallback.isConnected());
 * console.log('Connection state:', botSocketSDKWithCallback.getConnectionState());
 * 
 * // Batch subscribe to multiple workflows
 * await botSocketSDKWithCallback.batchSubscribeToBots(['workflow1', 'workflow2'], 'user-123');
 * 
 * // Update event handlers dynamically
 * botSocketSDKWithCallback.updateEventHandlers({
 *   onBotHistory: (history) => {
 *     console.log('Received history with', history.length, 'messages');
 *   }
 * });
 * 
 * // Clean up when done
 * await botSocketSDKWithCallback.dispose();
 * ```
 */

export default BotSocketSDK; 