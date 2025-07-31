# Socket SDK

The Socket SDK provides real-time bidirectional communication with XiansAi backend agents using SignalR WebSockets. It's ideal for interactive applications, real-time chat, and scenarios requiring immediate response to agent actions.

## Overview

The Socket SDK offers:

- **Real-time messaging**: Instant bidirectional communication
- **Event-driven architecture**: React to agent responses immediately  
- **Connection management**: Automatic reconnection and state tracking
- **Group subscriptions**: Subscribe to specific workflow notifications
- **Thread management**: Retrieve conversation history

## Installation

```typescript
import { SocketSDK } from '@99xio/xians-sdk-typescript';
```

## Configuration

### Basic Setup

```typescript
const socketSDK = new SocketSDK({
  tenantId: 'your-tenant-id',
  apiKey: 'sk-your-api-key',
  serverUrl: 'https://api.yourdomain.com'
});
```

### Configuration Options

```typescript
interface SocketSDKOptions {
  tenantId: string;                    // Required: Tenant identifier
  apiKey?: string;                     // API key authentication
  jwtToken?: string;                   // JWT token authentication
  getJwtToken?: () => Promise<string>; // JWT token callback
  serverUrl: string;                   // Required: Server URL
  autoReconnect?: boolean;             // Auto-reconnect (default: true)
  reconnectDelay?: number;             // Reconnect delay (default: 5000ms)
  maxReconnectAttempts?: number;       // Max reconnect attempts (default: 5)
  connectionTimeout?: number;          // Connection timeout (default: 30000ms)
  eventHandlers?: EventHandlers;       // Event handlers
  logger?: LoggerFunction;             // Custom logger
}
```

## Authentication

### API Key Authentication (Recommended for WebSockets)

```typescript
const socketSDK = new SocketSDK({
  tenantId: 'your-tenant-id',
  apiKey: 'sk-your-api-key',
  serverUrl: 'https://api.yourdomain.com'
});
```

### JWT Token Authentication

```typescript
// Static token
const socketSDK = new SocketSDK({
  tenantId: 'your-tenant-id',
  jwtToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  serverUrl: 'https://api.yourdomain.com'
});

// Dynamic token (recommended for web applications)
const socketSDK = new SocketSDK({
  tenantId: 'your-tenant-id',
  getJwtToken: async () => {
    const response = await fetch('/api/auth/token');
    const { accessToken } = await response.json();
    return accessToken;
  },
  serverUrl: 'https://api.yourdomain.com'
});
```

## Event Handlers

### Event Handler Interface

```typescript
interface EventHandlers {
  onReceiveChat?: (message: Message) => void;
  onReceiveData?: (message: Message) => void;
  onReceiveHandoff?: (message: Message) => void;
  onThreadHistory?: (history: Message[]) => void;
  onInboundProcessed?: (threadId: string) => void;
  onConnected?: () => void;
  onDisconnected?: (reason?: string) => void;
  onReconnecting?: (reason?: string) => void;
  onReconnected?: (connectionId?: string) => void;
  onConnectionError?: (error: { statusCode: number; message: string }) => void;
  onConnectionStateChanged?: (oldState: ConnectionState, newState: ConnectionState) => void;
  onError?: (error: string) => void;
}
```

### Setting Up Event Handlers

```typescript
const socketSDK = new SocketSDK({
  tenantId: 'your-tenant-id',
  apiKey: 'sk-your-api-key',
  serverUrl: 'https://api.yourdomain.com',
  eventHandlers: {
    onReceiveChat: (message) => {
      console.log('Chat received:', message.text);
      updateChatUI(message);
    },
    onReceiveData: (message) => {
      console.log('Data received:', message.data);
      processDataMessage(message);
    },
    onReceiveHandoff: (message) => {
      console.log('Handoff received:', message.data);
      handleHandoff(message);
    },
    onThreadHistory: (history) => {
      console.log(`Received ${history.length} historical messages`);
      displayHistory(history);
    },
    onConnected: () => {
      console.log('Connected to agent hub');
    },
    onDisconnected: (reason) => {
      console.log('Disconnected:', reason);
    },
    onError: (error) => {
      console.error('Socket error:', error);
    }
  }
});
```

## Connection Management

### Connecting

```typescript
// Connect to the WebSocket hub
await socketSDK.connect();

// Check connection state
console.log('Is connected:', socketSDK.isConnected());
console.log('Connection state:', socketSDK.getConnectionState());
```

### Connection States

```typescript
enum ConnectionState {
  Disconnected = 'Disconnected',
  Connecting = 'Connecting',
  Connected = 'Connected', 
  Disconnecting = 'Disconnecting',
  Reconnecting = 'Reconnecting',
  Failed = 'Failed'
}
```

### Disconnecting

```typescript
// Gracefully disconnect
await socketSDK.disconnect();
```

### Connection Monitoring

```typescript
const socketSDK = new SocketSDK({
  tenantId: 'your-tenant-id',
  apiKey: 'sk-your-api-key',
  serverUrl: 'https://api.yourdomain.com',
  eventHandlers: {
    onConnectionStateChanged: (oldState, newState) => {
      console.log(`Connection state: ${oldState} → ${newState}`);
      
      switch (newState) {
        case ConnectionState.Connected:
          // Enable UI interactions
          enableChatInterface();
          break;
        case ConnectionState.Disconnected:
        case ConnectionState.Failed:
          // Disable UI interactions
          disableChatInterface();
          break;
        case ConnectionState.Reconnecting:
          // Show reconnection status
          showReconnectingStatus();
          break;
      }
    },
    onReconnected: (connectionId) => {
      console.log('Reconnected with ID:', connectionId);
      // Re-subscribe to agents if needed
      resubscribeToAgents();
    }
  }
});
```

## Core Operations

### 1. Sending Messages

#### Send Inbound Message

```typescript
// Send a chat message
await socketSDK.sendInboundMessage({
  requestId: 'req-123',
  participantId: 'user-456',
  workflow: 'customer-support',
  type: 'Chat',
  text: 'Hello, I need help with my order'
}, MessageType.Chat);

// Send data message
await socketSDK.sendInboundMessage({
  requestId: 'req-124',
  participantId: 'system-api',
  workflow: 'order-processor',
  type: 'Data',
  data: {
    orderId: 'ORD-12345',
    action: 'check_status'
  }
}, MessageType.Data);

// Send handoff message
await socketSDK.sendInboundMessage({
  requestId: 'req-125',
  participantId: 'customer-789',
  workflow: 'escalation-manager',
  type: 'Handoff',
  text: 'Escalating to human agent',
  data: {
    reason: 'complex_issue',
    priority: 'high'
  }
}, MessageType.Handoff);
```

### 2. Agent Subscription

#### Subscribe to Agent Notifications

```typescript
// Subscribe to receive messages from a specific workflow
await socketSDK.subscribeToAgent('customer-support', 'user-123');

// The SDK will now receive real-time messages via event handlers
```

#### Unsubscribe from Agent

```typescript
// Stop receiving messages from the workflow
await socketSDK.unsubscribeFromAgent('customer-support', 'user-123');
```

### 3. Thread History

#### Get Thread History

```typescript
// Get conversation history
await socketSDK.getThreadHistory(
  'customer-support',  // workflow
  'user-123',         // participantId
  0,                  // page (0-based)
  50                  // pageSize
);

// History will be delivered via onThreadHistory event handler
```

#### Get Scoped Thread History

```typescript
// Get history for a specific scope
await socketSDK.getThreadHistory(
  'multi-department-support',  // workflow
  'user-456',                 // participantId
  0,                          // page
  50,                         // pageSize
  'billing'                   // scope filter
);
```

## Real-time Event Handling

### Chat Message Events

```typescript
const socketSDK = new SocketSDK({
  eventHandlers: {
    onReceiveChat: (message) => {
      // Handle incoming chat messages from agents
      const chatBubble = createChatBubble({
        text: message.text,
        direction: message.direction,
        timestamp: message.createdAt,
        sender: message.direction === 'Outgoing' ? 'Agent' : 'User'
      });
      
      appendToChatUI(chatBubble);
      
      // Auto-scroll to latest message
      scrollToBottom();
      
      // Play notification sound if needed
      if (message.direction === 'Outgoing') {
        playNotificationSound();
      }
    }
  }
});
```

### Data Message Events

```typescript
const socketSDK = new SocketSDK({
  eventHandlers: {
    onReceiveData: (message) => {
      // Handle structured data from agents
      switch (message.data?.type) {
        case 'order_status':
          updateOrderStatus(message.data);
          break;
        case 'user_profile':
          updateUserProfile(message.data);
          break;
        case 'analytics_data':
          updateAnalyticsDashboard(message.data);
          break;
        default:
          console.log('Unknown data type:', message.data);
      }
    }
  }
});
```

### Handoff Events

```typescript
const socketSDK = new SocketSDK({
  eventHandlers: {
    onReceiveHandoff: (message) => {
      // Handle agent handoffs
      const handoffData = message.data;
      
      if (handoffData?.handoffType === 'escalation') {
        showEscalationNotification({
          fromAgent: handoffData.fromAgent,
          toAgent: handoffData.toAgent,
          estimatedWaitTime: handoffData.estimatedWaitTime,
          message: message.text
        });
      } else if (handoffData?.handoffType === 'completion') {
        showCompletionMessage(message.text);
      }
    }
  }
});
```

### Process Events

```typescript
const socketSDK = new SocketSDK({
  eventHandlers: {
    onInboundProcessed: (threadId) => {
      // Called when the agent has processed an inbound message
      console.log(`Message processed for thread: ${threadId}`);
      
      // Update UI to show message was received
      markMessageAsProcessed(threadId);
      
      // Hide typing indicator
      hideTypingIndicator();
    }
  }
});
```

## Advanced Usage

### Dynamic Event Handler Updates

```typescript
// Update event handlers at runtime
socketSDK.updateEventHandlers({
  onReceiveChat: (message) => {
    // New chat handler logic
    handleChatWithNewFeatures(message);
  },
  onReceiveData: (message) => {
    // Updated data handler
    handleDataWithEnhancedProcessing(message);
  }
});
```

### Error Handling and Recovery

```typescript
const socketSDK = new SocketSDK({
  tenantId: 'your-tenant-id',
  apiKey: 'sk-your-api-key',
  serverUrl: 'https://api.yourdomain.com',
  maxReconnectAttempts: 10,
  reconnectDelay: 3000,
  eventHandlers: {
    onConnectionError: (error) => {
      console.error('Connection error:', error);
      
      if (error.statusCode === 401) {
        // Authentication failed
        showAuthenticationError();
        redirectToLogin();
      } else if (error.statusCode === 503) {
        // Service unavailable
        showServiceUnavailableMessage();
      }
    },
    onError: (error) => {
      console.error('General error:', error);
      showErrorNotification(error);
    },
    onReconnecting: (reason) => {
      console.log('Attempting to reconnect:', reason);
      showReconnectingIndicator();
    },
    onReconnected: (connectionId) => {
      console.log('Successfully reconnected:', connectionId);
      hideReconnectingIndicator();
      
      // Re-establish subscriptions
      resubscribeToActiveWorkflows();
    }
  }
});
```

### Connection Quality Monitoring

```typescript
let lastHeartbeat = Date.now();
let connectionQuality = 'good';

const socketSDK = new SocketSDK({
  eventHandlers: {
    onConnected: () => {
      lastHeartbeat = Date.now();
      connectionQuality = 'good';
      updateConnectionStatus('connected');
    },
    onReceiveChat: (message) => {
      // Update heartbeat on any message
      lastHeartbeat = Date.now();
      connectionQuality = 'good';
      handleChatMessage(message);
    },
    onDisconnected: (reason) => {
      connectionQuality = 'poor';
      updateConnectionStatus('disconnected', reason);
    }
  }
});

// Monitor connection quality
setInterval(() => {
  const timeSinceLastHeartbeat = Date.now() - lastHeartbeat;
  
  if (timeSinceLastHeartbeat > 30000) { // 30 seconds
    connectionQuality = 'poor';
  } else if (timeSinceLastHeartbeat > 10000) { // 10 seconds
    connectionQuality = 'fair';
  } else {
    connectionQuality = 'good';
  }
  
  updateConnectionQualityIndicator(connectionQuality);
}, 5000);
```

## SDK Management

### Authentication Updates

```typescript
// Update API key (automatically reconnects if connected)
socketSDK.updateApiKey('sk-new-api-key');

// Update JWT token
socketSDK.updateJwtToken('new-jwt-token');

// Update JWT callback
socketSDK.updateJwtTokenCallback(async () => {
  const response = await fetch('/api/auth/refresh');
  const { token } = await response.json();
  return token;
});
```

### SDK Information

```typescript
console.log('Tenant ID:', socketSDK.getTenantId());
console.log('Auth Type:', socketSDK.getAuthType());
console.log('Is Connected:', socketSDK.isConnected());
console.log('Connection State:', socketSDK.getConnectionState());
```

### Resource Cleanup

```typescript
// Dispose of SDK resources
await socketSDK.dispose();
```

## Common Use Cases

### 1. Interactive Chat Application

```typescript
class ChatApplication {
  private socketSDK: SocketSDK;
  private currentWorkflow: string = 'customer-support';
  private currentParticipant: string;

  constructor(participantId: string) {
    this.currentParticipant = participantId;
    
    this.socketSDK = new SocketSDK({
      tenantId: 'your-tenant-id',
      apiKey: 'sk-your-api-key',
      serverUrl: 'https://api.yourdomain.com',
      eventHandlers: {
        onReceiveChat: this.handleAgentMessage.bind(this),
        onConnected: this.onConnected.bind(this),
        onDisconnected: this.onDisconnected.bind(this)
      }
    });
  }

  async start() {
    await this.socketSDK.connect();
    await this.socketSDK.subscribeToAgent(
      this.currentWorkflow, 
      this.currentParticipant
    );
    
    // Load conversation history
    await this.socketSDK.getThreadHistory(
      this.currentWorkflow,
      this.currentParticipant,
      0,
      50
    );
  }

  async sendMessage(text: string) {
    await this.socketSDK.sendInboundMessage({
      requestId: `msg-${Date.now()}`,
      participantId: this.currentParticipant,
      workflow: this.currentWorkflow,
      type: 'Chat',
      text
    }, MessageType.Chat);
    
    // Show user message immediately
    this.displayMessage('User', text, 'outgoing');
  }

  private handleAgentMessage(message: Message) {
    this.displayMessage('Agent', message.text!, 'incoming');
  }

  private displayMessage(sender: string, text: string, direction: string) {
    // Update chat UI
    const messageElement = this.createMessageElement(sender, text, direction);
    this.appendToChat(messageElement);
  }

  async dispose() {
    await this.socketSDK.dispose();
  }
}

// Usage
const chat = new ChatApplication('user-123');
await chat.start();
```

### 2. Real-time Data Dashboard

```typescript
class RealTimeDashboard {
  private socketSDK: SocketSDK;
  private dashboardData: any = {};

  constructor() {
    this.socketSDK = new SocketSDK({
      tenantId: 'your-tenant-id',
      apiKey: 'sk-your-api-key',
      serverUrl: 'https://api.yourdomain.com',
      eventHandlers: {
        onReceiveData: this.handleDataUpdate.bind(this),
        onConnected: this.requestInitialData.bind(this)
      }
    });
  }

  async start() {
    await this.socketSDK.connect();
    await this.socketSDK.subscribeToAgent('analytics-engine', 'dashboard-001');
  }

  private async requestInitialData() {
    // Request initial dashboard data
    await this.socketSDK.sendInboundMessage({
      requestId: 'dashboard-init',
      participantId: 'dashboard-001',
      workflow: 'analytics-engine',
      type: 'Data',
      data: { action: 'get_dashboard_data' }
    }, MessageType.Data);
  }

  private handleDataUpdate(message: Message) {
    const updateData = message.data;
    
    switch (updateData?.type) {
      case 'metrics_update':
        this.updateMetrics(updateData.metrics);
        break;
      case 'chart_data':
        this.updateChart(updateData.chartId, updateData.data);
        break;
      case 'alert':
        this.showAlert(updateData);
        break;
    }
  }

  private updateMetrics(metrics: any) {
    Object.assign(this.dashboardData, metrics);
    this.renderDashboard();
  }
}
```

### 3. Multi-Agent Workflow Orchestration

```typescript
class WorkflowOrchestrator {
  private socketSDK: SocketSDK;
  private activeWorkflows: Map<string, any> = new Map();

  constructor() {
    this.socketSDK = new SocketSDK({
      tenantId: 'your-tenant-id',
      apiKey: 'sk-your-api-key',
      serverUrl: 'https://api.yourdomain.com',
      eventHandlers: {
        onReceiveHandoff: this.handleWorkflowHandoff.bind(this),
        onReceiveData: this.handleWorkflowData.bind(this)
      }
    });
  }

  async startWorkflow(workflowType: string, participantId: string, initialData: any) {
    await this.socketSDK.connect();
    await this.socketSDK.subscribeToAgent(workflowType, participantId);
    
    this.activeWorkflows.set(`${workflowType}:${participantId}`, {
      workflowType,
      participantId,
      status: 'active',
      startTime: Date.now()
    });

    // Send initial data to start the workflow
    await this.socketSDK.sendInboundMessage({
      requestId: `start-${Date.now()}`,
      participantId,
      workflow: workflowType,
      type: 'Data',
      data: initialData
    }, MessageType.Data);
  }

  private handleWorkflowHandoff(message: Message) {
    const handoffData = message.data;
    
    if (handoffData?.handoffType === 'workflow_transition') {
      // Start a new workflow based on handoff
      this.startWorkflow(
        handoffData.targetWorkflow,
        message.participantId,
        handoffData.contextData
      );
    }
  }

  private handleWorkflowData(message: Message) {
    const workflowKey = `${message.workflowType}:${message.participantId}`;
    const workflow = this.activeWorkflows.get(workflowKey);
    
    if (workflow && message.data?.status === 'completed') {
      workflow.status = 'completed';
      workflow.endTime = Date.now();
      this.onWorkflowCompleted(workflow);
    }
  }
}
```

## Best Practices

### 1. Connection Management

```typescript
// ✅ Always handle connection states
const socketSDK = new SocketSDK({
  eventHandlers: {
    onConnected: () => {
      // Enable real-time features
      enableRealTimeFeatures();
    },
    onDisconnected: () => {
      // Gracefully degrade to polling or show offline mode
      switchToOfflineMode();
    }
  }
});

// ✅ Implement proper cleanup
window.addEventListener('beforeunload', async () => {
  await socketSDK.dispose();
});
```

### 2. Error Handling

```typescript
// ✅ Handle all error scenarios
const socketSDK = new SocketSDK({
  eventHandlers: {
    onError: (error) => {
      console.error('Socket error:', error);
      showUserFriendlyError('Connection issue occurred');
    },
    onConnectionError: (error) => {
      if (error.statusCode === 401) {
        redirectToLogin();
      } else {
        showRetryOption();
      }
    }
  }
});
```

### 3. Message Handling

```typescript
// ✅ Validate message data
const socketSDK = new SocketSDK({
  eventHandlers: {
    onReceiveData: (message) => {
      if (!message.data || typeof message.data !== 'object') {
        console.warn('Invalid message data received:', message);
        return;
      }
      
      processValidMessage(message);
    }
  }
});
```

### 4. Performance Optimization

```typescript
// ✅ Debounce rapid updates
let updateTimer: NodeJS.Timeout;

const socketSDK = new SocketSDK({
  eventHandlers: {
    onReceiveData: (message) => {
      clearTimeout(updateTimer);
      updateTimer = setTimeout(() => {
        updateUI(message.data);
      }, 100); // Debounce updates
    }
  }
});
```

## Next Steps

- [SSE SDK](./sse-sdk.md) - Server-sent events for notifications
- [REST SDK](./rest-sdk.md) - HTTP-based communication
- [Quick Start Examples](./examples/quick-start.md) - Practical examples
- [Authentication](./authentication.md) - Setup guide 