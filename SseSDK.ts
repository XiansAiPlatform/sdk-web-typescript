/**
 * SSE SDK for Server-Sent Events based real-time communication with UserApi endpoints
 */

import { 
  Message, 
  BaseSDKOptions, 
  AuthType,
  ConnectionState,
  SDK_DEFAULTS,
  BaseEventHandlers,
  BaseConnectionParams
} from './types';

// Import EventSource polyfill for Node.js environments
let EventSourceImpl: typeof EventSource;
if (typeof globalThis !== 'undefined' && globalThis.EventSource) {
  // Use native EventSource (browser environment)
  EventSourceImpl = globalThis.EventSource;
} else if (typeof window !== 'undefined' && window.EventSource) {
  // Use native EventSource (browser environment with window)
  EventSourceImpl = window.EventSource;
} else {
  // Fallback to polyfill for Node.js environment
  try {
    const EventSourcePolyfill = require('eventsource');
    EventSourceImpl = EventSourcePolyfill.EventSource;
  } catch (e) {
    throw new Error('EventSource is not available and polyfill could not be loaded. Install "eventsource" package for Node.js support.');
  }
}

/**
 * Heartbeat event data structure
 */
export interface HeartbeatData {
  timestamp: string;
  subscriberCount: number;
}

/**
 * Base SSE event data structure
 */
export interface SseEvent {
  type: string;
  data: any;
  id?: string;
  retry?: number;
}

/**
 * SSE heartbeat event structure
 */
export interface SseHeartbeatEvent extends SseEvent {
  type: 'heartbeat';
  data: HeartbeatData;
}

/**
 * SSE message event structure for Chat, Data, and Handoff events
 */
export interface SseMessageEvent extends SseEvent {
  type: 'Chat' | 'Data' | 'Handoff';
  data: Message;
}

/**
 * SSE error event structure
 */
export interface SseErrorEvent extends SseEvent {
  type: 'error';
  data: {
    error: string;
    code?: string;
    timestamp: string;
  };
}

/**
 * SSE connection event structure
 */
export interface SseConnectionEvent extends SseEvent {
  type: 'connected' | 'disconnected' | 'reconnecting';
  data: {
    timestamp: string;
    reason?: string;
  };
}

/**
 * Union type for all SSE events
 */
export type SseAnyEvent = SseMessageEvent | SseHeartbeatEvent | SseErrorEvent | SseConnectionEvent | SseEvent;

/**
 * Event handler type
 */
export type SseEventHandler<T extends SseEvent = SseAnyEvent> = (event: T) => void;

/**
 * Event handlers interface for SSE SDK (extends base handlers)
 */
export interface SseEventHandlers extends BaseEventHandlers {
  /**
   * Called when a heartbeat event is received (SSE-specific)
   */
  onHeartbeat?: (data: HeartbeatData) => void;
}

/**
 * Connection parameters for SSE stream (extends base parameters)
 */
export interface SseConnectionParams extends BaseConnectionParams {
  /**
   * Heartbeat interval in seconds (SSE-specific)
   */
  heartbeatSeconds?: number;
}

/**
 * Configuration options for the SSE SDK
 * 
 * @example
 * ```typescript
 * const sseSDK = new SseSDK({
 *   tenantId: 'my-tenant',
 *   apiKey: 'sk-123',
 *   serverUrl: 'https://api.example.com'
 * });
 * ```
 */
export interface SseSDKOptions extends BaseSDKOptions {
  /**
   * Reconnection attempts before giving up (default: 5)
   */
  maxReconnectAttempts?: number;
  
  /**
   * Delay between reconnection attempts in milliseconds (default: 5000)
   */
  reconnectDelay?: number;
  
  /**
   * Connection timeout in milliseconds (default: 30000)
   */
  connectionTimeout?: number;
  
  /**
   * Whether to automatically reconnect on connection loss (default: true)
   */
  autoReconnect?: boolean;
  
  /**
   * Event handlers for SSE communication
   */
  eventHandlers?: SseEventHandlers;
}



/**
 * SSE SDK class for real-time Server-Sent Events communication
 * 
 * Supports multiple authentication methods:
 * - API key authentication: Recommended for SSE due to reliable browser support
 * - JWT authentication: Supported but may have limitations due to EventSource header restrictions in some browsers
 * - Combined authentication: Both API key and JWT can be provided simultaneously (JWT takes precedence)
 * 
 * For JWT authentication, the SDK attempts to use Authorization headers where supported,
 * and falls back to query parameters when custom headers aren't available.
 */
export class SseSDK {
  private options: SseSDKOptions;
  private eventSource: EventSource | null = null;
  private connectionState: ConnectionState = ConnectionState.Disconnected;
  private eventHandlers: Map<string, Set<SseEventHandler>> = new Map();
  private sseEventHandlers: SseEventHandlers = {};
  private reconnectAttempts: number = 0;
  private connectionParams: SseConnectionParams | null = null;
  private isDisposed: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(options: SseSDKOptions) {
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
      maxReconnectAttempts: SDK_DEFAULTS.maxReconnectAttempts,
      reconnectDelay: SDK_DEFAULTS.reconnectDelay,
      connectionTimeout: SDK_DEFAULTS.connectionTimeout,
      autoReconnect: SDK_DEFAULTS.autoReconnect,
      ...options
    };

    // Store event handlers (consistent with SocketSDK)
    this.sseEventHandlers = options.eventHandlers || {};

    // Initialize legacy event handler sets for backward compatibility
    this.eventHandlers.set('message', new Set());
    this.eventHandlers.set('error', new Set());
    this.eventHandlers.set('connected', new Set());
    this.eventHandlers.set('disconnected', new Set());
    this.eventHandlers.set('reconnecting', new Set());
    this.eventHandlers.set('heartbeat', new Set());
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
   * Get JWT token for EventSource Authorization header
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
   * Builds the SSE endpoint URL with authentication
   * Can use both API key and JWT simultaneously when both are provided
   */
  private async buildSseUrl(params: SseConnectionParams): Promise<string> {
    const url = new URL(`${this.options.serverUrl}/api/user/sse/events`);
    
    // Always add required parameters
    url.searchParams.set('workflow', params.workflow);
    url.searchParams.set('participantId', params.participantId);
    url.searchParams.set('tenantId', this.options.tenantId);
    
    if (params.scope) {
      url.searchParams.set('scope', params.scope);
    }

    if (params.heartbeatSeconds) {
      url.searchParams.set('heartbeatSeconds', params.heartbeatSeconds.toString());
    }

    // Add API key authentication if available
    if (this.options.apiKey) {
      // For API key authentication: add apikey to query params
      url.searchParams.set('apikey', this.options.apiKey);
    }

    // JWT authentication will be handled in attemptConnection method via EventSource headers
    if (this.options.getJwtToken || this.options.jwtToken) {
      if (this.options.logger) {
        this.options.logger('debug', 'JWT authentication will be handled via EventSource headers where supported');
      }
    }

    return url.toString();
  }

  /**
   * Connects to the SSE stream
   */
  public async connect(params: SseConnectionParams): Promise<void> {
    if (this.isDisposed) {
      throw new Error('SDK has been disposed');
    }

    if (this.connectionState === ConnectionState.Connected || 
        this.connectionState === ConnectionState.Connecting) {
      if (this.options.logger) {
        this.options.logger('warn', 'Already connected or connecting to SSE stream');
      }
      return;
    }

    this.connectionParams = params;
    await this.attemptConnection();
  }

  /**
   * Attempts to establish SSE connection
   */
  private async attemptConnection(): Promise<void> {
    if (!this.connectionParams) {
      throw new Error('No connection parameters set');
    }

    try {
      this.setConnectionState(ConnectionState.Connecting);
      
      const url = await this.buildSseUrl(this.connectionParams);
      
      if (this.options.logger) {
        this.options.logger('debug', `Connecting to SSE stream: ${url.split('?')[0]}`, {
          workflow: this.connectionParams.workflow,
          participantId: this.connectionParams.participantId,
          scope: this.connectionParams.scope,
          authMethod: this.getAuthType()
        });
      }

      // Create EventSource with custom headers for JWT authentication
      let eventSource: EventSource;
      
      // Create EventSource based on available authentication methods
      if (this.options.getJwtToken || this.options.jwtToken) {
        // For JWT authentication, try to use EventSource with custom headers
        // Note: This may not work in all browsers - EventSource spec doesn't support custom headers
        // But some modern environments (Node.js, some browsers) do support it
        const jwtToken = await this.getJwtToken();
        
        try {
          // Try to create EventSource with headers (modern browsers/Node.js)
          const eventSourceConfig = {
            headers: {
              'Authorization': `Bearer ${jwtToken}`
            }
          };
          
          // Some EventSource polyfills or Node.js implementations support this
          eventSource = new (EventSourceImpl as any)(url, eventSourceConfig);
          
          if (this.options.logger) {
            this.options.logger('debug', 'Created EventSource with Authorization header', {
              hasApiKey: !!this.options.apiKey,
              usingBothMethods: !!this.options.apiKey
            });
          }
        } catch (headerError) {
          if (this.options.logger) {
            this.options.logger('warn', 'EventSource with custom headers not supported, falling back to query parameter method', headerError);
          }
          
          // Fallback: Add token as query parameter for environments that don't support headers
          const urlWithToken = new URL(url);
          urlWithToken.searchParams.set('access_token', jwtToken);
          eventSource = new EventSourceImpl(urlWithToken.toString());
          
          if (this.options.logger) {
            this.options.logger('debug', 'Created EventSource with access_token query parameter', {
              hasApiKey: !!this.options.apiKey,
              usingBothMethods: !!this.options.apiKey
            });
          }
        }
      } else {
        // For API key only authentication, use standard EventSource (token is in URL query params)
        eventSource = new EventSourceImpl(url);
        
        if (this.options.logger) {
          this.options.logger('debug', 'Created EventSource with API key authentication in query params');
        }
      }
      
      this.eventSource = eventSource;
      
      // Set up connection timeout
      const connectionTimeout = setTimeout(() => {
        if (this.connectionState === ConnectionState.Connecting) {
          if (this.options.logger) {
            this.options.logger('error', 'SSE connection timeout');
          }
          this.handleConnectionError('Connection timeout');
        }
      }, this.options.connectionTimeout!);

      this.eventSource.onopen = () => {
        clearTimeout(connectionTimeout);
        this.setConnectionState(ConnectionState.Connected);
        this.reconnectAttempts = 0;
        
        if (this.options.logger) {
          this.options.logger('info', 'SSE connection established');
        }
        
        // Call specific connected handler
        if (this.sseEventHandlers.onConnected) {
          try {
            this.sseEventHandlers.onConnected();
          } catch (error) {
            if (this.options.logger) {
              this.options.logger('error', 'Error in onConnected handler', error);
            }
          }
        }
        
        this.emitEvent('connected', {
          type: 'connected',
          data: { timestamp: new Date().toISOString() }
        });
      };

      // Handle the default message event (fallback)
      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (this.options.logger) {
            this.options.logger('debug', 'Received default SSE message event', { 
              eventType: 'message',
              hasData: !!data,
              eventId: event.lastEventId,
              rawData: event.data.substring(0, 200) + (event.data.length > 200 ? '...' : '')
            });
          }
          
          this.handleEventData('message', data, event.lastEventId);
        } catch (error) {
          if (this.options.logger) {
            this.options.logger('error', 'Failed to parse SSE message', error);
          }
          
          // Call specific error handler
          if (this.sseEventHandlers.onError) {
            try {
              this.sseEventHandlers.onError('Failed to parse message data');
            } catch (handlerError) {
              if (this.options.logger) {
                this.options.logger('error', 'Error in onError handler', handlerError);
              }
            }
          }
          
          this.emitEvent('error', {
            type: 'error',
            data: {
              error: 'Failed to parse message data',
              code: 'PARSE_ERROR',
              timestamp: new Date().toISOString()
            }
          });
        }
      };

      // Handle specific SSE event types
      const handleNamedEvent = (eventType: string) => (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          
          if (this.options.logger) {
            this.options.logger('debug', `Received named SSE event: ${eventType}`, { 
              eventType, 
              hasData: !!data,
              eventId: event.lastEventId 
            });
          }
          
          this.handleEventData(eventType, data, event.lastEventId);
        } catch (error) {
          if (this.options.logger) {
            this.options.logger('error', `Failed to parse SSE ${eventType} event`, error);
          }
          
          // Call specific error handler
          if (this.sseEventHandlers.onError) {
            try {
              this.sseEventHandlers.onError(`Failed to parse ${eventType} event data`);
            } catch (handlerError) {
              if (this.options.logger) {
                this.options.logger('error', 'Error in onError handler', handlerError);
              }
            }
          }
          
          this.emitEvent('error', {
            type: 'error',
            data: {
              error: `Failed to parse ${eventType} event data`,
              code: 'PARSE_ERROR',
              timestamp: new Date().toISOString()
            }
          });
        }
      };

      // Listen for specific SSE event types
      this.eventSource.addEventListener('connected', handleNamedEvent('connected'));
      this.eventSource.addEventListener('heartbeat', handleNamedEvent('heartbeat'));
      this.eventSource.addEventListener('Chat', handleNamedEvent('Chat'));
      this.eventSource.addEventListener('Data', handleNamedEvent('Data'));
      this.eventSource.addEventListener('Handoff', handleNamedEvent('Handoff'));

      this.eventSource.onerror = () => {
        clearTimeout(connectionTimeout);
        this.handleConnectionError('EventSource error');
      };

    } catch (error) {
      if (this.options.logger) {
        this.options.logger('error', 'Failed to establish SSE connection', error);
      }
      this.handleConnectionError(error instanceof Error ? error.message : 'Unknown connection error');
    }
  }

  /**
   * Handles event data based on event type and creates appropriate SSE event objects
   */
  private handleEventData(eventType: string, data: any, eventId?: string): void {
    let sseEvent: SseAnyEvent;

    switch (eventType.toLowerCase()) {
      case 'heartbeat':
        // Heartbeat events have a specific structure with timestamp and subscriberCount
        if (data && typeof data === 'object' && 'timestamp' in data && 'subscriberCount' in data) {
          sseEvent = {
            type: 'heartbeat',
            data: {
              timestamp: data.timestamp,
              subscriberCount: data.subscriberCount
            } as HeartbeatData,
            id: eventId
          } as SseHeartbeatEvent;
          
          if (this.options.logger) {
            this.options.logger('debug', 'Received SSE heartbeat event', sseEvent.data);
          }
        } else {
          // Fallback for malformed heartbeat data
          sseEvent = {
            type: 'heartbeat',
            data: {
              timestamp: new Date().toISOString(),
              subscriberCount: 0
            } as HeartbeatData,
            id: eventId
          } as SseHeartbeatEvent;
          
          if (this.options.logger) {
            this.options.logger('warn', 'Received malformed heartbeat data, using fallback', data);
          }
        }
        break;

      case 'Chat':
      case 'Data':
      case 'Handoff':
      case 'chat':
      case 'data':
      case 'handoff':
        // Chat, Data, and Handoff events contain Message objects
        sseEvent = {
          type: eventType === 'chat' || eventType === 'Chat' ? 'Chat' : 
                eventType === 'data' || eventType === 'Data' ? 'Data' : 'Handoff',
          data: data,
          id: eventId
        } as SseMessageEvent;
        
        if (this.options.logger) {
          this.options.logger('debug', `Received SSE ${eventType} event`, sseEvent.data);
        }
        break;

      default:
        // Generic event handling for other event types
        sseEvent = {
          type: eventType,
          data: data,
          id: eventId
        };
        
        if (this.options.logger) {
          this.options.logger('debug', `Received SSE ${eventType} event`, sseEvent.data);
        }
        break;
    }

    // Emit the appropriate event
    if (sseEvent.type === 'heartbeat') {
      // Call specific heartbeat handler
      if (this.sseEventHandlers.onHeartbeat) {
        try {
          this.sseEventHandlers.onHeartbeat((sseEvent as SseHeartbeatEvent).data);
        } catch (error) {
          if (this.options.logger) {
            this.options.logger('error', 'Error in onHeartbeat handler', error);
          }
        }
      }
      // Also emit legacy event for backward compatibility
      this.emitEvent('heartbeat', sseEvent);
    } else if (sseEvent.type === 'Chat') {
      // Check if this is actually a handoff message sent through chat channel
      const message = (sseEvent as SseMessageEvent).data;
      const isHandoffMessage = message.messageType === 'Handoff';
      
      if (isHandoffMessage) {
        if (this.options.logger) {
          this.options.logger('info', '🔄 [SSE-ROUTING] Detected handoff message in chat event, routing to onReceiveHandoff', {
            messageId: message.id,
            messageType: message.messageType,
            textPrefix: message.text ? message.text.substring(0, 20) : 'No text'
          });
        }
        // Route to handoff handler instead
        if (this.sseEventHandlers.onReceiveHandoff) {
          try {
            this.sseEventHandlers.onReceiveHandoff(message);
          } catch (error) {
            if (this.options.logger) {
              this.options.logger('error', 'Error in onReceiveHandoff handler', error);
            }
          }
        }
      } else {
        // Call specific chat handler
        if (this.sseEventHandlers.onReceiveChat) {
          try {
            this.sseEventHandlers.onReceiveChat(message);
          } catch (error) {
            if (this.options.logger) {
              this.options.logger('error', 'Error in onReceiveChat handler', error);
            }
          }
        }
      }
      // Also emit legacy event for backward compatibility
      this.emitEvent('message', sseEvent);
    } else if (sseEvent.type === 'Data') {
      // Check if this is actually a handoff message sent through data channel
      const message = (sseEvent as SseMessageEvent).data;
      const isHandoffMessage = message.messageType === 'Handoff';
      
      if (isHandoffMessage) {
        if (this.options.logger) {
          this.options.logger('info', '🔄 [SSE-ROUTING] Detected handoff message in data event, routing to onReceiveHandoff', {
            messageId: message.id,
            messageType: message.messageType,
            textPrefix: message.text ? message.text.substring(0, 20) : 'No text'
          });
        }
        // Route to handoff handler instead
        if (this.sseEventHandlers.onReceiveHandoff) {
          try {
            this.sseEventHandlers.onReceiveHandoff(message);
          } catch (error) {
            if (this.options.logger) {
              this.options.logger('error', 'Error in onReceiveHandoff handler', error);
            }
          }
        }
      } else {
        // Call specific data handler
        if (this.sseEventHandlers.onReceiveData) {
          try {
            this.sseEventHandlers.onReceiveData(message);
          } catch (error) {
            if (this.options.logger) {
              this.options.logger('error', 'Error in onReceiveData handler', error);
            }
          }
        }
      }
      // Also emit legacy event for backward compatibility
      this.emitEvent('message', sseEvent);
    } else if (sseEvent.type === 'Handoff') {
      // Call specific handoff handler
      if (this.sseEventHandlers.onReceiveHandoff) {
        try {
          this.sseEventHandlers.onReceiveHandoff((sseEvent as SseMessageEvent).data);
        } catch (error) {
          if (this.options.logger) {
            this.options.logger('error', 'Error in onReceiveHandoff handler', error);
          }
        }
      }
      // Also emit legacy event for backward compatibility
      this.emitEvent('message', sseEvent);
    } else {
      this.emitEvent(sseEvent.type, sseEvent);
    }
  }

  /**
   * Handles connection errors and manages reconnection logic
   */
  private handleConnectionError(reason: string): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    if (this.connectionState === ConnectionState.Connected) {
      // Call specific disconnected handler
      if (this.sseEventHandlers.onDisconnected) {
        try {
          this.sseEventHandlers.onDisconnected(reason);
        } catch (error) {
          if (this.options.logger) {
            this.options.logger('error', 'Error in onDisconnected handler', error);
          }
        }
      }
      
      this.emitEvent('disconnected', {
        type: 'disconnected',
        data: { 
          timestamp: new Date().toISOString(),
          reason 
        }
      });
    }

    if (this.options.autoReconnect && 
        this.reconnectAttempts < this.options.maxReconnectAttempts! &&
        !this.isDisposed) {
      
      this.setConnectionState(ConnectionState.Reconnecting);
      this.reconnectAttempts++;
      
      if (this.options.logger) {
        this.options.logger('info', `Attempting to reconnect (${this.reconnectAttempts}/${this.options.maxReconnectAttempts})`, {
          reason,
          delay: this.options.reconnectDelay
        });
      }
      
      // Call specific reconnecting handler
      if (this.sseEventHandlers.onReconnecting) {
        try {
          this.sseEventHandlers.onReconnecting(reason);
        } catch (error) {
          if (this.options.logger) {
            this.options.logger('error', 'Error in onReconnecting handler', error);
          }
        }
      }
      
      this.emitEvent('reconnecting', {
        type: 'reconnecting',
        data: { 
          timestamp: new Date().toISOString(),
          reason 
        }
      });

      this.reconnectTimer = setTimeout(() => {
        this.attemptConnection();
      }, this.options.reconnectDelay!);
    } else {
      this.setConnectionState(ConnectionState.Failed);
      
      if (this.options.logger) {
        this.options.logger('error', 'SSE connection failed permanently', {
          reason,
          attempts: this.reconnectAttempts
        });
      }
      
      // Call specific error handler
      if (this.sseEventHandlers.onError) {
        try {
          this.sseEventHandlers.onError(`Connection failed: ${reason}`);
        } catch (error) {
          if (this.options.logger) {
            this.options.logger('error', 'Error in onError handler', error);
          }
        }
      }
      
      this.emitEvent('error', {
        type: 'error',
        data: {
          error: `Connection failed: ${reason}`,
          code: 'CONNECTION_FAILED',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Sets the connection state and logs the change
   */
  private setConnectionState(state: ConnectionState): void {
    const previousState = this.connectionState;
    this.connectionState = state;
    
    if (this.options.logger && previousState !== state) {
      this.options.logger('debug', `SSE connection state changed: ${previousState} -> ${state}`);
    }
  }

  /**
   * Emits an event to all registered handlers
   */
  private emitEvent<T extends SseEvent>(eventType: string, event: T): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          if (this.options.logger) {
            this.options.logger('error', `Error in event handler for ${eventType}`, error);
          }
        }
      });
    }
  }

  /**
   * Adds an event listener for specific event types
   */
  public on<T extends SseEvent>(eventType: string, handler: SseEventHandler<T>): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler as SseEventHandler);
  }

  /**
   * Removes an event listener
   */
  public off<T extends SseEvent>(eventType: string, handler: SseEventHandler<T>): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler as SseEventHandler);
    }
  }

  /**
   * Adds a one-time event listener
   */
  public once<T extends SseEvent>(eventType: string, handler: SseEventHandler<T>): void {
    const onceHandler = (event: T) => {
      handler(event);
      this.off(eventType, onceHandler);
    };
    this.on(eventType, onceHandler);
  }

  /**
   * Updates event handlers (consistent with SocketSDK)
   */
  public updateEventHandlers(handlers: Partial<SseEventHandlers>): void {
    this.sseEventHandlers = { ...this.sseEventHandlers, ...handlers };
  }

  /**
   * Disconnects from the SSE stream
   */
  public disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    if (this.connectionState !== ConnectionState.Disconnected) {
      this.setConnectionState(ConnectionState.Disconnected);
      
      this.emitEvent('disconnected', {
        type: 'disconnected',
        data: { 
          timestamp: new Date().toISOString(),
          reason: 'Manual disconnect'
        }
      });
    }

    if (this.options.logger) {
      this.options.logger('info', 'SSE connection disconnected');
    }
  }

  /**
   * Gets the current connection state
   */
  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Checks if currently connected
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
    
    // Reconnect if currently connected
    if (this.isConnected() && this.connectionParams) {
      this.disconnect();
      this.connect(this.connectionParams);
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
    this.options.getJwtToken = undefined;
    
    // Reconnect if currently connected
    if (this.isConnected() && this.connectionParams) {
      this.disconnect();
      this.connect(this.connectionParams);
    }
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
    
    // Reconnect if currently connected
    if (this.isConnected() && this.connectionParams) {
      this.disconnect();
      this.connect(this.connectionParams);
    }
  }

  /**
   * Disposes the SDK and cleans up resources
   */
  public dispose(): void {
    this.isDisposed = true;
    this.disconnect();
    this.eventHandlers.clear();
    
    if (this.options.logger) {
      this.options.logger('info', 'SseSDK disposed');
    }
  }
}

/**
 * Example usage:
 * 
 * ```typescript
 * // Option 1: Create SSE SDK with API key authentication (recommended for SSE)
 * const sseSDKWithApiKey = new SseSDK({
 *   tenantId: 'my-tenant-123',
 *   apiKey: 'sk-1234567890',
 *   serverUrl: 'http://localhost:5000',
 *   eventHandlers: {
 *     onReceiveChat: (message) => {
 *       console.log('Chat message received:', message.text);
 *     },
 *     onReceiveData: (message) => {
 *       console.log('Data message received:', message.data);
 *     },
 *     onReceiveHandoff: (message) => {
 *       console.log('Handoff message received:', message);
 *     },
 *     onHeartbeat: (data) => {
 *       console.log(`Heartbeat: ${data.subscriberCount} subscribers at ${data.timestamp}`);
 *     },
 *     onError: (error) => {
 *       console.error('SSE error:', error);
 *     },
 *     onConnected: () => {
 *       console.log('Connected to SSE stream');
 *     },
 *     onDisconnected: (reason) => {
 *       console.log('Disconnected from SSE stream:', reason);
 *     }
 *   },
 *   logger: (level, message, data) => {
 *     console.log(`[${level.toUpperCase()}] ${message}`, data || '');
 *   }
 * });
 * 
 * // Option 2: Create SSE SDK with callback-based JWT authentication
 * // Note: JWT with EventSource may have browser compatibility limitations
 * const sseSDKWithCallback = new SseSDK({
 *   tenantId: 'my-tenant-123',
 *   serverUrl: 'http://localhost:5000',
 *   getJwtToken: async () => {
 *     const response = await fetch('/api/auth/token');
 *     const { token } = await response.json();
 *     return token;
 *   },
 *   eventHandlers: {
 *     onReceiveChat: (message) => {
 *       console.log('Chat message:', message.text);
 *     },
 *     onReceiveData: (message) => {
 *       console.log('Data message:', message.data);
 *     },
 *     onReceiveHandoff: (message) => {
 *       console.log('Handoff message:', message);
 *     },
 *     onHeartbeat: (data) => {
 *       console.log('Heartbeat:', {
 *         timestamp: data.timestamp,
 *         subscriberCount: data.subscriberCount
 *       });
 *     },
 *     onError: (error) => {
 *       console.error('SSE error:', error);
 *     },
 *     onConnected: () => {
 *       console.log('Connected to SSE stream');
 *     },
 *     onDisconnected: (reason) => {
 *       console.log('Disconnected from SSE stream:', reason);
 *     }
 *   }
 * });
 * 
 * // Option 3: Create SSE SDK with combined authentication (API key + JWT)
 * // JWT takes precedence for primary auth, API key provides fallback compatibility
 * const sseSDKWithBoth = new SseSDK({
 *   tenantId: 'my-tenant-123',
 *   apiKey: 'sk-fallback-key',
 *   serverUrl: 'http://localhost:5000',
 *   getJwtToken: async () => {
 *     // Primary authentication method (sent in Authorization header where supported)
 *     const response = await fetch('/api/auth/token');
 *     const { token } = await response.json();
 *     return token;
 *   },
 *   eventHandlers: {
 *     onReceiveChat: (message) => {
 *       console.log('Chat message:', message.text);
 *     },
 *     onReceiveData: (message) => {
 *       console.log('Data message:', message.data);
 *     },
 *     onHeartbeat: (data) => {
 *       console.log('Heartbeat received');
 *     }
 *   }
 * });
 * 
 * // Alternative: Set up legacy event listeners (for backward compatibility)
 * sseSDKWithCallback.on('message', (event) => {
 *   console.log('Received message:', event.data);
 *   // Handle Chat, Data, and Handoff events (all contain Message objects)
 *   if (event.type === 'Chat') {
 *     console.log('Chat message:', event.data.text);
 *   } else if (event.type === 'Data') {
 *     console.log('Data message:', event.data);
 *   } else if (event.type === 'Handoff') {
 *     console.log('Handoff message:', event.data);
 *   }
 * });
 * 
 * // Connect to stream
 * await sseSDKWithCallback.connect({
 *   workflow: 'customer-support',
 *   participantId: 'user-123',
 *   scope: 'support'
 * });
 * 
 * // Update event handlers dynamically (consistent with SocketSDK)
 * sseSDKWithCallback.updateEventHandlers({
 *   onReceiveChat: (message) => {
 *     console.log('Updated chat handler:', message.text);
 *   },
 *   onReceiveHandoff: (message) => {
 *     console.log('New handoff received:', message.data);
 *   }
 * });
 * 
 * // Clean up when done
 * sseSDKWithCallback.dispose();
 * ```
 */

export default SseSDK; 