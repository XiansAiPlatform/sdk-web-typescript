# TypeScript Types Reference

This document provides a comprehensive reference for all TypeScript types exported by the XiansAi SDK. These types help ensure type safety and provide IntelliSense support in TypeScript projects.

## Table of Contents

- [Shared/Base Types](#sharedbase-types)
  - [Enums](#enums)
  - [Core Interfaces](#core-interfaces)
  - [Event Handlers](#event-handlers)
  - [Configuration Types](#configuration-types)
- [SocketSDK Types](#socketsdk-types)
- [RestSDK Types](#restsdk-types)
- [SseSDK Types](#ssesdk-types)
- [Usage Examples](#usage-examples)

## Shared/Base Types

These types are shared across all SDKs to ensure consistency and reduce duplication.

### Enums

#### MessageType

Defines the types of messages that can be sent and received.

```typescript
enum MessageType {
  Chat = 'Chat',      // Text-based chat messages
  Data = 'Data',      // Structured data messages
  Handoff = 'Handoff' // Handoff to human agent messages
}
```

#### ConnectionState

Represents the connection status for real-time SDKs (Socket and SSE).

```typescript
enum ConnectionState {
  Disconnected = 'Disconnected',   // Not connected
  Connecting = 'Connecting',       // Attempting to connect
  Connected = 'Connected',         // Successfully connected
  Disconnecting = 'Disconnecting', // Closing connection
  Reconnecting = 'Reconnecting',   // Attempting to reconnect
  Failed = 'Failed'                // Connection failed
}
```

### Core Interfaces

#### Message

Represents a thread history message structure used across all SDKs.

```typescript
interface Message {
  id: string;                           // Unique message identifier
  createdAt: string;                    // ISO timestamp of creation
  direction: 'Incoming' | 'Outgoing';   // Message direction
  messageType?: string;                 // Type of message (Chat, Data, Handoff)
  text?: string;                        // Text content (for chat messages)
  data?: any;                          // Structured data (for data messages)
  hint?: string;                       // Optional hint for AI processing
  requestId?: string;                  // Optional request correlation ID
  participantId: string;               // Participant who sent/received the message
  workflowId: string;                  // Workflow instance identifier
  workflowType: string;                // Workflow type identifier
  scope?: string;                      // Optional scope for message routing
}
```

#### MessageError

Standard error response structure.

```typescript
interface MessageError {
  statusCode?: number;  // HTTP status code (if applicable)
  message: string;      // Error description
}
```

#### BaseMessageRequest

Base request structure shared between SDKs.

```typescript
interface BaseMessageRequest {
  requestId?: string;      // Optional request correlation ID
  participantId: string;   // Participant sending the message
  text?: string;          // Text content (for chat messages)
  data?: any;             // Structured data (for data messages)
  hint?: string;          // Optional hint for AI processing
  scope?: string;         // Optional scope for message routing
  workflow: string;       // Workflow identifier
  type: string;          // Message type ('Chat', 'Data', 'Handoff')
  authorization?: string; // Optional per-request authorization
}
```

### Event Handlers

#### BaseEventHandlers

Base event handlers interface shared across real-time SDKs.

```typescript
interface BaseEventHandlers {
  onReceiveChat?: (message: Message) => void;        // Chat message received
  onReceiveData?: (message: Message) => void;        // Data message received
  onReceiveHandoff?: (message: Message) => void;     // Handoff message received
  onConnected?: () => void;                          // Connected to server
  onDisconnected?: (reason?: string) => void;       // Disconnected from server
  onReconnecting?: (reason?: string) => void;       // Attempting to reconnect
  onError?: (error: string) => void;                // Error occurred
}
```

#### BaseConnectionParams

Base connection parameters for real-time SDKs.

```typescript
interface BaseConnectionParams {
  workflow: string;       // Workflow identifier
  participantId: string;  // Participant identifier
  scope?: string;         // Optional scope for the connection
}
```

### Configuration Types

#### BaseSDKOptions

Base configuration options shared between all SDKs.

```typescript
interface BaseSDKOptions {
  tenantId: string;                                    // Tenant ID for authentication
  apiKey?: string;                                     // API Key (required if JWT not provided)
  jwtToken?: string;                                   // Static JWT token (fallback)
  getJwtToken?: () => Promise<string> | string;       // Dynamic JWT token provider
  serverUrl: string;                                   // Server URL for API communication
  logger?: LoggerFunction;                             // Custom logger (defaults to console.log)
  namespace?: string;                                  // Optional logging namespace/prefix
}
```

#### LoggerFunction

Type definition for custom logger functions.

```typescript
type LoggerFunction = (
  level: 'info' | 'warn' | 'error' | 'debug',
  message: string,
  data?: any
) => void;
```

#### AuthType

Authentication method type.

```typescript
type AuthType = 'apiKey' | 'jwtToken' | 'jwtCallback';
```

#### SDK_DEFAULTS

Standard configuration defaults shared across SDKs.

```typescript
const SDK_DEFAULTS = {
  connectionTimeout: 30000,     // 30 seconds
  reconnectDelay: 5000,        // 5 seconds
  maxReconnectAttempts: 5,     // 5 attempts
  autoReconnect: true,         // Enable by default
  requestTimeout: 30000        // For HTTP requests
} as const;
```

## SocketSDK Types

Types specific to real-time WebSocket communication.

### MessageRequest

WebSocket-specific message request structure.

```typescript
interface MessageRequest extends BaseMessageRequest {
  threadId?: string;  // Optional thread identifier for WebSocket messages
}
```

### EventHandlers

SocketSDK-specific event handlers extending base handlers.

```typescript
interface EventHandlers extends BaseEventHandlers {
  onThreadHistory?: (history: Message[]) => void;                                    // Thread history received
  onInboundProcessed?: (threadId: string) => void;                                  // Inbound message processed
  onConnectionError?: (error: { statusCode: number; message: string }) => void;    // Connection error
  onConnectionStateChanged?: (oldState: ConnectionState, newState: ConnectionState) => void; // State change
  onReconnected?: (connectionId?: string) => void;                                 // Reconnected successfully
}
```

### SocketSDKOptions

Configuration options for SocketSDK.

```typescript
interface SocketSDKOptions extends BaseSDKOptions {
  autoReconnect?: boolean;        // Auto-reconnect on connection loss (default: true)
  reconnectDelay?: number;        // Reconnection delay in ms (default: 5000)
  maxReconnectAttempts?: number;  // Max reconnection attempts (default: 5)
  connectionTimeout?: number;     // Connection timeout in ms (default: 30000)
  eventHandlers?: EventHandlers;  // Event handlers for communication
}
```

## RestSDK Types

Types specific to HTTP-based synchronous communication.

### RestMessageRequest

REST-specific message request structure.

```typescript
interface RestMessageRequest extends BaseMessageRequest {
  timeoutSeconds?: number;  // Request timeout in seconds
}
```

### RestResponse

Generic response structure for REST endpoints.

```typescript
interface RestResponse<T = any> {
  success: boolean;    // Whether the operation succeeded
  data?: T;           // Response data (if successful)
  error?: string;     // Error message (if failed)
  statusCode?: number; // HTTP status code
}
```

### HistoryRequest

Parameters for retrieving conversation history.

```typescript
interface HistoryRequest {
  workflow: string;       // Workflow identifier
  participantId: string;  // Participant identifier
  page?: number;         // Page number for pagination (default: 1)
  pageSize?: number;     // Items per page (default: 20)
  scope?: string;        // Optional scope filter
}
```

### RestSDKOptions

Configuration options for RestSDK.

```typescript
interface RestSDKOptions extends BaseSDKOptions {
  requestTimeout?: number;           // Request timeout in ms (default: 30000)
  defaultConverseTimeout?: number;   // Default converse timeout in seconds (default: 60)
  maxConverseTimeout?: number;       // Maximum converse timeout in seconds (default: 300)
}
```

## SseSDK Types

Types specific to Server-Sent Events real-time communication.

### Core Event Types

#### HeartbeatData

Heartbeat event data structure.

```typescript
interface HeartbeatData {
  timestamp: string;      // ISO timestamp of heartbeat
  subscriberCount: number; // Number of active subscribers
}
```

#### SseEvent

Base SSE event data structure.

```typescript
interface SseEvent {
  type: string;    // Event type identifier
  data: any;      // Event payload
  id?: string;    // Optional event ID
  retry?: number; // Optional retry interval
}
```

### Specific Event Types

#### SseHeartbeatEvent

SSE heartbeat event structure.

```typescript
interface SseHeartbeatEvent extends SseEvent {
  type: 'heartbeat';
  data: HeartbeatData;
}
```

#### SseMessageEvent

SSE message event for Chat, Data, and Handoff events.

```typescript
interface SseMessageEvent extends SseEvent {
  type: 'Chat' | 'Data' | 'Handoff';
  data: Message;
}
```

#### SseErrorEvent

SSE error event structure.

```typescript
interface SseErrorEvent extends SseEvent {
  type: 'error';
  data: {
    error: string;      // Error description
    code?: string;      // Optional error code
    timestamp: string;  // ISO timestamp of error
  };
}
```

#### SseConnectionEvent

SSE connection status event structure.

```typescript
interface SseConnectionEvent extends SseEvent {
  type: 'connected' | 'disconnected' | 'reconnecting';
  data: {
    timestamp: string; // ISO timestamp of event
    reason?: string;   // Optional reason for state change
  };
}
```

### Union and Handler Types

#### SseAnyEvent

Union type for all possible SSE events.

```typescript
type SseAnyEvent = SseMessageEvent | SseHeartbeatEvent | SseErrorEvent | SseConnectionEvent | SseEvent;
```

#### SseEventHandler

Generic event handler type.

```typescript
type SseEventHandler<T extends SseEvent = SseAnyEvent> = (event: T) => void;
```

### SSE Configuration Types

#### SseEventHandlers

SSE-specific event handlers extending base handlers.

```typescript
interface SseEventHandlers extends BaseEventHandlers {
  onHeartbeat?: (data: HeartbeatData) => void;  // Heartbeat received
}
```

#### SseConnectionParams

Connection parameters for SSE stream.

```typescript
interface SseConnectionParams extends BaseConnectionParams {
  heartbeatSeconds?: number;  // Heartbeat interval in seconds
}
```

#### SseSDKOptions

Configuration options for SseSDK.

```typescript
interface SseSDKOptions extends BaseSDKOptions {
  maxReconnectAttempts?: number;  // Reconnection attempts before giving up (default: 5)
  reconnectDelay?: number;        // Delay between reconnection attempts in ms (default: 5000)
  connectionTimeout?: number;     // Connection timeout in ms (default: 30000)
  autoReconnect?: boolean;        // Auto-reconnect on connection loss (default: true)
  eventHandlers?: SseEventHandlers; // Event handlers for SSE communication
}
```

## Usage Examples

### Importing Types

```typescript
import { 
  // Shared types
  Message, 
  MessageType, 
  ConnectionState,
  BaseSDKOptions,
  
  // SocketSDK types
  SocketSDKOptions,
  EventHandlers,
  MessageRequest,
  
  // RestSDK types
  RestSDKOptions,
  RestResponse,
  HistoryRequest,
  
  // SseSDK types
  SseSDKOptions,
  SseEvent,
  HeartbeatData,
  
  // SDK classes
  SocketSDK,
  RestSDK,
  SseSDK
} from '@99xio/xians-sdk-typescript';
```

### Type-Safe Configuration

```typescript
// SocketSDK with type-safe configuration
const socketOptions: SocketSDKOptions = {
  tenantId: 'my-tenant',
  apiKey: 'sk-123',
  serverUrl: 'https://api.example.com',
  autoReconnect: true,
  maxReconnectAttempts: 3,
  eventHandlers: {
    onReceiveChat: (message: Message) => {
      console.log('Received chat:', message.text);
    },
    onConnectionStateChanged: (oldState: ConnectionState, newState: ConnectionState) => {
      console.log(`State changed: ${oldState} -> ${newState}`);
    }
  }
};

const socketSDK = new SocketSDK(socketOptions);
```

### Type-Safe Message Handling

```typescript
// Type-safe message sending
const messageRequest: MessageRequest = {
  participantId: 'user-123',
  workflow: 'customer-support',
  type: MessageType.Chat,
  text: 'Hello, I need help!',
  hint: 'User needs technical support'
};

await socketSDK.sendInboundMessage(messageRequest, MessageType.Chat);
```

### Type-Safe REST Responses

```typescript
// Type-safe REST response handling
const response: RestResponse<Message[]> = await restSDK.converse({
  participantId: 'user-123',
  workflow: 'support',
  type: 'Chat',
  text: 'What is my order status?',
  timeoutSeconds: 30
});

if (response.success && response.data) {
  response.data.forEach((message: Message) => {
    console.log(`${message.direction}: ${message.text}`);
  });
} else {
  console.error('Conversation failed:', response.error);
}
```

### Type-Safe SSE Event Handling

```typescript
// Type-safe SSE event handling
const sseOptions: SseSDKOptions = {
  tenantId: 'my-tenant',
  apiKey: 'sk-123',
  serverUrl: 'https://api.example.com',
  eventHandlers: {
    onReceiveChat: (message: Message) => {
      console.log('SSE Chat received:', message.text);
    },
    onHeartbeat: (data: HeartbeatData) => {
      console.log(`Heartbeat: ${data.subscriberCount} subscribers at ${data.timestamp}`);
    }
  }
};

const sseSDK = new SseSDK(sseOptions);
```

## Type Safety Best Practices

1. **Always import specific types** you need rather than using `any`
2. **Use union types** like `MessageType` for type-safe enums
3. **Leverage generic types** like `RestResponse<T>` for typed responses
4. **Implement event handlers** with proper type annotations
5. **Use optional properties** (`?`) appropriately for flexible configurations
6. **Extend base interfaces** when creating custom configurations

## Related Documentation

- **[Overview](./overview.md)** - Architecture and SDK comparison
- **[Authentication](./authentication.md)** - Authentication setup and security
- **[Quick Start Examples](./examples/quick-start.md)** - Practical implementation examples
- **[Message Types](./message-types.md)** - Detailed message structure documentation
