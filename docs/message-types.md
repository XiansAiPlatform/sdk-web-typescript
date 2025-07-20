# Message Types

The XiansAi SDK supports three primary message types for different communication scenarios: **Chat**, **Data**, and **Handoff**. Each type is optimized for specific use cases and carries different payload structures.

## Message Type Overview

| Type | Purpose | Content | Use Cases |
|------|---------|---------|-----------|
| **Chat** | Human-readable conversations | Text messages | Customer support, Q&A, conversational AI |
| **Data** | Structured information exchange | JSON objects | API integrations, data processing, automation |
| **Handoff** | Control transfer between bot | Transfer metadata | Escalation, workflow transitions, system handovers |

## Message Structure

All messages share a common base structure:

```typescript
interface Message {
  id: string;                          // Unique message identifier
  createdAt: string;                   // ISO 8601 timestamp
  direction: 'Incoming' | 'Outgoing';  // Message direction
  messageType?: string;                // Message type (Chat, Data, Handoff)
  text?: string;                       // Text content (for Chat messages)
  data?: any;                          // Structured data (for Data/Handoff messages)
  hint?: string;                       // Optional processing hint
  requestId?: string;                  // Request correlation ID
  participantId: string;               // Participant identifier
  workflowId: string;                  // Workflow instance ID
  workflowType: string;                // Workflow type/template
  scope?: string;                      // Optional message scope
}
```

## Chat Messages

### Purpose

Chat messages handle human-readable text conversations between participants and AI agents.

### Structure

```typescript
// Sending a chat message
const chatRequest = {
  workflow: 'customer-support',
  type: 'Chat',
  participantId: 'user-123',
  text: 'Hello, I need help with my order',
  requestId: 'req-456'  // Optional correlation ID
};

// Received chat message
const chatMessage: Message = {
  id: 'msg-789',
  createdAt: '2024-01-15T10:30:00Z',
  direction: 'Outgoing',
  messageType: 'Chat',
  text: 'Hello! I\'d be happy to help you with your order. Could you please provide your order number?',
  participantId: 'user-123',
  workflowId: 'tenant:customer-support-instance-1',
  workflowType: 'customer-support'
};
```

### Use Cases

#### 1. Customer Support

```typescript
// Customer asks a question
await sdk.sendInboundMessage({
  workflow: 'customer-support',
  type: 'Chat',
  participantId: 'customer-456',
  text: 'What is your return policy?'
}, MessageType.Chat);

// Agent responds with policy information
// Received via onReceiveChat event
```

#### 2. Virtual Assistant

```typescript
// User makes a request
await sdk.send({
  workflow: 'virtual-assistant',
  type: 'Chat',
  participantId: 'user-789',
  text: 'Book a meeting for tomorrow at 2 PM'
});

// Assistant confirms the booking
// Received via onReceiveChat event
```

#### 3. Educational Chatbot

```typescript
// Student asks a question
await sdk.converse({
  workflow: 'math-tutor',
  type: 'Chat',
  participantId: 'student-123',
  text: 'How do I solve quadratic equations?'
});

// Tutor provides step-by-step explanation
// Returns array of response messages
```

## Data Messages

### Purpose

Data messages handle structured information exchange for system integrations and automated processing.

### Structure

```typescript
// Sending a data message
const dataRequest = {
  workflow: 'order-processor',
  type: 'Data',
  participantId: 'system-api',
  data: {
    orderId: 'ORD-12345',
    customerId: 'CUST-67890',
    items: [
      { sku: 'ITEM-001', quantity: 2, price: 29.99 },
      { sku: 'ITEM-002', quantity: 1, price: 49.99 }
    ],
    totalAmount: 109.97,
    currency: 'USD'
  }
};

// Received data message
const dataMessage: Message = {
  id: 'msg-data-456',
  createdAt: '2024-01-15T10:35:00Z',
  direction: 'Outgoing',
  messageType: 'Data',
  data: {
    status: 'processed',
    orderId: 'ORD-12345',
    trackingNumber: 'TRK-789456123',
    estimatedDelivery: '2024-01-18T00:00:00Z'
  },
  participantId: 'system-api',
  workflowId: 'tenant:order-processor-instance-2',
  workflowType: 'order-processor'
};
```

### Use Cases (Data)

#### 1. Document Processing

```typescript
// Submit document for analysis
await sdk.send({
  workflow: 'document-analyzer',
  type: 'Data',
  participantId: 'doc-system',
  data: {
    documentId: 'DOC-123',
    documentType: 'invoice',
    fileUrl: 'https://storage.example.com/doc-123.pdf',
    metadata: {
      uploadedBy: 'user-456',
      uploadDate: '2024-01-15T09:00:00Z'
    }
  }
});

// Receive analysis results
// Via onReceiveData event
```

#### 2. API Integration

```typescript
// Send user profile data
await sdk.converse({
  workflow: 'profile-enrichment',
  type: 'Data',
  participantId: 'crm-system',
  data: {
    userId: 'USER-789',
    email: 'user@example.com',
    firstName: 'John',
    lastName: 'Doe',
    company: 'Acme Corp'
  }
});

// Receive enriched profile data
// Returns enriched user information
```

#### 3. IoT Data Processing

```typescript
// Send sensor data
await sdk.send({
  workflow: 'sensor-monitor',
  type: 'Data',
  participantId: 'sensor-001',
  data: {
    sensorId: 'TEMP-001',
    timestamp: '2024-01-15T10:45:00Z',
    temperature: 23.5,
    humidity: 65.2,
    pressure: 1013.25,
    location: {
      building: 'Building-A',
      floor: 2,
      room: '201'
    }
  }
});
```

## Handoff Messages

### Purpose (Handoff)

Handoff messages manage control transfer between different agents, systems, or human operators.

### Structure (Handoff)

```typescript
// Sending a handoff message
const handoffRequest = {
  workflow: 'escalation-manager',
  type: 'Handoff',
  participantId: 'user-123',
  text: 'Escalating to human agent due to complex issue',
  data: {
    reason: 'complex_technical_issue',
    priority: 'high',
    context: {
      previousAgent: 'ai-support-bot',
      conversationId: 'conv-456',
      issueCategory: 'technical_support',
      customerTier: 'premium'
    },
    targetAgent: 'human-support-tier-2'
  }
};

// Received handoff message
const handoffMessage: Message = {
  id: 'msg-handoff-789',
  createdAt: '2024-01-15T10:40:00Z',
  direction: 'Outgoing',
  messageType: 'Handoff',
  text: 'Your case has been assigned to our specialist team',
  data: {
    handoffType: 'escalation',
    fromAgent: 'ai-support-bot',
    toAgent: 'human-agent-sarah',
    estimatedWaitTime: '5-10 minutes',
    caseId: 'CASE-12345'
  },
  participantId: 'user-123',
  workflowId: 'tenant:escalation-manager-instance-3',
  workflowType: 'escalation-manager'
};
```

### Use Cases (Handoff)

#### 1. Customer Support Escalation

```typescript
// AI bot escalates complex issue
await sdk.sendInboundMessage({
  workflow: 'support-escalation',
  type: 'Handoff',
  participantId: 'customer-456',
  text: 'Let me connect you with a specialist',
  data: {
    escalationReason: 'technical_complexity',
    customerContext: {
      accountType: 'enterprise',
      previousInteractions: 3,
      productVersion: '2.1.0'
    },
    requiredExpertise: ['billing', 'technical']
  }
}, MessageType.Handoff);
```

#### 2. Workflow Transition

```typescript
// Transfer between processing stages
await sdk.send({
  workflow: 'approval-workflow',
  type: 'Handoff',
  participantId: 'system-reviewer',
  data: {
    transitionType: 'stage_completion',
    fromStage: 'initial_review',
    toStage: 'manager_approval',
    requestId: 'REQ-789',
    reviewerNotes: 'Initial review complete, requires manager approval for budget over $10k'
  }
});
```

#### 3. System Integration Handoff

```typescript
// Pass control to external system
await sdk.send({
  workflow: 'payment-processor',
  type: 'Handoff',
  participantId: 'payment-gateway',
  data: {
    handoffType: 'external_system',
    targetSystem: 'stripe',
    paymentContext: {
      amount: 99.99,
      currency: 'USD',
      customerId: 'cust_123',
      paymentMethodId: 'pm_456'
    },
    callbackUrl: 'https://api.yourapp.com/webhooks/payment-complete'
  }
});
```

## Message Flow Patterns

### 1. Simple Request-Response (Chat)

```typescript
// Send question
await restSDK.converse({
  workflow: 'faq-bot',
  type: 'Chat',
  participantId: 'user-123',
  text: 'What are your business hours?'
});

// Response: Chat message with business hours
```

### 2. Data Processing Pipeline (Data)

```typescript
// Send data for processing
await socketSDK.sendInboundMessage({
  workflow: 'data-pipeline',
  type: 'Data',
  participantId: 'batch-processor',
  data: { batchId: 'B123', records: [...] }
}, MessageType.Data);

// Receive progress updates via onReceiveData
// Final result via onReceiveData
```

### 3. Escalation Flow (Handoff)

```typescript
// Start with AI agent (Chat)
await socketSDK.sendInboundMessage({
  workflow: 'customer-service',
  type: 'Chat',
  participantId: 'customer-456',
  text: 'I need help with billing'
}, MessageType.Chat);

// AI determines escalation needed (Handoff)
// Received via onReceiveHandoff

// Continue with human agent (Chat)
// New messages continue the conversation
```

## Best Practices

### 1. Choose the Right Message Type

```typescript
// ✅ Use Chat for human-readable content
await sdk.send({
  type: 'Chat',
  text: 'Hello, how can I help you?'
});

// ✅ Use Data for structured information
await sdk.send({
  type: 'Data',
  data: { orderId: '123', status: 'shipped' }
});

// ✅ Use Handoff for control transfer
await sdk.send({
  type: 'Handoff',
  text: 'Transferring to specialist',
  data: { reason: 'escalation', targetAgent: 'tier2' }
});
```

### 2. Include Context in Data Messages

```typescript
// ✅ Provide rich context
await sdk.send({
  type: 'Data',
  data: {
    operation: 'user_update',
    userId: 'USER-123',
    changes: { email: 'new@example.com' },
    metadata: {
      requestedBy: 'admin-456',
      timestamp: new Date().toISOString(),
      source: 'admin_panel'
    }
  }
});
```

### 3. Use Request IDs for Correlation

```typescript
// ✅ Include request IDs for tracking
const requestId = `req-${Date.now()}`;

await sdk.send({
  requestId,
  type: 'Data',
  data: { /* request data */ }
});

// Match responses using requestId
```

## Error Handling

### Invalid Message Type

```typescript
try {
  await sdk.send({
    type: 'InvalidType',  // ❌ Will cause error
    text: 'Hello'
  });
} catch (error) {
  console.error('Invalid message type:', error);
}
```

### Missing Required Fields

```typescript
try {
  await sdk.send({
    type: 'Chat',
    // ❌ Missing participantId - required field
    text: 'Hello'
  });
} catch (error) {
  console.error('Missing required field:', error);
}
```

## Next Steps

- [REST SDK](./rest-sdk.md) - Learn HTTP-based messaging
- [Socket SDK](./socket-sdk.md) - Real-time bidirectional communication
- [SSE SDK](./sse-sdk.md) - Server-sent events for notifications
- [Quick Start Examples](./examples/quick-start.md) - See practical examples 