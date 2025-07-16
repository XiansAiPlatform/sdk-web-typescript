# Xians SDK TypeScript

A **light-weight, framework-agnostic** wrapper that hides all WebSocket/SignalR complexity behind a handful of ergonomic methods.

## Installation

Install the package using npm:

```bash
npm install @99xio/xians-sdk-typescript
```

Or using yarn:

```bash
yarn add @99xio/xians-sdk-typescript
```

## Import

```ts
import AgentSDK from '@99xio/xians-sdk-typescript';
//   or
import { AgentSDK } from '@99xio/xians-sdk-typescript';

// Import types
import { type ChatMessageData, type HandoffMessage } from '@99xio/xians-sdk-typescript';
```

## Quick Start

```ts
import AgentSDK from '@99xio/xians-sdk-typescript';

// 1️⃣  Configure once (typically on app start-up)
const sdk = new AgentSDK({
  // ---- mandatory settings ----
  agentWebsocketUrl: '<YOUR_BOT_BACKEND_WEBSOCKET_URL>',
  Authorization:      'Bearer <YOUR_API_KEY>',
  tenantId:           '<YOUR_TENANT_ID>',
  participantId:      '<PARTICIPANT_ID>',
  
  // ---- optional ----
  getDefaultData: () => {
    // Return contextual data that changes with application state
    const context = { currentStep: getCurrentStep(), userId: getUserId() };
    return JSON.stringify(context);
  }
});

// 2️⃣  Establish all agent connections with their workflow type and workflow id
await sdk.connect([
  {
    workflowType: 'MyAgentType',  // optional, if not provided, the workflowId must be provided
    workflowId: 'agent_workflow_123', // optional, if not provided, the workflowType must be provided
  }
]);

// 3️⃣  Subscribe to specific message types (recommended)
const stopChatMessages = sdk.subscribeToChatMessages((chat) => {
  console.log('💬 Chat message:', chat.text);
  console.log('From workflow:', chat.workflowId);
});
const stopHandoffs = sdk.subscribeToHandoffs((handoff) => {
  console.log('🔄 Handoff to:', handoff.workflowId);
});
const stopDataMessages = sdk.subscribeToData('my_service', ['DocumentResponse'], (data) => {
  console.log('📄 Data received:', data);
});

// Alternative: Listen to all messages (less recommended)
const stopAll = sdk.on('message', (evt) => {
  console.log('📨 Any message', evt);
});

// 4️⃣  Talk to an agent
await sdk.sendChat('MyAgentType', 'Hello there!');
await sdk.sendData('MyAgentType', { some: 'json' });

// 5️⃣  Gracefully shut down when navigating away
await sdk.disconnect();
```

## API

### `new AgentSDK(options)`
Creates a new SDK instance. Internally it re-uses a **singleton** WebSocket hub, so multiple instances share the same connections.

#### `options`
Configuration object with required settings:

```ts
interface AgentSDKOptions {
  agentWebsocketUrl: string;  // Full WebSocket hub URL
  Authorization: string;      // Bearer token or similar authentication credential
  tenantId: string;          // Tenant identifier for multi-tenant applications
  participantId: string;     // Unique identifier for the participant/user
  getDefaultData?: () => string | undefined; // Optional function to get contextual data for each chat
}
```

---

### `.connect(agents)` → `Promise<void>`
Initialises the underlying `WebSocketHub` and opens SignalR connections for **all** configured agents.

**Parameters:**
- `agents`: Array of agent configurations

```ts
interface AgentFlow {
  workflowType?: string; // Server-side unique workflow identifier (optional if workflowId provided)
  workflowId?: string;   // Optional workflow instance ID (optional if workflowType provided)
}
```

### `.disconnect()` → `Promise<void>`
Stops **all** active connections and cleans up resources.

### `.sendChat(id, text, data?, scope?, hint?)` → `Promise<void>`
Sends a plain-text chat message to the specified agent.

**Parameters:**
- `id`: The workflow ID or workflow type of the target agent
- `text`: The message text to send
- `data`: Optional additional data to include with the message (default: `{}`)
- `scope`: Optional scope for the message
- `hint`: Optional hint for the message

The method automatically includes default data from the `getDefaultData()` function (if configured).

```typescript
// Basic usage
await sdk.sendChat('DocumentDataFlow', 'Hello there!');

// With additional data
await sdk.sendChat('DocumentDataFlow', 'Process this', { documentId: '123' });

// With scope and hint
await sdk.sendChat('DocumentDataFlow', 'Special request', {}, 'priority', 'urgent');
```

### `.sendData(id, data, scope?)` → `Promise<void>`
Sends a structured JSON payload as a `Data` message.

**Parameters:**
- `id`: The workflow ID or workflow type of the target agent
- `data`: The data payload to send (must be JSON-serializable)
- `scope`: Optional scope for the message

---

## Dynamic Default Data

The SDK supports dynamic default data that gets automatically included with every chat message. This is useful for sending contextual information that changes based on the current application state.

### Configuration

Set up the `getDefaultData` function when creating the SDK instance:

```typescript
import AgentSDK from '@99xio/xians-sdk-typescript';

const sdk = new AgentSDK({
  agentWebsocketUrl: 'wss://your-hub.com/hub',
  Authorization: 'Bearer your-token',
  tenantId: 'your-tenant',
  participantId: 'user-123',
  getDefaultData: () => {
    // Return contextual data as JSON string
    const currentContext = {
      documentId: getCurrentDocumentId(),
      stepIndex: getCurrentStepIndex(),
      userPreferences: getUserPreferences()
    };
    return JSON.stringify(currentContext);
  }
});
```

### Usage

- **Automatic inclusion**: Default data is automatically included with every `sendChat()` call
- **Dynamic computation**: The function is called fresh for each message, ensuring up-to-date context

```typescript
// Uses dynamic default data
await sdk.sendChat('workflow_id', 'Hello');

// Additional data is merged with default data
await sdk.sendChat('workflow_id', 'Process this', { priority: 'urgent' });
```

---

## Message Subscriptions

The SDK provides **specialized subscription methods** for different message types, offering clean separation of concerns and type safety.

### `.subscribeToChatMessages(callback)` → `() => void`
Subscribe specifically to chat messages (regular conversation messages).

```typescript
import { type ChatMessageData } from '@99xio/xians-sdk-typescript';

const unsubscribe = sdk.subscribeToChatMessages((chat: ChatMessageData) => {
  console.log('Chat received:', chat.text);
  console.log('From workflow:', chat.workflowId);
  console.log('Direction:', chat.direction); // 'Incoming' | 'Outgoing'
});

// Cleanup when done
unsubscribe();
```

**ChatMessageData Interface:**
```typescript
interface ChatMessageData {
  text: string;
  scope?: string;
  hint?: string;
  direction: 'Incoming' | 'Outgoing';
  timestamp: Date;
  threadId: string;
  data?: any;
  isHistorical: boolean;
}
```

### `.subscribeToData(subscriberId, messageTypes, callback)` → `() => void`
Subscribe to structured data messages from agents.

```typescript
const unsubscribe = sdk.subscribeToData(
  'my_service',
  ['DocumentResponse', 'ActivityLog'],
  (data: any) => {
    console.log('Data received:', data);
    if (data.messageType === 'DocumentResponse') {
      handleDocumentResponse(data);
    }
  }
);
```

### `.subscribeToHandoffs(callback)` → `() => void`
Subscribe specifically to handoff messages (agent-to-agent transitions).

```typescript
import { type HandoffMessage } from '@99xio/xians-sdk-typescript';

const unsubscribe = sdk.subscribeToHandoffs((handoff: HandoffMessage) => {
  console.log('Handoff to:', handoff.workflowId);
  console.log('Message:', handoff.text);
  
  // Handle navigation or UI updates
  if (!handoff.isHistorical) {
    navigateToWorkflow(handoff.workflowId);
  }
});
```

**HandoffMessage Interface:**
```typescript
interface HandoffMessage {
  text: string;
  scope?: string;
  direction: 'Incoming' | 'Outgoing';
  timestamp: Date;
  threadId: string;
  data?: any;
  isHistorical: boolean;
}
```

---

## Additional Methods

### `.refreshThreadHistory(id, scope)` → `Promise<boolean>`
Refresh thread history for a specific workflow by requesting it from the server.

**Parameters:**
- `id`: The workflow ID or workflow type to refresh history for
- `scope`: Scope for the history request (required)

**Returns:** `true` if the request was successful, `false` otherwise.

### `.getConnectionStates()` → `Map<number, ConnectionState>`
Get current connection states for all agents.

### `.getChatHistory(workflowType)` → `Message[]`
Retrieve chat history for a given workflow.

### `.getStats()` → `object`
Get hub statistics for debugging.

### `.getAgentConnectionStateById(id)` → `ConnectionState | undefined`
Get connection state for a specific agent.

---

## TypeScript Support

This package is written in TypeScript and provides full type definitions. All interfaces and types are exported:

```typescript
import { 
  AgentSDK, 
  type AgentSDKOptions,
  type ChatMessageData,
  type HandoffMessage 
} from '@99xio/xians-sdk-typescript';
```

---

## React Integration

The SDK works seamlessly with React. Here are some example hooks:

```typescript
import { useEffect, useState } from 'react';
import { type ChatMessageData } from '@99xio/xians-sdk-typescript';

function useChatMessages(sdk: AgentSDK) {
  const [messages, setMessages] = useState<ChatMessageData[]>([]);

  useEffect(() => {
    const unsubscribe = sdk.subscribeToChatMessages((chat) => {
      setMessages(prev => [...prev, chat]);
    });

    return unsubscribe;
  }, [sdk]);

  return messages;
}
```

---

## Error Handling

The SDK provides comprehensive error handling with detailed error messages:

```typescript
try {
  await sdk.connect([{ workflowType: 'MyAgent' }]);
} catch (error) {
  console.error('Connection failed:', error.message);
  // Error messages include context like:
  // "[AgentSDK] Failed to establish connections: [ConnectionManager] Failed to connect to agent MyAgent: Connection timeout"
}
```

All public methods validate their inputs and throw descriptive errors when:
- Required parameters are missing or invalid
- SDK is not initialized when needed
- Network or server errors occur

---

## Singleton Pattern

The SDK supports a singleton pattern for shared instances across your application:

```typescript
// Initialize shared instance (usually in app startup)
const sdk = AgentSDK.initShared(options);

// Get shared instance elsewhere in your app
const sdk = AgentSDK.getShared();

// Reset shared instance (useful for testing)
await AgentSDK.resetShared();
```

---

## RPC SDK - Interface Proxy with Logging

The SDK includes an RPC (Remote Procedure Call) utility that allows you to create proxies of TypeScript interfaces. When methods are called on these proxies, they automatically log the method name and parameters.

### Basic Usage

```typescript
import { RpcSDK } from '@99xio/xians-sdk-typescript';

// 1. Define your interface
interface UserService {
  getUser(id: string): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<void>;
  deleteUser(id: string): Promise<boolean>;
}

// 2. Create RPC SDK instance
const rpcSDK = new RpcSDK();

// 3. Create a proxy for your interface
const userService = rpcSDK.createProxy<UserService>('UserService');

// 4. Call methods - they will be automatically logged
await userService.getUser('123');
// Logs: [RPC] Method: UserService.getUser, Args: ['123']

await userService.updateUser('123', { name: 'John' });
// Logs: [RPC] Method: UserService.updateUser, Args: ['123', { name: 'John' }]
```

### Advanced Configuration

```typescript
const rpcSDK = new RpcSDK({
  // Custom logger function
  logger: (methodName, args) => {
    console.log(`🚀 ${methodName} called with:`, args);
  },
  
  // Add namespace prefix
  namespace: 'MyApp',
  
  // Log return values too
  logReturnValues: true,
  
  // Custom method handler
  onMethodCall: (methodName, args) => {
    // You can return mock data or forward to actual implementation
    if (methodName.includes('getUser')) {
      return { id: args[0], name: 'Mock User' };
    }
  }
});
```

### Wrapping Existing Implementations

You can also wrap existing implementations to add logging:

```typescript
// Existing implementation
class ActualUserService implements UserService {
  async getUser(id: string) { /* ... */ }
  async updateUser(id: string, data: Partial<User>) { /* ... */ }
  async deleteUser(id: string) { /* ... */ }
}

// Wrap it with logging
const service = new ActualUserService();
const wrappedService = rpcSDK.wrapImplementation(service, 'UserService');

// Now all calls are logged AND executed
const user = await wrappedService.getUser('123');
```

### Use Cases

1. **Debugging**: Log all method calls during development
2. **Mocking**: Create mock services for testing
3. **Analytics**: Track which methods are called and how often
4. **RPC Bridge**: Foundation for remote procedure calls over WebSocket
5. **API Gateway**: Log and route method calls to different services

### Example: Integration with AgentSDK

```typescript
// Create an RPC interface for agent communication
interface AgentRPC {
  sendMessage(agentId: string, message: string): Promise<void>;
  requestData(agentId: string, dataType: string): Promise<any>;
}

const rpcSDK = new RpcSDK({
  onMethodCall: async (method, args) => {
    if (method.includes('sendMessage')) {
      const [agentId, message] = args;
      await sdk.sendChat(agentId, message);
    }
    // ... handle other methods
  }
});

const agentRPC = rpcSDK.createProxy<AgentRPC>('AgentRPC');
await agentRPC.sendMessage('MyAgent', 'Hello!');
```

---

## Dependencies

- `@microsoft/signalr`: For WebSocket/SignalR communication

---

## License

MIT

---

## Contributing

This package is extracted from a larger application. If you need features or find bugs, please create an issue in the repository.

---

## Building from Source

```bash
# Clone the repository
git clone <repository-url>
cd sdk-web-typescript

# Install dependencies
npm install

# Build the package
npm run build

# The built files will be in the dist/ directory
```

## Publishing

```bash
# Make sure you're logged in to npm
npm login

# Publish the package (scoped packages require --access public)
npm publish --access public
```

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history and changes. 