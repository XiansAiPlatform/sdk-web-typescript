# Quick Start Examples

This guide provides practical examples to get you started with each SDK quickly. These examples demonstrate common use cases and basic usage patterns.

## Setup

First, install and import the SDK:

```bash
npm install xiansai-sdk
```

```typescript
import { RestSDK, SocketSDK, SseSDK, MessageType } from 'xiansai-sdk';
```

## Environment Configuration

Set up your environment variables:

```bash
# .env
XIANSAI_TENANT_ID=your-tenant-id
XIANSAI_API_KEY=sk-your-api-key
XIANSAI_SERVER_URL=https://api.yourdomain.com
```

## REST SDK Examples

### Example 1: Simple Q&A Bot
```typescript
import { RestSDK } from 'xiansai-sdk';

const restSDK = new RestSDK({
  tenantId: process.env.XIANSAI_TENANT_ID!,
  apiKey: process.env.XIANSAI_API_KEY!,
  serverUrl: process.env.XIANSAI_SERVER_URL!
});

async function askQuestion(question: string) {
  const result = await restSDK.converse({
    workflow: 'faq-bot',
    type: 'Chat',
    participantId: 'user-001',
    text: question,
    timeoutSeconds: 30
  });

  if (result.success && result.data) {
    result.data.forEach(message => {
      if (message.direction === 'Outgoing' && message.text) {
        console.log('Bot:', message.text);
      }
    });
  } else {
    console.error('Failed to get response:', result.error);
  }
}

// Usage
askQuestion('What are your business hours?');
askQuestion('How can I reset my password?');
```

### Example 2: Document Processing
```typescript
async function processDocument(documentUrl: string) {
  const result = await restSDK.converse({
    workflow: 'document-processor',
    type: 'Data',
    participantId: 'doc-processor-001',
    data: {
      documentUrl,
      operations: ['extract_text', 'summarize', 'analyze_sentiment']
    },
    timeoutSeconds: 120
  });

  if (result.success && result.data) {
    const analysisResult = result.data.find(msg => 
      msg.messageType === 'Data' && msg.data?.type === 'analysis_complete'
    );
    
    if (analysisResult) {
      console.log('Document Analysis:', analysisResult.data);
    }
  }
}

// Usage
processDocument('https://storage.example.com/contract.pdf');
```

### Example 3: Batch Data Processing
```typescript
async function processBatch(items: any[]) {
  const requests = items.map((item, index) => 
    restSDK.send({
      workflow: 'data-processor',
      type: 'Data',
      participantId: `batch-item-${index}`,
      requestId: `batch-${Date.now()}-${index}`,
      data: item
    })
  );

  const results = await Promise.allSettled(requests);
  
  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value.success) {
      console.log(`Item ${index + 1}: Processed successfully`);
    } else {
      console.error(`Item ${index + 1}: Failed to process`);
    }
  });
}

// Usage
processBatch([
  { id: 1, type: 'order', data: 'order data' },
  { id: 2, type: 'user', data: 'user data' },
  { id: 3, type: 'product', data: 'product data' }
]);
```

## Socket SDK Examples

### Example 1: Real-time Chat Application
```typescript
import { SocketSDK, MessageType } from 'xiansai-sdk';

const socketSDK = new SocketSDK({
  tenantId: process.env.XIANSAI_TENANT_ID!,
  apiKey: process.env.XIANSAI_API_KEY!,
  serverUrl: process.env.XIANSAI_SERVER_URL!,
  eventHandlers: {
    onReceiveChat: (message) => {
      console.log(`Agent: ${message.text}`);
      displayMessage('Agent', message.text!, 'incoming');
    },
    onConnected: () => {
      console.log('Connected to chat');
    },
    onDisconnected: () => {
      console.log('Disconnected from chat');
    }
  }
});

class ChatApp {
  private participantId: string;

  constructor(participantId: string) {
    this.participantId = participantId;
  }

  async start() {
    await socketSDK.connect();
    await socketSDK.subscribeToAgent('customer-support', this.participantId);
    
    // Load conversation history
    await socketSDK.getThreadHistory('customer-support', this.participantId, 0, 50);
  }

  async sendMessage(text: string) {
    await socketSDK.sendInboundMessage({
      requestId: `msg-${Date.now()}`,
      participantId: this.participantId,
      workflow: 'customer-support',
      type: 'Chat',
      text
    }, MessageType.Chat);

    displayMessage('You', text, 'outgoing');
  }

  async dispose() {
    await socketSDK.dispose();
  }
}

function displayMessage(sender: string, text: string, direction: string) {
  console.log(`${sender}: ${text}`);
  // Update your UI here
}

// Usage
const chat = new ChatApp('user-123');
await chat.start();
await chat.sendMessage('Hello, I need help with my order');
```

### Example 2: Real-time Data Dashboard
```typescript
const dashboardSDK = new SocketSDK({
  tenantId: process.env.XIANSAI_TENANT_ID!,
  apiKey: process.env.XIANSAI_API_KEY!,
  serverUrl: process.env.XIANSAI_SERVER_URL!,
  eventHandlers: {
    onReceiveData: (message) => {
      updateDashboard(message.data);
    },
    onConnected: async () => {
      // Request initial dashboard data
      await dashboardSDK.sendInboundMessage({
        requestId: 'dashboard-init',
        participantId: 'dashboard-001',
        workflow: 'analytics-engine',
        type: 'Data',
        data: { action: 'get_dashboard_data' }
      }, MessageType.Data);
    }
  }
});

function updateDashboard(data: any) {
  switch (data?.type) {
    case 'metrics':
      updateMetrics(data.metrics);
      break;
    case 'chart_data':
      updateChart(data.chartId, data.data);
      break;
    case 'alert':
      showAlert(data);
      break;
  }
}

function updateMetrics(metrics: any) {
  console.log('Metrics updated:', metrics);
  // Update your dashboard UI
}

function updateChart(chartId: string, data: any) {
  console.log(`Chart ${chartId} updated:`, data);
  // Update specific chart
}

function showAlert(alert: any) {
  console.log('Alert:', alert.message);
  // Show alert in UI
}

// Usage
await dashboardSDK.connect();
await dashboardSDK.subscribeToAgent('analytics-engine', 'dashboard-001');
```

### Example 3: Interactive Workflow
```typescript
const workflowSDK = new SocketSDK({
  tenantId: process.env.XIANSAI_TENANT_ID!,
  apiKey: process.env.XIANSAI_API_KEY!,
  serverUrl: process.env.XIANSAI_SERVER_URL!,
  eventHandlers: {
    onReceiveData: (message) => {
      handleWorkflowStep(message.data);
    },
    onReceiveHandoff: (message) => {
      handleWorkflowHandoff(message.data);
    }
  }
});

function handleWorkflowStep(data: any) {
  switch (data?.step) {
    case 'collect_user_info':
      promptForUserInfo();
      break;
    case 'confirm_details':
      showConfirmation(data.details);
      break;
    case 'process_complete':
      showSuccess(data.result);
      break;
  }
}

function handleWorkflowHandoff(data: any) {
  if (data?.handoffType === 'user_input_required') {
    showInputForm(data.inputType, data.prompt);
  }
}

async function startWorkflow(workflowType: string, initialData: any) {
  await workflowSDK.connect();
  await workflowSDK.subscribeToAgent(workflowType, 'user-123');
  
  await workflowSDK.sendInboundMessage({
    requestId: `workflow-start-${Date.now()}`,
    participantId: 'user-123',
    workflow: workflowType,
    type: 'Data',
    data: initialData
  }, MessageType.Data);
}

// Usage
startWorkflow('user-onboarding', {
  action: 'start_onboarding',
  userType: 'premium'
});
```

## SSE SDK Examples

### Example 1: Live Notifications
```typescript
import { SseSDK } from 'xiansai-sdk';

const sseSDK = new SseSDK({
  tenantId: process.env.XIANSAI_TENANT_ID!,
  apiKey: process.env.XIANSAI_API_KEY!,
  serverUrl: process.env.XIANSAI_SERVER_URL!,
  eventHandlers: {
    onReceiveData: (message) => {
      showNotification(message.data);
    },
    onReceiveChat: (message) => {
      showChatNotification(message.text!);
    },
    onHeartbeat: (data) => {
      updateConnectionStatus(data.subscriberCount, data.timestamp);
    },
    onConnected: () => {
      console.log('Connected to notification stream');
    }
  }
});

function showNotification(data: any) {
  const notification = {
    title: data.title || 'Notification',
    message: data.message || data.content,
    type: data.type || 'info',
    timestamp: new Date().toLocaleString()
  };

  console.log('Notification:', notification);
  
  // Show in UI (e.g., toast notification)
  displayToast(notification);
}

function showChatNotification(message: string) {
  console.log('Chat notification:', message);
  // Show chat notification in UI
}

function updateConnectionStatus(subscriberCount: number, timestamp: string) {
  console.log(`${subscriberCount} active subscribers at ${timestamp}`);
  // Update connection indicator
}

function displayToast(notification: any) {
  // Implementation depends on your UI framework
  console.log(`[${notification.type.toUpperCase()}] ${notification.title}: ${notification.message}`);
}

// Usage
await sseSDK.connect({
  workflow: 'notification-service',
  participantId: 'user-123',
  scope: 'alerts'
});
```

### Example 2: Status Monitor
```typescript
const statusSDK = new SseSDK({
  tenantId: process.env.XIANSAI_TENANT_ID!,
  apiKey: process.env.XIANSAI_API_KEY!,
  serverUrl: process.env.XIANSAI_SERVER_URL!,
  eventHandlers: {
    onReceiveData: (message) => {
      updateSystemStatus(message.data);
    },
    onHeartbeat: (data) => {
      updateLastSeen(data.timestamp);
    }
  }
});

function updateSystemStatus(data: any) {
  switch (data?.type) {
    case 'system_health':
      updateHealthIndicator(data.status, data.details);
      break;
    case 'performance':
      updatePerformanceMetrics(data.metrics);
      break;
    case 'alert':
      handleSystemAlert(data);
      break;
  }
}

function updateHealthIndicator(status: string, details: any) {
  console.log(`System Status: ${status}`, details);
  // Update health indicator in UI
}

function updatePerformanceMetrics(metrics: any) {
  console.log('Performance Metrics:', metrics);
  // Update performance charts
}

function handleSystemAlert(alert: any) {
  if (alert.severity === 'critical') {
    console.error('CRITICAL ALERT:', alert.message);
    // Trigger emergency procedures
  } else {
    console.warn('Alert:', alert.message);
  }
}

function updateLastSeen(timestamp: string) {
  document.getElementById('last-update')!.textContent = 
    `Last update: ${new Date(timestamp).toLocaleTimeString()}`;
}

// Usage
await statusSDK.connect({
  workflow: 'system-monitor',
  participantId: 'monitor-001',
  heartbeatSeconds: 10  // Frequent updates for monitoring
});
```

### Example 3: Live Event Feed
```typescript
const eventSDK = new SseSDK({
  tenantId: process.env.XIANSAI_TENANT_ID!,
  apiKey: process.env.XIANSAI_API_KEY!,
  serverUrl: process.env.XIANSAI_SERVER_URL!,
  eventHandlers: {
    onReceiveData: (message) => {
      addEventToFeed(message.data);
    },
    onReceiveChat: (message) => {
      addChatEventToFeed(message);
    }
  }
});

const eventFeed: any[] = [];

function addEventToFeed(data: any) {
  const event = {
    id: Date.now(),
    type: data.eventType || 'data',
    title: data.title || 'Data Event',
    description: data.description || JSON.stringify(data),
    timestamp: new Date().toISOString(),
    data: data
  };

  eventFeed.unshift(event);
  
  // Keep only last 100 events
  if (eventFeed.length > 100) {
    eventFeed.pop();
  }

  displayEvent(event);
}

function addChatEventToFeed(message: any) {
  const event = {
    id: Date.now(),
    type: 'chat',
    title: 'New Message',
    description: message.text,
    timestamp: message.createdAt,
    data: message
  };

  eventFeed.unshift(event);
  displayEvent(event);
}

function displayEvent(event: any) {
  console.log(`[${event.timestamp}] ${event.title}: ${event.description}`);
  // Add to UI event feed
}

// Usage
await eventSDK.connect({
  workflow: 'event-stream',
  participantId: 'feed-consumer',
  scope: 'public'
});
```

## Choosing the Right SDK

### Use REST SDK when:
- You need simple request/response patterns
- Building server-to-server integrations
- Processing data in batches
- Real-time updates aren't required

### Use Socket SDK when:
- Building interactive chat applications
- Need bidirectional real-time communication
- Implementing collaborative features
- Real-time gaming or trading applications

### Use SSE SDK when:
- You only need server-to-client updates
- Building live dashboards or monitoring systems
- Implementing notification systems
- Want simple, reliable one-way streaming

## Error Handling Best Practices

### REST SDK Error Handling
```typescript
try {
  const result = await restSDK.converse({ /* request */ });
  
  if (!result.success) {
    switch (result.statusCode) {
      case 401:
        console.error('Authentication failed');
        // Redirect to login
        break;
      case 404:
        console.error('Workflow not found');
        break;
      case 408:
        console.error('Request timeout');
        // Maybe retry with longer timeout
        break;
      default:
        console.error('Request failed:', result.error);
    }
  }
} catch (error) {
  console.error('Network error:', error);
}
```

### Socket SDK Error Handling
```typescript
const socketSDK = new SocketSDK({
  eventHandlers: {
    onError: (error) => {
      console.error('Socket error:', error);
      showErrorNotification('Connection issue occurred');
    },
    onConnectionError: (error) => {
      if (error.statusCode === 401) {
        redirectToLogin();
      } else {
        showRetryButton();
      }
    },
    onDisconnected: (reason) => {
      console.log('Disconnected:', reason);
      showOfflineIndicator();
    }
  }
});
```

### SSE SDK Error Handling
```typescript
const sseSDK = new SseSDK({
  eventHandlers: {
    onError: (error) => {
      console.error('SSE error:', error);
      // Try to reconnect or switch to polling
    },
    onDisconnected: (reason) => {
      console.log('SSE disconnected:', reason);
      // Show connection status
    }
  }
});
```

## Next Steps

- [Authentication Examples](./authentication.md) - Learn about API key and JWT setup
- [Advanced Examples](./advanced.md) - Complex scenarios and best practices
- [Authentication Guide](../authentication.md) - Detailed authentication setup
- [Message Types](../message-types.md) - Understanding different message structures 