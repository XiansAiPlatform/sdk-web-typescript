# XiansAi TypeScript/JavaScript SDK

A comprehensive TypeScript SDK for real-time and synchronous communication with XiansAi Server, enabling AI-powered workflows and conversations in your applications.

## Features

- 🔄 **Real-time Communication**: WebSocket-based chat with automatic reconnection
- 🌐 **HTTP REST API**: Synchronous messaging and conversation management  
- 📡 **Server-Sent Events**: Live notifications and status updates
- 🔐 **Multiple Authentication**: API Key, JWT Token, or JWT Callback support
- 📝 **TypeScript Support**: Full type definitions and IntelliSense
- 🛡️ **Error Handling**: Comprehensive error handling and logging
- ⚡ **Async/Await**: Modern promise-based API

## Quick Start

### Installation

```bash
npm install @99xio/xians-sdk-typescript
# or
yarn add @99xio/xians-sdk-typescript
```

### Basic Usage

```typescript
import { SocketSDK, RestSDK, MessageType } from '@99xio/xians-sdk-typescript';

// Real-time chat with WebSocket
const socketSDK = new SocketSDK({
  tenantId: 'your-tenant-id',
  apiKey: 'your-api-key',
  serverUrl: 'https://your-server.com',
  eventHandlers: {
    onReceiveChat: (message) => console.log('Received:', message.text)
  }
});

await socketSDK.connect();
await socketSDK.subscribeToAgent('workflow-id', 'user-123');
await socketSDK.sendInboundMessage({
  participantId: 'user-123',
  workflowType: 'customer-support',
  text: 'Hello!'
}, MessageType.Chat);

// Synchronous conversation with REST
const restSDK = new RestSDK({
  tenantId: 'your-tenant-id',
  apiKey: 'your-api-key',
  serverUrl: 'https://your-server.com'
});

const result = await restSDK.converse({
  participantId: 'user-123',
  workflow: 'customer-support',
  type: 'Chat',
  text: 'What is my order status?',
  timeoutSeconds: 30
});
```

## Documentation Index

### 📚 Getting Started (Read in Order)

| Document | Description | When to Read |
|----------|-------------|--------------|
| **[Overview](./docs/overview.md)** | Architecture, concepts, and SDK comparison | Start here to understand the system |
| **[Authentication](./docs/authentication.md)** | API keys vs JWT tokens, security setup | Before implementing auth |
| **[Quick Start Examples](./docs/examples/quick-start.md)** | Practical examples for each SDK | When ready to code |

### 🔧 SDK Documentation

| SDK | Description | Best For |
|-----|-------------|----------|
| **[REST SDK](./docs/rest-sdk.md)** | HTTP-based synchronous communication | Request/response, server-to-server |
| **[Socket SDK](./docs/socket-sdk.md)** | Real-time bidirectional WebSocket | Interactive chat, live collaboration |
| **[SSE SDK](./docs/sse-sdk.md)** | Server-sent events for live updates | Notifications, status monitoring |

### 📖 Reference Documentation

| Document | Content |
|----------|---------|
| **[Types Reference](./docs/types.md)** | Complete TypeScript types and interfaces |
| **[Message Types](./docs/message-types.md)** | Chat, Data, and Handoff message structures |
| **[Authentication Examples](./docs/examples/authentication.md)** | Detailed auth implementation patterns |
| **[Advanced Examples](./docs/examples/advanced.md)** | Complex scenarios and best practices |

### 🛠️ Development & Contributing

| Document | Purpose |
|----------|---------|
| **[Contributing Guide](./docs/CONTRIBUTING.md)** | Development workflow, testing, and publishing instructions |

## Choosing the Right SDK

| Need | REST SDK | Socket SDK | SSE SDK |
|------|----------|------------|---------|
| **Fire-and-forget messages** | ✅ Best | ✅ Good | ❌ No |
| **Synchronous conversations** | ✅ Best | ✅ Good | ❌ No |
| **Real-time notifications** | ❌ No | ✅ Best | ✅ Best |
| **Bidirectional communication** | ❌ No | ✅ Best | ❌ No |
| **Live dashboards** | ❌ No | ✅ Good | ✅ Best |
| **Server-to-server** | ✅ Best | ✅ Good | ✅ Good |
| **Web applications** | ✅ Good | ✅ Best | ✅ Good |

👉 **Not sure?** Start with the [Overview](./docs/overview.md) to understand which SDK fits your use case.

## Learning Path

### For Beginners

1. Read [Overview](./docs/overview.md) to understand the architecture
2. Set up [Authentication](./docs/authentication.md)
3. Try [Quick Start Examples](./docs/examples/quick-start.md)
4. Explore individual SDK documentation as needed

### For Experienced Developers

1. Review [Overview](./docs/overview.md) for architecture understanding
2. Jump to relevant SDK documentation ([REST](./docs/rest-sdk.md), [Socket](./docs/socket-sdk.md), [SSE](./docs/sse-sdk.md))
3. Check [Advanced Examples](./docs/examples/advanced.md) for complex patterns

### For Integration Teams

1. Review [Authentication](./docs/authentication.md) for security considerations
2. Study [Message Types](./docs/message-types.md) for data structures
3. Implement using [Authentication Examples](./docs/examples/authentication.md)

## Support

- 📖 **Documentation**: Complete guides in the [docs](./docs/) folder
- 🐛 **Issues**: Report bugs and request features in our repository
- 💬 **Community**: Join our developer community for questions and discussion

## License

This SDK is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.
