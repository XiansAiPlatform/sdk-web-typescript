/**
 * Chat Socket SDK for real-time chat communication using SignalR
 */

import * as signalR from '@microsoft/signalr';
import { 
  MessageType, 
  Message, 
  BaseMessageRequest, 
  BaseSDKOptions, 
  AuthType,
  ConnectionState,
  SDK_DEFAULTS,
  BaseEventHandlers
} from './types';

/**
 * Chat or data request structure for WebSocket communication
 * Matches ChatOrDataRequest from C# backend
 */
export interface MessageRequest extends BaseMessageRequest {
  threadId?: string;
}



/**
 * Event handlers interface for SocketSDK (extends base handlers)
 */
export interface EventHandlers extends BaseEventHandlers {
  /**
   * Called when thread history is received (SocketSDK-specific)
   */
  onThreadHistory?: (history: Message[]) => void;
  
  /**
   * Called when an inbound message is processed (SocketSDK-specific)
   */
  onInboundProcessed?: (threadId: string) => void;
  
  /**
   * Called when a connection error occurs (SocketSDK-specific)
   */
  onConnectionError?: (error: { statusCode: number; message: string }) => void;
  
  /**
   * Called when connection state changes (SocketSDK-specific)
   */
  onConnectionStateChanged?: (oldState: ConnectionState, newState: ConnectionState) => void;
  
  /**
   * Called when reconnected successfully (SocketSDK-specific, different signature than base)
   */
  onReconnected?: (connectionId?: string) => void;
}

/**
 * Configuration options for the Chat Socket SDK
 * 
 * @example
 * ```typescript
 * const socketSDK = new SocketSDK({
 *   tenantId: 'my-tenant',
 *   apiKey: 'sk-123',
 *   serverUrl: 'https://api.example.com'
 * });
 * ```
 */
export interface SocketSDKOptions extends BaseSDKOptions {
  
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
   * Event handlers for chat communication
   */
  eventHandlers?: EventHandlers;
}

/**
 * Chat Socket SDK class for real-time chat communication using SignalR
 * 
 * Supports consistent authentication methods across all SDKs:
 * - API key authentication: Uses 'apikey' query parameter (recommended for consistent auth)
 * - JWT authentication: Uses 'access_token' query parameter + Authorization header via SignalR accessTokenFactory
 * - Combined authentication: Both API key and JWT can be provided simultaneously (JWT takes precedence)
 * 
 * The SDK automatically handles reconnection and provides event-driven communication.
 */
export class SocketSDK {
  private options: SocketSDKOptions;
  private connection: signalR.HubConnection | null = null;
  private connectionState: ConnectionState = ConnectionState.Disconnected;
  private reconnectAttempts: number = 0;
  private isDisposed: boolean = false;
  private eventHandlers: EventHandlers = {};

  constructor(options: SocketSDKOptions) {
    // Validate required fields
    if (!options.tenantId) {
      throw new Error('tenantId is required');
    }
    if (!options.apiKey && !options.getJwtToken && !options.jwtToken) {
      throw new Error('Either apiKey, jwtToken, or getJwtToken callback is required');
    }
    if (!options.serverUrl) {
      throw new Error('serverUrl is required');
    }
    
    this.options = {
      logger: (level, message, data) => console.log(`[${level.toUpperCase()}] ${message}`, data || ''),
      autoReconnect: SDK_DEFAULTS.autoReconnect,
      reconnectDelay: SDK_DEFAULTS.reconnectDelay,
      maxReconnectAttempts: SDK_DEFAULTS.maxReconnectAttempts,
      connectionTimeout: SDK_DEFAULTS.connectionTimeout,
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
    
    const connectionOptions: signalR.IHttpConnectionOptions = {
      transport: signalR.HttpTransportType.WebSockets,
    };

    // Only use accessTokenFactory for JWT authentication
    if (this.options.getJwtToken || this.options.jwtToken) {
      connectionOptions.accessTokenFactory = async () => {
        return await this.getJwtToken();
      };
    }

    const connectionBuilder = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, connectionOptions)
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: () => this.options.reconnectDelay!
      })
      .configureLogging(signalR.LogLevel.Information);

    this.connection = connectionBuilder.build();
    
    // Debug: Log all SignalR events received (for debugging purposes)
    if (this.options.logger) {
      const originalOn = this.connection.on.bind(this.connection);
      this.connection.on = (methodName: string, callback: (...args: any[]) => void) => {
        return originalOn(methodName, (...args: any[]) => {
          this.options.logger!('debug', `🔍 SignalR event: ${methodName}`, { 
            argsCount: args.length,
            firstArg: args.length > 0 ? args[0] : null 
          });
          return callback(...args);
        });
      };
    }
    
    this.setupEventHandlers();
  }

  /**
   * Builds the complete connection URL with query parameters
   * Supports consistent authentication methods: apikey for API keys, access_token for JWT
   */
  private async buildConnectionUrl(): Promise<string> {
    const url = new URL(`${this.options.serverUrl}/ws/chat`);
    
    // Always include tenantId
    url.searchParams.set('tenantId', this.options.tenantId);
    
    // Add authentication parameters based on the method used
    // Use consistent parameter names with other SDKs and server expectations
    if (this.options.apiKey) {
      // For API key authentication: use apikey parameter (consistent with other SDKs)
      url.searchParams.set('apikey', this.options.apiKey);
    }
    
    if (this.options.getJwtToken || this.options.jwtToken) {
      // JWT tokens are handled via accessTokenFactory in SignalR connection
      // Do not add JWT tokens to query parameters for security reasons
      if (this.options.logger) {
        this.options.logger('debug', 'JWT authentication will be handled via accessTokenFactory');
      }
    }
    
    const finalUrl = url.toString();
    
    // Debug logging to verify URL construction
    if (this.options.logger) {
      this.options.logger('debug', 'Built connection URL', { 
        url: finalUrl.split('?')[0], // Log URL without sensitive tokens
        tenantId: this.options.tenantId, 
        primaryAuthMethod: this.getAuthType(),
        hasApiKey: !!this.options.apiKey,
        hasJwtToken: !!(this.options.jwtToken || this.options.getJwtToken),
        usingBothMethods: !!this.options.apiKey && !!(this.options.jwtToken || this.options.getJwtToken)
      });
    }
    
    return finalUrl;
  }

  /**
   * Get JWT token for SignalR accessTokenFactory
   * @returns JWT token
   */
  private async getJwtToken(): Promise<string> {
    if (this.options.getJwtToken) {
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
      throw new Error('No JWT token available');
    }
  }

  /**
   * Gets the authentication token based on the configured method
   * When both API key and JWT methods are provided, JWT takes precedence
   */
  private async getAuthToken(): Promise<string> {
    // Prioritize JWT methods when available
    if (this.options.getJwtToken) {
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
    } else if (this.options.apiKey) {
      return this.options.apiKey;
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
      this.eventHandlers.onReconnecting?.(error?.message);
    });

    this.connection.onreconnected((connectionId) => {
      this.updateConnectionState(ConnectionState.Connected);
      this.reconnectAttempts = 0;
      if (this.options.logger) {
        this.options.logger('info', 'Reconnected successfully', connectionId);
      }
      this.eventHandlers.onReconnected?.(connectionId);
    });

    // Chat communication events matching ChatHub SignalR methods
    // SignalR method names are case-sensitive and usually lowercase
    this.connection.on('ThreadHistory', (history: Message[] | null) => {
      const safeHistory = history || [];
      if (this.options.logger) {
        this.options.logger('debug', 'Received thread history (Pascal)', { count: safeHistory.length });
      }
      this.eventHandlers.onThreadHistory?.(safeHistory);
    });

    this.connection.on('threadhistory', (history: Message[] | null) => {
      const safeHistory = history || [];
      if (this.options.logger) {
        this.options.logger('debug', 'Received thread history (lowercase)', { count: safeHistory.length });
      }
      this.eventHandlers.onThreadHistory?.(safeHistory);
    });

    this.connection.on('InboundProcessed', (threadId: string) => {
      if (this.options.logger) {
        this.options.logger('debug', 'Inbound message processed (Pascal)', { threadId });
      }
      this.eventHandlers.onInboundProcessed?.(threadId);
    });

    this.connection.on('inboundprocessed', (threadId: string) => {
      if (this.options.logger) {
        this.options.logger('debug', 'Inbound message processed (lowercase)', { threadId });
      }
      this.eventHandlers.onInboundProcessed?.(threadId);
    });


    this.connection.on('ReceiveChat', (message: Message) => {
      if (this.options.logger) {
        this.options.logger('info', '🔔 [NEW-Pascal] Received agent chat message via ReceiveChat', { 
          messageId: message.id, 
          direction: message.direction,
          text: message.text ? message.text.substring(0, 100) + '...' : 'No text',
          messageType: message.messageType
        });
      }
      
      // Check if this is actually a handoff message sent through chat channel
      const isHandoffMessage = message.messageType === 'Handoff';
      
      if (isHandoffMessage) {
        if (this.options.logger) {
          this.options.logger('info', '🔄 [ROUTING] Detected handoff message in chat channel, routing to onReceiveHandoff', {
            messageId: message.id,
            messageType: message.messageType,
            textPrefix: message.text ? message.text.substring(0, 20) : 'No text'
          });
        }
        // Route to handoff handler instead
        this.eventHandlers.onReceiveHandoff?.(message);
      } else {
        // Handle as regular chat message
        this.eventHandlers.onReceiveChat?.(message);
      }
    });


    this.connection.on('ReceiveData', (message: Message) => {
      if (this.options.logger) {
        this.options.logger('info', '🔔 [NEW-Pascal] Received agent data message via ReceiveData', { 
          messageId: message.id, 
          direction: message.direction,
          hasData: !!message.data,
          messageType: message.messageType
        });
      }
      
      // Check if this is actually a handoff message sent through data channel
      const isHandoffMessage = message.messageType === 'Handoff';
      
      if (isHandoffMessage) {
        if (this.options.logger) {
          this.options.logger('info', '🔄 [ROUTING] Detected handoff message in data channel, routing to onReceiveHandoff', {
            messageId: message.id,
            messageType: message.messageType,
            textPrefix: message.text ? message.text.substring(0, 20) : 'No text'
          });
        }
        // Route to handoff handler instead
        this.eventHandlers.onReceiveHandoff?.(message);
      } else {
        // Handle as regular data message
        this.eventHandlers.onReceiveData?.(message);
      }
    });

    this.connection.on('ReceiveHandoff', (message: Message) => {
      if (this.options.logger) {
        this.options.logger('info', '🔔 [NEW-Pascal] Received agent handoff message via ReceiveHandoff', { 
          messageId: message.id, 
          direction: message.direction,
          hasData: !!message.data
        });
      }
      this.eventHandlers.onReceiveHandoff?.(message);
    });

    this.connection.on('Error', (error: string) => {
      if (this.options.logger) {
        this.options.logger('error', 'Received error', error);
      }
      this.eventHandlers.onError?.(error);
    });

    this.connection.on('ConnectionError', (error: { statusCode: number; message: string }) => {
      if (this.options.logger) {
        this.options.logger('error', 'Connection error', error);
      }
      this.eventHandlers.onConnectionError?.(error);
    });

    // Legacy method support - register old SignalR methods that server might still call
    // Route them to the appropriate modern handlers
    this.connection.on('ReceiveMessage', (message: Message) => {
      // ignore
    });

    this.connection.on('receivemessage', (message: Message) => {
      // ignore
    });

    this.connection.on('ReceiveMetadata', (message: Message) => {
      // ignore
    });

    this.connection.on('receivemetadata', (message: Message) => {
      // ignore
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
   * Sends an inbound message to the chat system
   */
  public async sendInboundMessage(request: MessageRequest, messageType: MessageType): Promise<void> {
    if (!this.connection || this.connectionState !== ConnectionState.Connected) {
      throw new Error('Connection is not established');
    }

    try {
      // Ensure participantId is set
      if (!request.participantId) {
        throw new Error('participantId is required');
      }

      // Add JWT token to authorization field if available
      const messageRequest = { ...request };
      if (this.options.jwtToken || this.options.getJwtToken) {
        try {
          const jwtToken = await this.getJwtToken();
          messageRequest.authorization = jwtToken;
          
          if (this.options.logger) {
            this.options.logger('debug', 'Added JWT token to message authorization field');
          }
        } catch (error) {
          if (this.options.logger) {
            this.options.logger('warn', 'Failed to get JWT token for message authorization field', error);
          }
          // Continue without JWT in message (connection-level auth still applies)
        }
      }

      if (this.options.logger) {
        this.options.logger('debug', 'Sending inbound message', { 
          messageType,
          hasAuthorization: !!messageRequest.authorization,
          participantId: request.participantId,
          requestId: request.requestId
        });
      }

      await this.connection.invoke('SendInboundMessage', messageRequest, messageType);
    } catch (error) {
      if (this.options.logger) {
        this.options.logger('error', 'Failed to send inbound message', error);
      }
      throw error;
    }
  }

  /**
   * Gets thread history for a workflow and participant
   */
  public async getThreadHistory(
    workflow: string, 
    participantId: string, 
    page: number = 0, 
    pageSize: number = 50,
    scope?: string
  ): Promise<void> {
    if (!this.connection || this.connectionState !== ConnectionState.Connected) {
      throw new Error('Connection is not established');
    }

    try {
      if (this.options.logger) {
        this.options.logger('debug', 'Requesting thread history', { workflow, participantId, page, pageSize, scope });
      }

      if (scope) {
        await this.connection.invoke('GetScopedThreadHistory', workflow, participantId, page, pageSize, scope);
      } else {
        await this.connection.invoke('GetThreadHistory', workflow, participantId, page, pageSize);
      }
    } catch (error) {
      if (this.options.logger) {
        this.options.logger('error', 'Failed to get thread history', error);
      }
      throw error;
    }
  }

  /**
   * Subscribes to agent notifications for a workflow
   */
  public async subscribeToAgent(workflow: string, participantId: string): Promise<void> {
    if (!this.connection || this.connectionState !== ConnectionState.Connected) {
      throw new Error('Connection is not established');
    }

    try {
      // Log expected group name for debugging
      const expectedWorkflowId = workflow.startsWith(this.options.tenantId + ':') ? workflow : `${this.options.tenantId}:${workflow}`;
      const expectedGroupName = expectedWorkflowId + participantId + this.options.tenantId;
      
      if (this.options.logger) {
        this.options.logger('info', '🔗 Subscribing to agent group', { 
          workflow, 
          participantId, 
          tenantId: this.options.tenantId,
          expectedWorkflowId,
          expectedGroupName
        });
      }

      await this.connection.invoke('SubscribeToAgent', workflow, participantId, this.options.tenantId);
      
      if (this.options.logger) {
        this.options.logger('info', '✅ Successfully subscribed to agent group');
      }
    } catch (error) {
      if (this.options.logger) {
        this.options.logger('error', '❌ Failed to subscribe to agent', error);
      }
      throw error;
    }
  }

  /**
   * Unsubscribes from agent notifications for a workflow
   */
  public async unsubscribeFromAgent(workflow: string, participantId: string): Promise<void> {
    if (!this.connection || this.connectionState !== ConnectionState.Connected) {
      throw new Error('Connection is not established');
    }

    try {
      if (this.options.logger) {
        this.options.logger('debug', 'Unsubscribing from agent', { workflow, participantId, tenantId: this.options.tenantId });
      }

      await this.connection.invoke('UnsubscribeFromAgent', workflow, participantId, this.options.tenantId);
    } catch (error) {
      if (this.options.logger) {
        this.options.logger('error', 'Failed to unsubscribe from agent', error);
      }
      throw error;
    }
  }

  /**
   * Updates event handlers
   */
  public updateEventHandlers(handlers: Partial<EventHandlers>): void {
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
   * When both API key and JWT methods are provided, JWT takes precedence
   */
  public getAuthType(): AuthType {
    if (this.options.getJwtToken) return 'jwtCallback';
    if (this.options.jwtToken) return 'jwtToken';
    return 'apiKey';
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
    this.options.getJwtToken = undefined;
    
    // Recreate connection with new auth
    this.recreateConnection();
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
    
    // Recreate connection with new auth
    this.recreateConnection();
  }

  /**
   * Recreates the connection with new authentication
   */
  private async recreateConnection(): Promise<void> {
    // Don't recreate if SDK has been disposed
    if (this.isDisposed) {
      return;
    }
    
    const wasConnected = this.isConnected();
    
    if (wasConnected) {
      await this.disconnect();
    }
    
    // Clear the current connection
    this.connection = null;
    
    if (wasConnected && !this.isDisposed) {
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
 * // Option 1: Create Chat Socket SDK with API key authentication
 * const chatSocketSDKWithApiKey = new ChatSocketSDK({
 *   tenantId: 'my-tenant-123',
 *   apiKey: 'sk-1234567890',
 *   serverUrl: 'http://localhost:5000',
 *   namespace: 'MyApp',
 *   autoReconnect: true,
 *   eventHandlers: {
 *     onThreadHistory: (history) => {
 *       console.log('Received history with', history.length, 'messages');
 *     },
 *     onInboundProcessed: (threadId) => {
 *       console.log('Message processed for thread:', threadId);
 *     },
 *     onReceiveChat: (message) => {
 *       console.log('Agent responded:', message.text);
 *     },
 *     onReceiveData: (message) => {
 *       console.log('Agent sent data:', message.data);
 *     },
 *     onReceiveHandoff: (message) => {
 *       console.log('Agent handoff:', message);
 *     },
 *     onError: (error) => {
 *       console.error('Chat error:', error);
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
 * // Option 2: Create Chat Socket SDK with callback-based JWT authentication (recommended)
 * const chatSocketSDKWithCallback = new ChatSocketSDK({
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
 *     onThreadHistory: (history) => {
 *       console.log('Received history with', history.length, 'messages');
 *     },
 *     onReceiveChat: (message) => {
 *       console.log('Agent response:', message.text);
 *     },
 *     onReceiveHandoff: (message) => {
 *       console.log('Handoff received:', message);
 *     }
 *   }
 * });
 * 
 * // Option 3: Create Chat Socket SDK with combined authentication (API key + JWT)
 * // JWT takes precedence for primary auth, API key can be used as fallback or for specific scenarios
 * const chatSocketSDKWithBoth = new ChatSocketSDK({
 *   tenantId: 'my-tenant-123',
 *   apiKey: 'sk-fallback-key',
 *   serverUrl: 'http://localhost:5000',
 *   getJwtToken: async () => {
 *     // Primary authentication method
 *     const response = await fetch('/api/auth/token');
 *     const { token } = await response.json();
 *     return token;
 *   },
 *   autoReconnect: true,
 *   eventHandlers: {
 *     onThreadHistory: (history) => {
 *       console.log('Received history with', history.length, 'messages');
 *     },
 *     onReceiveChat: (message) => {
 *       console.log('Agent response:', message.text);
 *     }
 *   }
 * });
 * 
 * // Connect to the chat hub
 * await chatSocketSDKWithCallback.connect();
 * 
 * // Subscribe to agent notifications
 * await chatSocketSDKWithCallback.subscribeToAgent('customer-support', 'user-123');
 * 
 * // Send an inbound message
 * await chatSocketSDKWithCallback.sendInboundMessage({
 *   requestId: 'req-123',
 *   participantId: 'user-123',
 *   workflowType: 'customer-support',
 *   text: 'Hello, I need help with my order',
 *   data: { priority: 'high' }
 * }, MessageType.Chat);
 * 
 * // Get thread history
 * await chatSocketSDKWithCallback.getThreadHistory('customer-support', 'user-123', 0, 20);
 * 
 * // Get thread history with scope
 * await chatSocketSDKWithCallback.getThreadHistory('customer-support', 'user-123', 0, 20, 'support');
 * 
 * // Get performance metrics (if available)
 * const metrics = await chatSocketSDKWithCallback.getChatMetrics();
 * console.log('Active connections:', metrics.hubMetrics.activeConnections);
 * 
 * // Check connection state
 * console.log('Is connected:', chatSocketSDKWithCallback.isConnected());
 * console.log('Connection state:', chatSocketSDKWithCallback.getConnectionState());
 * 
 * // Update event handlers dynamically
 * chatSocketSDKWithCallback.updateEventHandlers({
 *   onThreadHistory: (history) => {
 *     console.log('Received updated history with', history.length, 'messages');
 *   },
 *   onReceiveChat: (message) => {
 *     console.log('New agent response received:', message.text);
 *   },
 *   onReceiveHandoff: (message) => {
 *     console.log('New handoff received:', message);
 *   }
 * });
 * 
 * // Clean up when done
 * await chatSocketSDKWithCallback.dispose();
 * ```
 */

export default SocketSDK; 