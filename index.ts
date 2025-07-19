/**
 * XiansAi SDK for TypeScript/JavaScript
 * Provides both WebSocket and REST communication with XiansAi Server
 */

// Export shared types
export type {
  MessageType,
  Message,
  MessageError,
  BaseMessageRequest,
  BaseSDKOptions,
  LoggerFunction,
  AuthType
} from './types';

// Export SocketSDK
export { default as SocketSDK } from './SocketSDK';
export type {
  MessageRequest,
  ConnectionState,
  EventHandlers,
  SocketSDKOptions
} from './SocketSDK';

// Export RestSDK
export { default as RestSDK } from './RestSDK';
export type {
  RestMessageRequest,
  RestResponse,
  HistoryRequest,
  RestSDKOptions
} from './RestSDK';

/**
 * Example usage of both SDKs:
 * 
 * ```typescript
 * import { SocketSDK, RestSDK, MessageType, RestMessageType } from 'xiansai-sdk';
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