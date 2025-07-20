# SSE SDK

The SSE SDK provides real-time server-to-client communication using Server-Sent Events (SSE). It's ideal for live notifications, status monitoring, and one-way real-time updates where bidirectional communication isn't required.

## Overview

The SSE SDK offers:

- **Event streaming**: Continuous server-to-client updates
- **Heartbeat monitoring**: Connection health checks with subscriber counts
- **Automatic reconnection**: Resilient connection handling
- **Event-driven architecture**: React to different event types
- **Browser compatibility**: Works with native EventSource API

## Installation

```typescript
import { SseSDK } from 'xiansai-sdk';
```

## Configuration

### Basic Setup

```typescript
const sseSDK = new SseSDK({
  tenantId: 'your-tenant-id',
  apiKey: 'sk-your-api-key',
  serverUrl: 'https://api.yourdomain.com'
});
```

### Configuration Options

```typescript
interface SseSDKOptions {
  tenantId: string;                    // Required: Tenant identifier
  apiKey?: string;                     // API key authentication
  jwtToken?: string;                   // JWT token authentication
  getJwtToken?: () => Promise<string>; // JWT token callback
  serverUrl: string;                   // Required: Server URL
  maxReconnectAttempts?: number;       // Reconnect attempts (default: 5)
  reconnectDelay?: number;             // Reconnect delay (default: 5000ms)
  connectionTimeout?: number;          // Connection timeout (default: 30000ms)
  autoReconnect?: boolean;             // Auto-reconnect (default: true)
  eventHandlers?: SseEventHandlers;    // Event handlers
  logger?: LoggerFunction;             // Custom logger
}
```

## Authentication

### API Key Authentication (Recommended for SSE)

```typescript
const sseSDK = new SseSDK({
  tenantId: 'your-tenant-id',
  apiKey: 'sk-your-api-key',
  serverUrl: 'https://api.yourdomain.com'
});
```

### JWT Token Authentication

```typescript
// Static token
const sseSDK = new SseSDK({
  tenantId: 'your-tenant-id',
  jwtToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  serverUrl: 'https://api.yourdomain.com'
});

// Dynamic token (with browser compatibility fallback)
const sseSDK = new SseSDK({
  tenantId: 'your-tenant-id',
  getJwtToken: async () => {
    const response = await fetch('/api/auth/token');
    const { accessToken } = await response.json();
    return accessToken;
  },
  serverUrl: 'https://api.yourdomain.com'
});
```

**Note**: JWT authentication with EventSource has browser limitations. The SDK automatically falls back to query parameters when custom headers aren't supported.

## Event Types

### SSE Event Structure

```typescript
interface SseEvent {
  type: string;    // Event type
  data: any;       // Event payload
  id?: string;     // Event ID
  retry?: number;  // Retry interval
}
```

### Event Types (SSE)

#### 1. Message Events

```typescript
// Chat, Data, and Handoff events contain Message objects
interface SseMessageEvent {
  type: 'Chat' | 'Data' | 'Handoff';
  data: Message;
  id?: string;
}
```

#### 2. Heartbeat Events

```typescript
// Heartbeat events monitor connection health
interface SseHeartbeatEvent {
  type: 'heartbeat';
  data: {
    timestamp: string;
    subscriberCount: number;
  };
  id?: string;
}
```

#### 3. Connection Events

```typescript
// Connection state events
interface SseConnectionEvent {
  type: 'connected' | 'disconnected' | 'reconnecting';
  data: {
    timestamp: string;
    reason?: string;
  };
  id?: string;
}
```

#### 4. Error Events

```typescript
// Error events
interface SseErrorEvent {
  type: 'error';
  data: {
    error: string;
    code?: string;
    timestamp: string;
  };
  id?: string;
}
```

## Event Handlers

### Event Handler Interface

```typescript
interface SseEventHandlers {
  onReceiveChat?: (message: Message) => void;
  onReceiveData?: (message: Message) => void;
  onReceiveHandoff?: (message: Message) => void;
  onHeartbeat?: (data: HeartbeatData) => void;
  onConnected?: () => void;
  onDisconnected?: (reason?: string) => void;
  onReconnecting?: (reason?: string) => void;
  onError?: (error: string) => void;
}
```

### Setting Up Event Handlers

```typescript
const sseSDK = new SseSDK({
  tenantId: 'your-tenant-id',
  apiKey: 'sk-your-api-key',
  serverUrl: 'https://api.yourdomain.com',
  eventHandlers: {
    onReceiveChat: (message) => {
      console.log('Chat message received:', message.text);
      displayChatMessage(message);
    },
    onReceiveData: (message) => {
      console.log('Data message received:', message.data);
      processDataUpdate(message.data);
    },
    onReceiveHandoff: (message) => {
      console.log('Handoff message received:', message.data);
      handleHandoffNotification(message);
    },
    onHeartbeat: (data) => {
      console.log(`Heartbeat: ${data.subscriberCount} subscribers at ${data.timestamp}`);
      updateConnectionStatus(data);
    },
    onConnected: () => {
      console.log('Connected to SSE stream');
      showConnectedIndicator();
    },
    onDisconnected: (reason) => {
      console.log('Disconnected from SSE stream:', reason);
      showDisconnectedIndicator();
    },
    onError: (error) => {
      console.error('SSE error:', error);
      showErrorNotification(error);
    }
  }
});
```

## Connection Management

### Connecting to SSE Stream

```typescript
// Connect to SSE stream with connection parameters
await sseSDK.connect({
  workflow: 'customer-support',
  participantId: 'user-123',
  scope: 'notifications',           // Optional scope filter
  heartbeatSeconds: 30             // Optional heartbeat interval
});

// Check connection state
console.log('Is connected:', sseSDK.isConnected());
console.log('Connection state:', sseSDK.getConnectionState());
```

### Connection Parameters

```typescript
interface SseConnectionParams {
  workflow: string;           // Required: Workflow identifier
  participantId: string;      // Required: Participant identifier
  scope?: string;            // Optional: Message scope filter
  heartbeatSeconds?: number; // Optional: Heartbeat interval (default: server setting)
}
```

### Disconnecting

```typescript
// Disconnect from SSE stream
sseSDK.disconnect();
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

## Event Handling

### Basic Event Handling

```typescript
const sseSDK = new SseSDK({
  tenantId: 'your-tenant-id',
  apiKey: 'sk-your-api-key',
  serverUrl: 'https://api.yourdomain.com',
  eventHandlers: {
    onReceiveChat: (message) => {
      updateChatInterface(message);
    },
    onReceiveData: (message) => {
      updateDataDisplay(message.data);
    },
    onHeartbeat: (data) => {
      updateConnectionInfo(data.subscriberCount, data.timestamp);
    }
  }
});

await sseSDK.connect({
  workflow: 'customer-support',
  participantId: 'user-123'
});
```

### Legacy Event Listener API

```typescript
// Alternative: Use event listener API for backward compatibility
sseSDK.on('message', (event) => {
  console.log('Received event:', event.type, event.data);
  
  switch (event.type) {
    case 'Chat':
      handleChatMessage(event.data);
      break;
    case 'Data':
      handleDataMessage(event.data);
      break;
    case 'Handoff':
      handleHandoffMessage(event.data);
      break;
  }
});

sseSDK.on('heartbeat', (event) => {
  console.log('Heartbeat:', event.data);
});

sseSDK.on('error', (event) => {
  console.error('Error:', event.data);
});
```

### One-time Event Listeners

```typescript
// Listen for a single event
sseSDK.once('connected', (event) => {
  console.log('Connected at:', event.data.timestamp);
});

// Remove event listeners
const handler = (event) => console.log(event);
sseSDK.on('message', handler);
sseSDK.off('message', handler);
```

## Advanced Usage

### Connection Monitoring

```typescript
const sseSDK = new SseSDK({
  tenantId: 'your-tenant-id',
  apiKey: 'sk-your-api-key',
  serverUrl: 'https://api.yourdomain.com',
  eventHandlers: {
    onHeartbeat: (data) => {
      // Monitor connection health
      const now = new Date(data.timestamp);
      const lastHeartbeat = now.getTime();
      
      // Update connection quality indicator
      updateConnectionQuality({
        lastHeartbeat,
        subscriberCount: data.subscriberCount,
        quality: 'good'
      });
    },
    onConnected: () => {
      showConnectionStatus('connected');
    },
    onDisconnected: (reason) => {
      showConnectionStatus('disconnected', reason);
    },
    onReconnecting: (reason) => {
      showConnectionStatus('reconnecting', reason);
    }
  }
});
```

### Error Handling and Recovery

```typescript
const sseSDK = new SseSDK({
  tenantId: 'your-tenant-id',
  apiKey: 'sk-your-api-key',
  serverUrl: 'https://api.yourdomain.com',
  maxReconnectAttempts: 10,
  reconnectDelay: 3000,
  eventHandlers: {
    onError: (error) => {
      console.error('SSE Error:', error);
      
      // Handle specific error types
      if (error.includes('Authentication')) {
        handleAuthenticationError();
      } else if (error.includes('Network')) {
        handleNetworkError();
      } else {
        showGenericError(error);
      }
    },
    onDisconnected: (reason) => {
      // Log disconnection reason
      console.log('Disconnected:', reason);
      
      // Update UI to show offline state
      updateUIForOfflineMode();
    },
    onReconnecting: (reason) => {
      // Show reconnection attempt
      showReconnectingMessage(`Reconnecting: ${reason}`);
    }
  }
});
```

### Dynamic Event Handler Updates

```typescript
// Update event handlers at runtime
sseSDK.updateEventHandlers({
  onReceiveData: (message) => {
    // Updated data handling logic
    handleDataWithNewFeatures(message);
  },
  onHeartbeat: (data) => {
    // Enhanced heartbeat monitoring
    monitorConnectionHealth(data);
  }
});
```

### Authentication Updates

```typescript
// Update API key
sseSDK.updateApiKey('sk-new-api-key');

// Update JWT token
sseSDK.updateJwtToken('new-jwt-token');

// Update JWT callback
sseSDK.updateJwtTokenCallback(async () => {
  const response = await fetch('/api/auth/refresh');
  const { token } = await response.json();
  return token;
});
```

## Common Use Cases

### 1. Real-time Notifications Dashboard

```typescript
class NotificationDashboard {
  private sseSDK: SseSDK;
  private notifications: any[] = [];

  constructor() {
    this.sseSDK = new SseSDK({
      tenantId: 'your-tenant-id',
      apiKey: 'sk-your-api-key',
      serverUrl: 'https://api.yourdomain.com',
      eventHandlers: {
        onReceiveData: this.handleNotification.bind(this),
        onReceiveChat: this.handleChatNotification.bind(this),
        onHeartbeat: this.updateConnectionStatus.bind(this)
      }
    });
  }

  async start() {
    await this.sseSDK.connect({
      workflow: 'notification-service',
      participantId: 'dashboard-user',
      scope: 'alerts'
    });
  }

  private handleNotification(message: Message) {
    const notification = {
      id: message.id,
      type: message.data?.notificationType || 'info',
      title: message.data?.title || 'Notification',
      content: message.data?.content || message.text,
      timestamp: message.createdAt,
      read: false
    };

    this.notifications.unshift(notification);
    this.updateNotificationsList();
    this.showToast(notification);
  }

  private handleChatNotification(message: Message) {
    // Handle chat-based notifications
    this.showChatAlert({
      message: message.text,
      sender: 'System',
      priority: 'normal'
    });
  }

  private updateConnectionStatus(data: any) {
    document.getElementById('connection-status')!.textContent = 
      `Connected (${data.subscriberCount} active)`;
  }

  dispose() {
    this.sseSDK.dispose();
  }
}
```

### 2. Live Status Monitor

```typescript
class StatusMonitor {
  private sseSDK: SseSDK;
  private statusData: Map<string, any> = new Map();

  constructor() {
    this.sseSDK = new SseSDK({
      tenantId: 'your-tenant-id',
      apiKey: 'sk-your-api-key',
      serverUrl: 'https://api.yourdomain.com',
      eventHandlers: {
        onReceiveData: this.handleStatusUpdate.bind(this),
        onConnected: this.requestInitialStatus.bind(this),
        onHeartbeat: this.handleHeartbeat.bind(this)
      }
    });
  }

  async start(systemId: string) {
    await this.sseSDK.connect({
      workflow: 'system-monitor',
      participantId: systemId,
      heartbeatSeconds: 15  // More frequent heartbeats for monitoring
    });
  }

  private handleStatusUpdate(message: Message) {
    const statusUpdate = message.data;
    
    switch (statusUpdate?.type) {
      case 'system_health':
        this.updateSystemHealth(statusUpdate);
        break;
      case 'performance_metrics':
        this.updatePerformanceMetrics(statusUpdate);
        break;
      case 'alert':
        this.handleAlert(statusUpdate);
        break;
      case 'service_status':
        this.updateServiceStatus(statusUpdate);
        break;
    }
  }

  private updateSystemHealth(data: any) {
    this.statusData.set('health', data);
    this.renderHealthDashboard();
  }

  private handleAlert(alert: any) {
    // Show critical alerts immediately
    if (alert.severity === 'critical') {
      this.showCriticalAlert(alert);
    }
    
    // Log all alerts
    this.logAlert(alert);
  }

  private handleHeartbeat(data: any) {
    // Monitor for connection health
    document.getElementById('last-update')!.textContent = 
      `Last update: ${new Date(data.timestamp).toLocaleTimeString()}`;
  }
}
```

### 3. Live Chat Support Interface

```typescript
class LiveChatSupport {
  private sseSDK: SseSDK;
  private chatMessages: Message[] = [];

  constructor(supportTicketId: string) {
    this.sseSDK = new SseSDK({
      tenantId: 'your-tenant-id',
      apiKey: 'sk-your-api-key',
      serverUrl: 'https://api.yourdomain.com',
      eventHandlers: {
        onReceiveChat: this.handleAgentMessage.bind(this),
        onReceiveHandoff: this.handleAgentHandoff.bind(this),
        onConnected: this.onConnected.bind(this),
        onDisconnected: this.onDisconnected.bind(this)
      }
    });
  }

  async start(customerId: string) {
    await this.sseSDK.connect({
      workflow: 'customer-support',
      participantId: customerId,
      scope: 'chat'
    });
  }

  private handleAgentMessage(message: Message) {
    // Display agent messages in chat interface
    this.addMessageToChat({
      sender: 'Agent',
      text: message.text!,
      timestamp: message.createdAt,
      type: 'incoming'
    });
    
    // Show typing indicator stopped
    this.hideTypingIndicator();
    
    // Play notification sound
    this.playNotificationSound();
  }

  private handleAgentHandoff(message: Message) {
    const handoffData = message.data;
    
    if (handoffData?.handoffType === 'agent_change') {
      this.showHandoffNotification({
        fromAgent: handoffData.fromAgent,
        toAgent: handoffData.toAgent,
        message: message.text || 'Your chat has been transferred to another agent'
      });
    }
  }

  private onConnected() {
    this.showStatus('Connected to support chat');
  }

  private onDisconnected(reason?: string) {
    this.showStatus(`Disconnected: ${reason || 'Connection lost'}`);
  }

  private addMessageToChat(messageData: any) {
    const messageElement = this.createMessageElement(messageData);
    document.getElementById('chat-messages')!.appendChild(messageElement);
    this.scrollToBottom();
  }
}
```

### 4. Workflow Progress Tracking

```typescript
class WorkflowProgressTracker {
  private sseSDK: SseSDK;
  private currentWorkflows: Map<string, any> = new Map();

  constructor() {
    this.sseSDK = new SseSDK({
      tenantId: 'your-tenant-id',
      apiKey: 'sk-your-api-key',
      serverUrl: 'https://api.yourdomain.com',
      eventHandlers: {
        onReceiveData: this.handleProgressUpdate.bind(this),
        onReceiveHandoff: this.handleWorkflowTransition.bind(this)
      }
    });
  }

  async trackWorkflow(workflowId: string, participantId: string) {
    await this.sseSDK.connect({
      workflow: workflowId,
      participantId: participantId,
      scope: 'progress'
    });

    this.currentWorkflows.set(workflowId, {
      id: workflowId,
      participantId,
      status: 'tracking',
      startTime: Date.now()
    });
  }

  private handleProgressUpdate(message: Message) {
    const progressData = message.data;
    
    if (progressData?.type === 'workflow_progress') {
      this.updateProgressBar({
        workflowId: message.workflowId,
        currentStep: progressData.currentStep,
        totalSteps: progressData.totalSteps,
        percentage: progressData.percentage,
        stepDescription: progressData.description
      });
    }
  }

  private handleWorkflowTransition(message: Message) {
    const handoffData = message.data;
    
    if (handoffData?.handoffType === 'workflow_completion') {
      this.markWorkflowComplete(message.workflowId, handoffData);
    }
  }

  private updateProgressBar(progress: any) {
    const progressElement = document.getElementById(`progress-${progress.workflowId}`);
    if (progressElement) {
      progressElement.style.width = `${progress.percentage}%`;
      progressElement.textContent = `${progress.currentStep}/${progress.totalSteps}: ${progress.stepDescription}`;
    }
  }
}
```

## Browser Compatibility

### EventSource Support

```typescript
// The SDK automatically handles EventSource compatibility
const sseSDK = new SseSDK({
  tenantId: 'your-tenant-id',
  apiKey: 'sk-your-api-key',
  serverUrl: 'https://api.yourdomain.com'
});

// For Node.js environments, install 'eventsource' package:
// npm install eventsource
```

### JWT Authentication Limitations

```typescript
// EventSource has limited header support in some browsers
// The SDK automatically handles this by falling back to query parameters

const sseSDK = new SseSDK({
  tenantId: 'your-tenant-id',
  getJwtToken: async () => {
    // SDK will try Authorization header first, then fallback to query param
    return await getTokenFromAuth();
  },
  serverUrl: 'https://api.yourdomain.com'
});
```

## Best Practices

### 1. Connection Management

```typescript
// ✅ Handle connection states properly
const sseSDK = new SseSDK({
  eventHandlers: {
    onConnected: () => {
      // Enable real-time features
      enableLiveUpdates();
    },
    onDisconnected: () => {
      // Fallback to polling or show offline indicator
      enableOfflineMode();
    }
  }
});
```

### 2. Error Handling

```typescript
// ✅ Implement comprehensive error handling
const sseSDK = new SseSDK({
  eventHandlers: {
    onError: (error) => {
      // Log error and show user-friendly message
      console.error('SSE Error:', error);
      showNotification('Connection issue detected', 'warning');
    }
  }
});
```

### 3. Resource Management
```typescript
// ✅ Clean up resources properly
let sseSDK: SseSDK;

// Initialize
function initializeSSE() {
  sseSDK = new SseSDK({ /* config */ });
  return sseSDK.connect({ /* params */ });
}

// Cleanup
function cleanup() {
  if (sseSDK) {
    sseSDK.dispose();
    sseSDK = null;
  }
}

// Handle page unload
window.addEventListener('beforeunload', cleanup);
```

### 4. Performance Optimization
```typescript
// ✅ Debounce rapid updates
let updateTimer: NodeJS.Timeout;

const sseSDK = new SseSDK({
  eventHandlers: {
    onReceiveData: (message) => {
      clearTimeout(updateTimer);
      updateTimer = setTimeout(() => {
        updateUI(message.data);
      }, 100);
    }
  }
});
```

## Next Steps

- [REST SDK](./rest-sdk.md) - HTTP-based communication
- [Socket SDK](./socket-sdk.md) - Bidirectional real-time communication
- [Quick Start Examples](./examples/quick-start.md) - Practical examples
- [Authentication](./authentication.md) - Setup guide 