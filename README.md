# XiansAi TypeScript/JavaScript SDK

The XiansAi SDK provides both **WebSocket** and **REST** communication with XiansAi Server, enabling real-time chat capabilities and synchronous messaging for your applications.

## Features

- 🔄 **Real-time Communication**: WebSocket-based chat with automatic reconnection
- 🌐 **HTTP REST API**: Synchronous messaging and conversation management  
- 🔐 **Multiple Authentication**: API Key, JWT Token, or JWT Callback support
- 📝 **TypeScript Support**: Full type definitions and IntelliSense
- 🛡️ **Error Handling**: Comprehensive error handling and logging
- ⚡ **Async/Await**: Modern promise-based API

## Installation

```bash
npm install @xiansai/sdk
# or
yarn add @xiansai/sdk
```

## Quick Start

### WebSocket Communication (Real-time)

```typescript
import { SocketSDK, MessageType } from '@xiansai/sdk';

const socketSDK = new SocketSDK({
  tenantId: 'your-tenant-id',
  apiKey: 'your-api-key',
  serverUrl: 'https://your-server.com',
  eventHandlers: {
    onReceiveChat: (message) => {
      console.log('New message:', message.text);
    },
    onInboundProcessed: (threadId) => {
      console.log('Message processed:', threadId);
    }
  }
});

// Connect and subscribe
await socketSDK.connect();
await socketSDK.subscribeToAgent('workflow-id', 'user-123');

// Send a message
await socketSDK.sendInboundMessage({
  participantId: 'user-123',
  workflowType: 'customer-support',
  text: 'Hello, I need help!',
  data: { priority: 'high' }
}, MessageType.Chat);
```

### REST Communication (Synchronous)

```typescript
import { RestSDK } from '@xiansai/sdk';

const restSDK = new RestSDK({
  tenantId: 'your-tenant-id',
  apiKey: 'your-api-key',
  serverUrl: 'https://your-server.com'
});

// Send and wait for response
const result = await restSDK.converse({
  participantId: 'user-123',
  workflow: 'customer-support',
  type: 'Chat',
  text: 'What is my order status?',
  timeoutSeconds: 30
});

if (result.success && result.data) {
  console.log('Received responses:', result.data);
}
```

## Authentication Methods

### 1. API Key Authentication

```typescript
const sdk = new SocketSDK({
  tenantId: 'your-tenant-id',
  apiKey: 'sk-1234567890',
  serverUrl: 'https://your-server.com'
});
```

### 2. JWT Token Authentication

```typescript
const sdk = new SocketSDK({
  tenantId: 'your-tenant-id',
  jwtToken: 'your-jwt-token',
  serverUrl: 'https://your-server.com'
});
```

### 3. JWT Callback Authentication (Recommended)

```typescript
const sdk = new SocketSDK({
  tenantId: 'your-tenant-id',
  serverUrl: 'https://your-server.com',
  getJwtToken: async () => {
    const response = await fetch('/api/auth/token');
    const { token } = await response.json();
    return token;
  }
});
```

## API Reference

### SocketSDK (WebSocket)

#### Methods

##### `connect(): Promise<void>`
Establishes WebSocket connection to the server.

##### `disconnect(): Promise<void>`
Closes the WebSocket connection.

##### `sendInboundMessage(request, messageType): Promise<void>`
Sends a message to the workflow via WebSocket.

```typescript
await socketSDK.sendInboundMessage({
  participantId: 'user-123',
  workflowType: 'support',
  text: 'Hello!',
  data: { context: 'help' }
}, MessageType.Chat);
```

##### `subscribeToAgent(workflow, participantId): Promise<void>`
Subscribes to receive messages from a specific workflow.

##### `getThreadHistory(workflow, participantId, page?, pageSize?, scope?): Promise<void>`
Requests conversation history (results come via `onThreadHistory` event).

#### Event Handlers

```typescript
const eventHandlers = {
  onThreadHistory: (history: Message[]) => {
    console.log('Received history:', history);
  },
  onInboundProcessed: (threadId: string) => {
    console.log('Message processed:', threadId);
  },
  onReceiveChat: (message: Message) => {
    console.log('Chat message:', message.text);
  },
  onReceiveData: (message: Message) => {
    console.log('Data message:', message.data);
  },
  onError: (error: string) => {
    console.error('Error:', error);
  },
  onConnectionStateChanged: (oldState, newState) => {
    console.log(`Connection: ${oldState} → ${newState}`);
  }
};
```

### RestSDK (HTTP)

#### Methods

##### `send(request): Promise<RestResponse<any>>`
Sends a message without waiting for response.

```typescript
const result = await restSDK.send({
  participantId: 'user-123',
  workflow: 'support',
  type: 'Chat',
  text: 'Hello!',
  data: { context: 'help' }
});
```

##### `converse(request): Promise<RestResponse<Message[]>>`
Sends a message and waits synchronously for response.

```typescript
const result = await restSDK.converse({
  participantId: 'user-123',
  workflow: 'support',
  type: 'Chat',
  text: 'What can you help me with?',
  timeoutSeconds: 30
});
```

##### `getHistory(request): Promise<RestResponse<Message[]>>`
Retrieves conversation history.

```typescript
const result = await restSDK.getHistory({
  workflow: 'support',
  participantId: 'user-123',
  page: 1,
  pageSize: 20,
  scope: 'support-tickets'
});
```

## Message Types

### MessageRequest (WebSocket)
```typescript
interface MessageRequest {
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
```

### RestMessageRequest (REST)
```typescript
interface RestMessageRequest {
  requestId?: string;
  participantId: string;
  workflow: string;
  type: string;
  text?: string;
  data?: any;
  timeoutSeconds?: number;
}
```

### Message (Response)
```typescript
interface Message {
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
```

## Configuration Options

### SocketSDKOptions
```typescript
interface SocketSDKOptions {
  tenantId: string;
  apiKey?: string;
  jwtToken?: string;
  getJwtToken?: () => Promise<string> | string;
  serverUrl: string;
  logger?: (level: string, message: string, data?: any) => void;
  namespace?: string;
  autoReconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  connectionTimeout?: number;
  eventHandlers?: EventHandlers;
}
```

### RestSDKOptions
```typescript
interface RestSDKOptions {
  tenantId: string;
  apiKey?: string;
  jwtToken?: string;
  getJwtToken?: () => Promise<string> | string;
  serverUrl: string;
  logger?: (level: string, message: string, data?: any) => void;
  namespace?: string;
  requestTimeout?: number;
  defaultConverseTimeout?: number;
  maxConverseTimeout?: number;
}
```

## Best Practices

### When to Use WebSocket vs REST

#### Use **SocketSDK** (WebSocket) when:
- You need real-time, bidirectional communication
- You want to receive immediate notifications when agents respond
- You're building a chat interface or real-time dashboard
- You need to maintain persistent connections with automatic reconnection

#### Use **RestSDK** (HTTP) when:
- You need synchronous request-response patterns
- You're integrating with existing REST-based architectures
- You need simpler error handling and don't require real-time updates
- You're building APIs, webhooks, or batch processing systems

### Combining Both SDKs

You can use both SDKs together for different use cases:

```typescript
import { SocketSDK, RestSDK, MessageType } from '@xiansai/sdk';

// Real-time notifications
const socketSDK = new SocketSDK({
  tenantId: 'my-tenant',
  apiKey: 'my-api-key',
  serverUrl: 'https://api.example.com',
  eventHandlers: {
    onReceiveChat: (message) => {
      updateUI(message);
    }
  }
});

// Synchronous operations
const restSDK = new RestSDK({
  tenantId: 'my-tenant',
  apiKey: 'my-api-key',
  serverUrl: 'https://api.example.com'
});

// Connect WebSocket for real-time updates
await socketSDK.connect();
await socketSDK.subscribeToAgent('support', 'user-123');

// Use REST for initial data loading
const history = await restSDK.getHistory({
  workflow: 'support',
  participantId: 'user-123',
  page: 1,
  pageSize: 50
});

// Send urgent messages via REST (with timeout)
const urgentResponse = await restSDK.converse({
  participantId: 'user-123',
  workflow: 'support',
  type: 'Chat',
  text: 'URGENT: System is down!',
  timeoutSeconds: 10
});
```

### Error Handling

```typescript
// WebSocket error handling
const socketSDK = new SocketSDK({
  // ... config
  eventHandlers: {
    onError: (error) => {
      console.error('WebSocket error:', error);
      // Handle reconnection logic
    },
    onConnectionStateChanged: (oldState, newState) => {
      if (newState === ConnectionState.Disconnected) {
        // Notify user of disconnection
        showNotification('Connection lost. Attempting to reconnect...');
      }
    }
  }
});

// REST error handling
try {
  const result = await restSDK.converse(request);
  if (!result.success) {
    console.error('Request failed:', result.error);
    if (result.statusCode === 401) {
      // Handle authentication error
      redirectToLogin();
    }
  }
} catch (error) {
  console.error('Network error:', error);
  // Handle network failures
}
```

### Logging

Both SDKs support custom logging:

```typescript
const logger = (level: string, message: string, data?: any) => {
  // Send to your logging service
  console.log(`[${level.toUpperCase()}] ${message}`, data);
};

const sdk = new SocketSDK({
  // ... config
  logger,
  namespace: 'MyApp'
});
```

## Testing

### Integration Tests

The SDK includes comprehensive integration tests. To run them:

```bash
# Create test/.env file with your credentials
echo "API_KEY=your-api-key" > test/.env
echo "SERVER_URL=https://your-server.com" >> test/.env
echo "TENANT_ID=your-tenant-id" >> test/.env
echo "PARTICIPANT_ID=test-user" >> test/.env
echo "WORKFLOW_TYPE=test-workflow" >> test/.env

# Run tests
npm test
```

### Example Test Configuration

```bash
# test/.env
API_KEY=sk-1234567890abcdef
SERVER_URL=https://api.xiansai.com
TENANT_ID=my-company
PARTICIPANT_ID=test-user-123
WORKFLOW_TYPE=customer-support
```

## TypeScript Support

The SDK is built with TypeScript and provides full type definitions:

```typescript
import { SocketSDK, RestSDK, Message, MessageType, ConnectionState } from '@xiansai/sdk';

// Full IntelliSense and type checking
const message: Message = {
  id: '123',
  createdAt: new Date().toISOString(),
  direction: 'Incoming',
  text: 'Hello!',
  participantId: 'user-123',
  workflowId: 'workflow-456',
  workflowType: 'support'
};
```

## Troubleshooting

### Common Issues

1. **Connection Failures**
   - Verify `serverUrl` is correct
   - Check network connectivity
   - Ensure authentication credentials are valid

2. **Authentication Errors**
   - Verify `tenantId`, `apiKey`, or JWT token
   - Check token expiration for JWT authentication
   - Ensure proper permissions are granted

3. **Message Not Received**
   - Verify WebSocket subscription with `subscribeToAgent()`
   - Check event handlers are properly configured
   - Ensure workflow is running and configured to respond

4. **Timeout Issues**
   - Increase `timeoutSeconds` for REST operations
   - Check `maxConverseTimeout` configuration
   - Verify workflow response times

### Debug Logging

Enable debug logging to troubleshoot issues:

```typescript
const sdk = new SocketSDK({
  // ... config
  logger: (level, message, data) => {
    if (level === 'debug' || level === 'error') {
      console.log(`[${level}] ${message}`, data);
    }
  }
});
```

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our repository.

## License

This SDK is licensed under the MIT License. See the LICENSE file for details.

## Support

For support, please contact our team or visit our documentation at [https://docs.xiansai.com](https://docs.xiansai.com). 