# Agent SDK TypeScript

A **light-weight, framework-agnostic** wrapper that hides all WebSocket/SignalR complexity behind a handful of ergonomic methods.

## Installation

Install the package using npm:

```bash
npm install sdk-typescript
```

Or using yarn:

```bash
yarn add sdk-typescript
```

## Import

```ts
import AgentSDK from 'sdk-typescript';
//   or
import { AgentSDK } from 'sdk-typescript';

// Import types
import { type ChatMessageData, type HandoffMessage } from 'sdk-typescript';
```

## Quick Start

```ts
import AgentSDK from 'sdk-typescript';

// 1️⃣  Configure once (typically on app start-up)
const sdk = new AgentSDK({
  // ---- mandatory settings ----
  agentWebsocketUrl: '<YOUR_BOT_BACKEND_WEBSOCKET_URL>',
  Authorization:      'Bearer <YOUR_API_KEY>',
  tenantId:           '<TENANT_ID>',
  participantId:      '<PARTICIPANT_ID>',
  
  // ---- optional ----
  getDefaultData: () => {
    // Return contextual data that changes with application state
    const context = { currentStep: getCurrentStep(), userId: getUserId() };
    return JSON.stringify(context);
  }
});

// 2️⃣  Establish all agent connections
await sdk.connect([
  {
    id: 'my_agent',
    workflowType: 'MyAgentType',  // required - server-side workflow identifier
    // workflowId and agent are optional - only include if needed by your server
    workflowId: 'agent_workflow_123', // optional
    agent: 'MyAgentName'              // optional
  }
]);

// 3️⃣  Subscribe to specific message types (recommended)
const stopChatMessages = sdk.subscribeToChatMessages((chat) => {
  console.log('💬 Chat message:', chat.text);
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
Same shape as `SettingsData`:

```ts
interface Settings {
  agentWebsocketUrl: string;
  Authorization: string;      // bearer token or similar  
  tenantId: string;
  participantId: string;
  getDefaultData?: () => string | undefined; // optional function to get contextual data for each chat
}
```

---

### `.connect()` → `Promise<void>`
Initialises the underlying `WebSocketHub` and opens SignalR connections for **all** configured agents.

### `.disconnect()` → `Promise<void>`
Stops **all** active connections.

### `.sendChat(workflowType, text, data?, overrideDefaultData?)` → `Promise<void>`
Sends a plain-text chat message to the specified workflow.

- `workflowType`: The workflow type of the target agent
- `text`: The message text to send
- `data`: Optional additional data to include with the message (default: `{}`)
- `overrideDefaultData`: Optional JSON string to override the default data for this specific message

The method automatically includes default data from the `getDefaultData()` function (if configured) unless explicitly overridden.

```typescript
// Basic usage
await sdk.sendChat('DocumentDataFlow', 'Hello there!');

// With additional data
await sdk.sendChat('DocumentDataFlow', 'Process this', { documentId: '123' });

// Override default data for this message
await sdk.sendChat('DocumentDataFlow', 'Special request', {}, '{"priority": "high"}');
```

### `.sendData(workflowType, data)` → `Promise<void>`
Sends a structured JSON payload as a `Data` message.

---

## Dynamic Default Data

The SDK supports dynamic default data that gets automatically included with every chat message. This is useful for sending contextual information that changes based on the current application state.

### Configuration

Set up the `getDefaultData` function when creating the SDK instance:

```typescript
import AgentSDK from 'sdk-typescript';

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
- **Per-message override**: Use the `overrideDefaultData` parameter to override for specific messages
- **Dynamic computation**: The function is called fresh for each message, ensuring up-to-date context

```typescript
// Uses dynamic default data
await sdk.sendChat('workflow_id', 'Hello');

// Overrides default data for this message only
await sdk.sendChat('workflow_id', 'Special request', {}, '{"priority": "urgent"}');

// Uses empty default data for this message
await sdk.sendChat('workflow_id', 'No context needed', {}, '');
```

---

## Message Subscriptions

The SDK provides **specialized subscription methods** for different message types, offering clean separation of concerns and type safety.

### `.subscribeToChatMessages(callback)` → `() => void`
Subscribe specifically to chat messages (regular conversation messages).

```typescript
import { type ChatMessageData } from 'sdk-typescript';

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
  workflowId: string;
  text: string;
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
import { type HandoffMessage } from 'sdk-typescript';

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
  workflowId: string;
  text: string;
  direction: 'Incoming' | 'Outgoing';
  timestamp: Date;
  threadId: string;
  data?: any;
  isHistorical: boolean;
}
```

---

## TypeScript Support

This package is written in TypeScript and provides full type definitions. All interfaces and types are exported:

```typescript
import { 
  AgentSDK, 
  type AgentSDKOptions,
  type ChatMessageData,
  type HandoffMessage 
} from 'sdk-typescript';
```

---

## React Integration

The SDK works seamlessly with React. Here are some example hooks:

```typescript
import { useEffect, useState } from 'react';
import { type ChatMessageData } from 'sdk-typescript';

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
cd sdk-typescript

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

# Publish the package
npm publish
```

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history and changes. 