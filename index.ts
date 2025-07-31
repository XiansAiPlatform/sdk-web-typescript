/**
 * XiansAi SDK for TypeScript/JavaScript
 * Provides both WebSocket and REST communication with XiansAi Server
 */

// Export shared types
export type {
  Message,
  MessageError,
  BaseMessageRequest,
  BaseSDKOptions,
  LoggerFunction,
  AuthType,
  BaseEventHandlers,
  BaseConnectionParams
} from './types';

// Export unified interfaces and enums (as values)
export { MessageType, ConnectionState, SDK_DEFAULTS } from './types';

// Export SocketSDK types
export type {
  MessageRequest,
  EventHandlers,
  SocketSDKOptions
} from './SocketSDK';

// Export RestSDK types  
export type {
  RestMessageRequest,
  RestResponse,
  HistoryRequest,
  RestSDKOptions
} from './RestSDK';

// Export SseSDK types
export type {
  HeartbeatData,
  SseEvent,
  SseHeartbeatEvent,
  SseMessageEvent,
  SseErrorEvent,
  SseConnectionEvent,
  SseAnyEvent,
  SseEventHandler,
  SseEventHandlers,
  SseConnectionParams,
  SseSDKOptions
} from './SseSDK';

// Export SDK classes
export { default as SocketSDK } from './SocketSDK';
export { default as RestSDK } from './RestSDK';
export { default as SseSDK } from './SseSDK';
export { default as AgentSDK } from './AgentSDK';

/**
 * Example usage of both SDKs:
 * 
 * ```typescript
 * import { SocketSDK, RestSDK, MessageType, RestMessageType } from '@99xio/xians-sdk-typescript';
 * 
 * // For real-time communication
 * const socketSDK = new SocketSDK({
 *   tenantId: 'my-tenant',
 *   apiKey: 'my-api-key',
 *   serverUrl: 'https://api.xiansai.com',
 *   eventHandlers: {
 *     onReceiveChat: (message) => console.log('New message:', message.text)
 *   }
 * });
 * 
 * // For HTTP-based communication
 * const restSDK = new RestSDK({
 *   tenantId: 'my-tenant',
 *   apiKey: 'my-api-key',
 *   serverUrl: 'https://api.xiansai.com'
 * });
 * 
 * // Connect to WebSocket
 * await socketSDK.connect();
 * await socketSDK.subscribeToAgent('workflow-id', 'user-123');
 * 
 * // Send via WebSocket
 * await socketSDK.sendInboundMessage({
 *   participantId: 'user-123',
 *   workflowType: 'support',
 *   text: 'Hello via WebSocket'
 * }, MessageType.Chat);
 * 
 * // Send via REST and wait for response
 * const response = await restSDK.converse({
 *   participantId: 'user-123',
 *   workflow: 'support',
 *   type: 'Chat',
 *   text: 'Hello via REST'
 * });
 * 
 * if (response.success) {
 *   console.log('Response messages:', response.data);
 * }
 * ```
 */ 