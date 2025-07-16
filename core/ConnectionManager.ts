import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import type { Settings, Agent, ConnectionState, Message } from './types';
import { MessageProcessor } from './MessageProcessor';

export interface SignalRConnection {
  connection: HubConnection;
  agentIndex: number;
  reconnectAttempts: number;
  threadId?: string;
  connecting?: boolean;
  lastConnectAttempt?: Date;
}

export interface ConnectionManagerEvents {
  onConnectionChange: (agentIndex: number, state: ConnectionState) => void;
  onConnectionError: (agentIndex: number, error: any) => void;
}

export class ConnectionManager {
  private connections = new Map<number, SignalRConnection>();
  private settings: Settings | null = null;
  private agents: Agent[] = [];
  private isInitializing = false;

  constructor(private events: ConnectionManagerEvents, private processor: MessageProcessor) {}

  async initialize(settings: Settings, agents: Agent[]) {
    if (this.isInitializing) {
      console.log('[ConnectionManager] Already initializing, skipping...');
      return;
    }

    console.log('[ConnectionManager] Starting initialization...');
    this.isInitializing = true;
    
    try {
      // Clean up existing connections first
      await this.cleanupExistingConnections();
      
      this.settings = settings;
      this.agents = agents;
      
      const connectionPromises = agents.map((a, i) => this.connectToAgent(a, i));
      const results = await Promise.allSettled(connectionPromises);
      
      // Log connection results
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`[ConnectionManager] Failed to connect agent ${index}:`, result.reason);
        } else {
          console.log(`[ConnectionManager] Successfully connected agent ${index}`);
        }
      });
      
      console.log('[ConnectionManager] Initialization completed');
    } catch (error) {
      console.error('[ConnectionManager] Initialization failed:', error);
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  private async cleanupExistingConnections() {
    if (this.connections.size > 0) {
      console.log(`[ConnectionManager] Cleaning up ${this.connections.size} existing connections`);
      await this.disconnectAll();
    }
  }

  private buildHubUrl(): string {
    if (!this.settings) throw new Error('ConnectionManager not initialized');
    const { agentWebsocketUrl, tenantId, Authorization: agentApiKey } = this.settings;
    return `${agentWebsocketUrl}?tenantId=${encodeURIComponent(tenantId)}&access_token=${encodeURIComponent(agentApiKey)}`;
  }

  private async connectToAgent(agent: Agent, index: number) {
    // Check if already connecting or connected
    const existing = this.connections.get(index);
    if (existing?.connecting || existing?.connection.state === 'Connected') {
      console.log(`[ConnectionManager] Agent ${index} already connecting/connected, skipping`);
      return;
    }

    const now = new Date();
    console.log(`[ConnectionManager] Connecting to agent ${index} (${agent.workflowType})`);
    
    // Mark as connecting
    this.connections.set(index, {
      connection: null as any,
      agentIndex: index,
      reconnectAttempts: 0,
      connecting: true,
      lastConnectAttempt: now
    });

    this.events.onConnectionChange(index, { status: 'connecting' });

    const url = this.buildHubUrl();
    const connection = new HubConnectionBuilder()
      .withUrl(url, { transport: 1 })
      .withAutomaticReconnect([0, 2000, 10000, 30000]) // Progressive backoff
      .configureLogging(LogLevel.Information)
      .build();

    // Set up event handlers
    connection.on('ReceiveMessage', (m: Message) => {
      try {
        this.processor.processMessage(agent.workflowType, m);
      } catch (error) {
        console.error(`[ConnectionManager] Error processing message for ${agent.workflowType}:`, error);
      }
    });
    
    connection.on('ReceiveMetadata', (m: any) => {
      try {
        this.processor.processMetadata(m);
      } catch (error) {
        console.error(`[ConnectionManager] Error processing metadata:`, error);
      }
    });
    
    connection.on('ThreadHistory', (history: Message[]) => {
      try {
        console.log(`[ConnectionManager] Received thread history for ${agent.workflowType}: ${history.length} messages`);
        this.processor.processThreadHistory(history, agent.workflowType);
      } catch (error) {
        console.error(`[ConnectionManager] Error processing thread history for ${agent.workflowType}:`, error);
      }
    });
    
    connection.on('InboundProcessed', (threadId: string) => {
      const rec = this.connections.get(index);
      if (rec) {
        rec.threadId = threadId;
        console.log(`[ConnectionManager] Thread ID updated for agent ${index}: ${threadId}`);
      }
      this.processor.processThreadUpdate(threadId, agent.workflowType);
    });

    // Add handlers for server errors and connection issues
    connection.on('ConnectionError', (error: any) => {
      console.error(`[ConnectionManager] Server connection error for agent ${index}:`, error);
      this.events.onConnectionError(index, error);
    });

    connection.on('Error', (error: any) => {
      console.error(`[ConnectionManager] Server error for agent ${index}:`, error);
    });

    // Handle connection state changes
    connection.onreconnecting((error) => {
      console.log(`[ConnectionManager] Agent ${index} reconnecting:`, error);
      this.events.onConnectionChange(index, { status: 'connecting' });
    });

    connection.onreconnected((connectionId) => {
      console.log(`[ConnectionManager] Agent ${index} reconnected with ID: ${connectionId}`);
      this.events.onConnectionChange(index, { status: 'connected' });
    });

    connection.onclose((error) => {
      console.log(`[ConnectionManager] Agent ${index} connection closed:`, error);
      this.events.onConnectionChange(index, { 
        status: 'disconnected', 
        lastError: error ? String(error) : undefined 
      });
    });

    try {
      await connection.start();
      
      // Update connection record
      this.connections.set(index, { 
        connection, 
        agentIndex: index, 
        reconnectAttempts: 0,
        connecting: false,
        lastConnectAttempt: now
      });
      
      this.events.onConnectionChange(index, { status: 'connected' });
      console.log(`[ConnectionManager] Agent ${index} connected successfully`);
      
      // Subscribe to agent group and request thread history
      await this.subscribeAndRequestHistory(connection, agent, index);
      
    } catch (err) {
      console.error(`[ConnectionManager] Failed to connect agent ${index}:`, err);
      this.connections.delete(index);
      this.events.onConnectionError(index, err);
      this.events.onConnectionChange(index, { 
        status: 'error', 
        lastError: String(err) 
      });
    }
  }

  private async subscribeAndRequestHistory(connection: HubConnection, agent: Agent, index: number) {
    try {
      // Subscribe to agent group using workflowType (server will prepend tenant if needed)
      const workflow = agent.workflowType;
      if (!workflow) {
        console.warn(`[ConnectionManager] Agent ${index} has no workflowType, skipping subscription`);
        return;
      }
      
      console.log(`[ConnectionManager] Subscribing to agent group: workflow=${workflow}, participantId=${this.settings!.participantId}, tenantId=${this.settings!.tenantId}`);
      await connection.invoke('SubscribeToAgent', workflow, this.settings!.participantId, this.settings!.tenantId);
      console.log(`[ConnectionManager] Subscribed to agent group for ${agent.workflowType}`);

      // Request thread history using workflowType
      console.log(`[ConnectionManager] Requesting thread history: workflowType=${agent.workflowType}, participantId=${this.settings!.participantId}`);
      await connection.invoke('GetThreadHistory', agent.workflowType, this.settings!.participantId, 1, 100);
      console.log(`[ConnectionManager] Requested thread history for ${agent.workflowType}`);
    } catch (e) {
      console.error(`[ConnectionManager] Failed to subscribe/get history for agent ${index}:`, e);
      // Log more details about the error
      if (e instanceof Error) {
        console.error(`[ConnectionManager] Error details:`, {
          name: e.name,
          message: e.message,
          stack: e.stack
        });
      }
      // Don't fail the connection for this, it's not critical
    }
  }

  getConnection(index: number) {
    const conn = this.connections.get(index);
    return conn?.connection && conn.connection.state === 'Connected' ? conn.connection : null;
  }

  /** Retrieve the DB threadId previously received via InboundProcessed for this agent index */
  getThreadId(index: number): string | undefined {
    return this.connections.get(index)?.threadId;
  }

  async disconnectAll() {
    if (this.connections.size === 0) {
      console.log('[ConnectionManager] No connections to disconnect');
      return;
    }

    console.log(`[ConnectionManager] Disconnecting ${this.connections.size} connections`);
    
    const disconnectPromises = Array.from(this.connections.values()).map(async (c) => {
      try {
        if (c.connection && c.connection.state !== 'Disconnected') {
          await c.connection.stop();
          console.log(`[ConnectionManager] Disconnected agent ${c.agentIndex}`);
        }
      } catch (error) {
        console.error(`[ConnectionManager] Error disconnecting agent ${c.agentIndex}:`, error);
      }
    });

    await Promise.allSettled(disconnectPromises);
    this.connections.clear();
    console.log('[ConnectionManager] All connections disconnected');
  }

  getConnectionStates(): Map<number, ConnectionState> {
    const map = new Map<number, ConnectionState>();
    this.connections.forEach((c, idx) => {
      const status = c.connecting ? 'connecting' : 
                    (c.connection?.state === 'Connected' ? 'connected' : 'disconnected');
      map.set(idx, { 
        status,
        lastConnectAttempt: c.lastConnectAttempt
      });
    });
    return map;
  }

  getStats() {
    return {
      totalConnections: this.connections.size,
      connectedCount: Array.from(this.connections.values())
        .filter(c => c.connection?.state === 'Connected').length,
      connectingCount: Array.from(this.connections.values())
        .filter(c => c.connecting).length,
      isInitializing: this.isInitializing
    };
  }
} 