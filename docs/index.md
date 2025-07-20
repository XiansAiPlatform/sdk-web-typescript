# XiansAi SDK Documentation

Welcome to the XiansAi SDK documentation. This TypeScript SDK provides multiple communication methods to interact with XiansAi backend agents.

## Table of Contents

### Getting Started
- [Overview](./overview.md) - SDK purpose, architecture, and communication patterns
- [Authentication](./authentication.md) - API keys vs JWT tokens, security considerations
- [Message Types](./message-types.md) - Chat, Data, and Handoff message structures

### SDK Documentation
- [REST SDK](./rest-sdk.md) - HTTP-based communication for send & converse operations
- [Socket SDK](./socket-sdk.md) - Real-time bidirectional communication using SignalR
- [SSE SDK](./sse-sdk.md) - Server-sent events for real-time notifications

### Examples
- [Quick Start Examples](./examples/quick-start.md) - Basic usage of each SDK
- [Authentication Examples](./examples/authentication.md) - API key and JWT setup
- [Advanced Examples](./examples/advanced.md) - Complex scenarios and best practices

## Quick Reference

### When to Use Each SDK

| SDK | Use Case | Communication Pattern |
|-----|----------|----------------------|
| **REST SDK** | Fire-and-forget messages, synchronous conversations | Request/Response |
| **Socket SDK** | Real-time chat, interactive workflows | Bidirectional |
| **SSE SDK** | Live notifications, status updates | Server → Client |

### Authentication Quick Start

```typescript
// API Key (Server-to-Server)
const sdk = new RestSDK({
  tenantId: 'your-tenant-id',
  apiKey: 'sk-your-api-key',
  serverUrl: 'https://your-server.com'
});

// JWT Token (Web Client)
const sdk = new SocketSDK({
  tenantId: 'your-tenant-id',
  getJwtToken: async () => await getTokenFromAuth(),
  serverUrl: 'https://your-server.com'
});
```

### Message Types

- **Chat**: Text-based conversations with agents
- **Data**: Structured data exchange
- **Handoff**: Transfer control between agents or systems

## Support

For issues, questions, or contributions, please refer to the main project repository. 