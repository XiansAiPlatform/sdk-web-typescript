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
