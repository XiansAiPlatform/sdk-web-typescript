# REST SDK

The REST SDK provides HTTP-based communication with XiansAi backend agents. It's ideal for server-to-server communication, batch processing, and synchronous workflows where real-time bidirectional communication isn't required.

## Overview

The REST SDK offers three main operations:

- **Send**: Fire-and-forget message delivery
- **Converse**: Synchronous request-response conversations  
- **History**: Retrieve conversation history

## Installation

```typescript
import { RestSDK } from '@99xio/xians-sdk-typescript';
```

## Configuration

### Basic Setup

```typescript
const restSDK = new RestSDK({
  tenantId: 'your-tenant-id',
  apiKey: 'sk-your-api-key',
  serverUrl: 'https://api.yourdomain.com'
});
```

### Configuration Options

```typescript
interface RestSDKOptions {
  tenantId: string;                    // Required: Tenant identifier
  apiKey?: string;                     // API key authentication
  jwtToken?: string;                   // JWT token authentication
  getJwtToken?: () => Promise<string>; // JWT token callback
  serverUrl: string;                   // Required: Server URL
  requestTimeout?: number;             // HTTP timeout (default: 30000ms)
  defaultConverseTimeout?: number;     // Default converse timeout (default: 60s)
  maxConverseTimeout?: number;         // Max converse timeout (default: 300s)
  logger?: LoggerFunction;             // Custom logger
}
```

## Authentication

### API Key Authentication (Recommended for Server-to-Server)

```typescript
const restSDK = new RestSDK({
  tenantId: 'your-tenant-id',
  apiKey: 'sk-your-api-key',
  serverUrl: 'https://api.yourdomain.com'
});
```

### JWT Token Authentication

```typescript
// Static token
const restSDK = new RestSDK({
  tenantId: 'your-tenant-id',
  jwtToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  serverUrl: 'https://api.yourdomain.com'
});

// Dynamic token (recommended)
const restSDK = new RestSDK({
  tenantId: 'your-tenant-id',
  getJwtToken: async () => {
    const response = await fetch('/api/auth/token');
    const { accessToken } = await response.json();
    return accessToken;
  },
  serverUrl: 'https://api.yourdomain.com'
});
```

## Core Operations

### 1. Send Operation

Fire-and-forget message delivery. Use when you don't need to wait for a response.

#### Method Signature

```typescript
async send(request: RestMessageRequest): Promise<RestResponse<any>>
```

#### Request Structure

```typescript
interface RestMessageRequest {
  workflow: string;        // Required: Workflow identifier
  type: string;           // Required: Message type (Chat, Data, Handoff)
  participantId: string;  // Required: Participant identifier
  requestId?: string;     // Optional: Request correlation ID
  text?: string;          // Optional: Text content (for Chat messages)
  data?: any;             // Optional: Structured data
  hint?: string;          // Optional: Processing hint
  scope?: string;         // Optional: Message scope
  timeoutSeconds?: number; // Optional: Operation timeout
}
```

#### Examples

##### Send Chat Message

```typescript
const result = await restSDK.send({
  workflow: 'customer-support',
  type: 'Chat',
  participantId: 'user-123',
  text: 'Hello, I need help with my order',
  requestId: 'req-456'
});

if (result.success) {
  console.log('Message sent successfully');
} else {
  console.error('Failed to send message:', result.error);
}
```

##### Send Data Message

```typescript
const result = await restSDK.send({
  workflow: 'order-processor',
  type: 'Data',
  participantId: 'system-api',
  data: {
    orderId: 'ORD-12345',
    action: 'process_payment',
    amount: 99.99,
    currency: 'USD'
  }
});
```

##### Send Handoff Message

```typescript
const result = await restSDK.send({
  workflow: 'escalation-manager',
  type: 'Handoff',
  participantId: 'customer-456',
  text: 'Escalating to human agent',
  data: {
    reason: 'complex_issue',
    priority: 'high',
    targetAgent: 'tier2-support'
  }
});
```

### 2. Converse Operation

Synchronous request-response conversations. Use when you need to wait for agent responses.

#### Method Signature (Converse)

```typescript
async converse(request: RestMessageRequest): Promise<RestResponse<Message[]>>
```

#### Examples (Converse)

##### Synchronous Chat Conversation

```typescript
const result = await restSDK.converse({
  workflow: 'faq-bot',
  type: 'Chat',
  participantId: 'user-789',
  text: 'What are your business hours?',
  timeoutSeconds: 30
});

if (result.success && result.data) {
  result.data.forEach(message => {
    console.log(`${message.direction}: ${message.text}`);
  });
} else {
  console.error('Conversation failed:', result.error);
}
```

##### Data Processing with Response

```typescript
const result = await restSDK.converse({
  workflow: 'document-analyzer',
  type: 'Data',
  participantId: 'doc-system',
  data: {
    documentId: 'DOC-123',
    content: 'Document content here...',
    analysisType: 'sentiment'
  },
  timeoutSeconds: 60
});

if (result.success && result.data) {
  const analysisResult = result.data.find(msg => 
    msg.messageType === 'Data' && msg.direction === 'Outgoing'
  );
  console.log('Analysis result:', analysisResult?.data);
}
```

##### Complex Workflow Interaction

```typescript
const result = await restSDK.converse({
  workflow: 'approval-workflow',
  type: 'Data',
  participantId: 'manager-001',
  data: {
    requestType: 'budget_approval',
    amount: 50000,
    department: 'engineering',
    justification: 'New server infrastructure'
  },
  timeoutSeconds: 120
});

if (result.success && result.data) {
  const approvalDecision = result.data.find(msg => 
    msg.data?.decision
  );
  
  if (approvalDecision?.data?.decision === 'approved') {
    console.log('Request approved!');
  } else {
    console.log('Request denied:', approvalDecision?.data?.reason);
  }
}
```

### 3. History Operation

Retrieve conversation history for a workflow and participant.

#### Method Signature (History)

```typescript
async getHistory(request: HistoryRequest): Promise<RestResponse<Message[]>>
```

#### Request Structure (History)

```typescript
interface HistoryRequest {
  workflow: string;      // Required: Workflow identifier
  participantId: string; // Required: Participant identifier
  page?: number;         // Optional: Page number (default: 1)
  pageSize?: number;     // Optional: Page size (default: 50)
  scope?: string;        // Optional: Message scope filter
}
```

#### Examples (History)

##### Basic History Retrieval

```typescript
const result = await restSDK.getHistory({
  workflow: 'customer-support',
  participantId: 'user-123'
});

if (result.success && result.data) {
  console.log(`Retrieved ${result.data.length} messages`);
  result.data.forEach(message => {
    console.log(`[${message.createdAt}] ${message.direction}: ${message.text}`);
  });
}
```

##### Paginated History

```typescript
// Get first page
let page = 1;
const pageSize = 20;

do {
  const result = await restSDK.getHistory({
    workflow: 'customer-support',
    participantId: 'user-123',
    page,
    pageSize
  });

  if (result.success && result.data) {
    console.log(`Page ${page}: ${result.data.length} messages`);
    
    // Process messages
    result.data.forEach(message => {
      console.log(`${message.id}: ${message.text}`);
    });
    
    // Continue if we got a full page
    if (result.data.length === pageSize) {
      page++;
    } else {
      break;
    }
  } else {
    break;
  }
} while (true);
```

##### Scoped History

```typescript
const result = await restSDK.getHistory({
  workflow: 'multi-department-support',
  participantId: 'user-456',
  scope: 'billing',  // Only billing-related messages
  pageSize: 100
});
```

## Response Handling

### Response Structure

```typescript
interface RestResponse<T> {
  success: boolean;    // Operation success status
  data?: T;           // Response data (if successful)
  error?: string;     // Error message (if failed)
  statusCode?: number; // HTTP status code
}
```

### Success Response

```typescript
const result = await restSDK.send({ /* request */ });

if (result.success) {
  console.log('Operation successful');
  console.log('Status:', result.statusCode); // 200, 201, etc.
  console.log('Data:', result.data);
} else {
  console.error('Operation failed');
  console.error('Error:', result.error);
  console.error('Status:', result.statusCode); // 400, 401, 500, etc.
}
```

### Error Handling

```typescript
try {
  const result = await restSDK.converse({
    workflow: 'test-workflow',
    type: 'Chat',
    participantId: 'user-123',
    text: 'Hello',
    timeoutSeconds: 30
  });

  if (!result.success) {
    switch (result.statusCode) {
      case 400:
        console.error('Bad request:', result.error);
        break;
      case 401:
        console.error('Authentication failed:', result.error);
        break;
      case 404:
        console.error('Workflow not found:', result.error);
        break;
      case 408:
        console.error('Request timeout:', result.error);
        break;
      case 500:
        console.error('Server error:', result.error);
        break;
      default:
        console.error('Unknown error:', result.error);
    }
  }
} catch (error) {
  console.error('Network or SDK error:', error);
}
```

## Advanced Usage

### Timeout Configuration

```typescript
// Global timeout settings
const restSDK = new RestSDK({
  tenantId: 'your-tenant-id',
  apiKey: 'sk-your-api-key',
  serverUrl: 'https://api.yourdomain.com',
  requestTimeout: 45000,        // 45 second HTTP timeout
  defaultConverseTimeout: 90,   // 90 second default converse timeout
  maxConverseTimeout: 600       // 10 minute max converse timeout
});

// Per-request timeout
const result = await restSDK.converse({
  workflow: 'long-running-analysis',
  type: 'Data',
  participantId: 'analyzer',
  data: { /* large dataset */ },
  timeoutSeconds: 300  // 5 minute timeout for this specific request
});
```

### Request Correlation

```typescript
// Generate unique request ID
const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const result = await restSDK.send({
  workflow: 'audit-system',
  type: 'Data',
  participantId: 'audit-logger',
  requestId,
  data: { action: 'user_login', userId: 'user-123' }
});

console.log(`Request ${requestId} completed with status: ${result.success}`);
```

### Batch Operations

```typescript
// Process multiple requests in parallel
const requests = [
  { workflow: 'processor-1', type: 'Data', participantId: 'batch-1', data: { id: 1 } },
  { workflow: 'processor-2', type: 'Data', participantId: 'batch-2', data: { id: 2 } },
  { workflow: 'processor-3', type: 'Data', participantId: 'batch-3', data: { id: 3 } }
];

const results = await Promise.allSettled(
  requests.map(request => restSDK.send(request))
);

results.forEach((result, index) => {
  if (result.status === 'fulfilled' && result.value.success) {
    console.log(`Request ${index + 1} succeeded`);
  } else {
    console.error(`Request ${index + 1} failed:`, 
      result.status === 'fulfilled' ? result.value.error : result.reason
    );
  }
});
```

## SDK Management

### Authentication Updates

```typescript
// Update API key
restSDK.updateApiKey('sk-new-api-key');

// Update JWT token
restSDK.updateJwtToken('new-jwt-token');

// Update JWT callback
restSDK.updateJwtTokenCallback(async () => {
  const response = await fetch('/api/auth/refresh');
  const { token } = await response.json();
  return token;
});
```

### SDK Information

```typescript
console.log('Tenant ID:', restSDK.getTenantId());
console.log('Auth Type:', restSDK.getAuthType()); // 'apiKey', 'jwtToken', or 'jwtCallback'
```

### Resource Cleanup

```typescript
// Dispose of SDK resources
restSDK.dispose();
```

## Best Practices

### 1. Choose the Right Operation

```typescript
// ✅ Use send() for fire-and-forget
await restSDK.send({
  workflow: 'notification-system',
  type: 'Data',
  participantId: 'email-service',
  data: { to: 'user@example.com', template: 'welcome' }
});

// ✅ Use converse() when you need a response
const result = await restSDK.converse({
  workflow: 'calculator',
  type: 'Data',
  participantId: 'math-service',
  data: { operation: 'add', numbers: [1, 2, 3] }
});

// ✅ Use getHistory() for retrieving past conversations
const history = await restSDK.getHistory({
  workflow: 'customer-support',
  participantId: 'user-123'
});
```

### 2. Error Handling

```typescript
// ✅ Always check for success
const result = await restSDK.send({ /* request */ });
if (!result.success) {
  console.error('Request failed:', result.error);
  return;
}

// ✅ Handle specific error codes
if (result.statusCode === 401) {
  // Refresh authentication
  await refreshAuthToken();
  // Retry request
}
```

### 3. Timeout Management

```typescript
// ✅ Set appropriate timeouts based on workflow complexity
const quickResult = await restSDK.converse({
  workflow: 'simple-qa',
  type: 'Chat',
  participantId: 'user',
  text: 'What time is it?',
  timeoutSeconds: 10  // Quick response expected
});

const complexResult = await restSDK.converse({
  workflow: 'data-analysis',
  type: 'Data',
  participantId: 'analyst',
  data: { dataset: 'large-dataset.csv' },
  timeoutSeconds: 300  // Complex processing may take longer
});
```

### 4. Request Correlation

```typescript
// ✅ Use request IDs for tracking
const requestId = generateRequestId();

await restSDK.send({
  requestId,
  workflow: 'order-system',
  type: 'Data',
  participantId: 'processor',
  data: { orderId: 'ORD-123' }
});

// Log for tracking
console.log(`Submitted order processing request: ${requestId}`);
```

## Common Use Cases

### 1. API Integration

```typescript
// Integrate with external API via workflow
const apiResult = await restSDK.converse({
  workflow: 'external-api-proxy',
  type: 'Data',
  participantId: 'api-client',
  data: {
    endpoint: '/users/123',
    method: 'GET',
    headers: { 'Authorization': 'Bearer token' }
  }
});

if (apiResult.success && apiResult.data) {
  const userInfo = apiResult.data[0]?.data;
  console.log('User info:', userInfo);
}
```

### 2. Document Processing

```typescript
// Submit document for processing
const processingResult = await restSDK.converse({
  workflow: 'document-processor',
  type: 'Data',
  participantId: 'doc-service',
  data: {
    documentUrl: 'https://storage.example.com/doc.pdf',
    operations: ['extract_text', 'analyze_sentiment', 'summarize']
  },
  timeoutSeconds: 120
});
```

### 3. Workflow Orchestration

```typescript
// Start multi-step workflow
const orchestrationResult = await restSDK.send({
  workflow: 'onboarding-orchestrator',
  type: 'Data',
  participantId: 'new-user-123',
  data: {
    userId: 'user-123',
    steps: ['create_account', 'send_welcome_email', 'setup_profile']
  }
});

// Check progress periodically
const progress = await restSDK.getHistory({
  workflow: 'onboarding-orchestrator',
  participantId: 'new-user-123'
});
```

## Next Steps

- [Socket SDK](./socket-sdk.md) - Real-time bidirectional communication
- [SSE SDK](./sse-sdk.md) - Server-sent events for notifications  
- [Quick Start Examples](./examples/quick-start.md) - Practical examples
- [Authentication](./authentication.md) - Setup guide 