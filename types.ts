/**
 * Shared types for XiansAi SDK
 * Used by both SocketSDK and RestSDK to avoid duplication
 */

/**
 * Message type enum - shared across all SDKs
 */
export enum MessageType {
  Chat = 'Chat',
  Data = 'Data',
  Handoff = 'Handoff'
}

/**
 * Thread history message structure
 * Used by both WebSocket and REST communications
 */
export interface Message {
  id: string;
  createdAt: string;
  direction: 'Incoming' | 'Outgoing';
  messageType?: string;
  text?: string;
  data?: any;
  hint?: string;
  requestId?: string;
  participantId: string;
  workflowId: string;
  workflowType: string;
  scope?: string;
}

/**
 * Error response structure
 */
export interface MessageError {
  statusCode?: number;
  message: string;
}

/**
 * Base request structure shared between SDKs
 */
export interface BaseMessageRequest {
  requestId?: string;
  participantId: string;
  text?: string;
  data?: any;
  hint?: string;
  scope?: string;
  workflow: string;
  type: string;
}

/**
 * Common logger function type
 */
export type LoggerFunction = (level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any) => void;

/**
 * Base SDK options shared between SDKs
 */
export interface BaseSDKOptions {
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
   * Server URL for API communication
   */
  serverUrl: string;
  
  /**
   * Custom logger function. Defaults to console.log
   */
  logger?: LoggerFunction;
  
  /**
   * Optional namespace/prefix for logging
   */
  namespace?: string;
}

/**
 * Authentication type
 */
export type AuthType = 'apiKey' | 'jwtToken' | 'jwtCallback';

/**
 * Unified connection state enum used across all real-time SDKs
 */
export enum ConnectionState {
  Disconnected = 'Disconnected',
  Connecting = 'Connecting', 
  Connected = 'Connected',
  Disconnecting = 'Disconnecting',
  Reconnecting = 'Reconnecting',
  Failed = 'Failed'
}

/**
 * Standard configuration defaults shared across SDKs
 */
export const SDK_DEFAULTS = {
  connectionTimeout: 30000,    // 30 seconds
  reconnectDelay: 5000,       // 5 seconds
  maxReconnectAttempts: 5,    // 5 attempts
  autoReconnect: true,        // Enable by default
  requestTimeout: 30000       // For HTTP requests
} as const;

/**
 * Base event handlers interface shared across real-time SDKs
 */
export interface BaseEventHandlers {
  /**
   * Called when a chat message is received
   */
  onReceiveChat?: (message: Message) => void;
  
  /**
   * Called when a data message is received  
   */
  onReceiveData?: (message: Message) => void;
  
  /**
   * Called when a handoff message is received
   */
  onReceiveHandoff?: (message: Message) => void;
  
  /**
   * Called when connected to the server
   */
  onConnected?: () => void;
  
  /**
   * Called when disconnected from the server
   */
  onDisconnected?: (reason?: string) => void;
  
  /**
   * Called when attempting to reconnect
   */
  onReconnecting?: (reason?: string) => void;
  
  /**
   * Called when an error occurs
   */
  onError?: (error: string) => void;
}

/**
 * Base connection parameters interface shared across real-time SDKs
 */
export interface BaseConnectionParams {
  /**
   * Workflow identifier
   */
  workflow: string;
  
  /**
   * Participant identifier
   */
  participantId: string;
  
  /**
   * Optional scope for the connection
   */
  scope?: string;
}
