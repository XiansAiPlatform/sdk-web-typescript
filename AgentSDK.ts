import { Hub, HubEvents } from './core/Hub';
import type { Settings } from './core/types';
import type { Agent } from './core/types';

/**
 * Chat message structure for regular conversation messages
 */
export interface ChatMessageData {
  workflowId: string;
  text: string;
  direction: 'Incoming' | 'Outgoing';
  timestamp: Date;
  threadId: string;
  data?: any;
  isHistorical: boolean;
}

/**
 * Handoff message structure for agent-to-agent transitions
 */
export interface HandoffMessage {
  workflowId: string;
  text: string;
  direction: 'Incoming' | 'Outgoing';
  timestamp: Date;
  threadId: string;
  data?: any;
  isHistorical: boolean;
}

/**
 * Options required to initialize the AgentSDK.
 * These correspond 1-to-1 with the SettingsContext data that the app already uses.
 */
export interface AgentSDKOptions extends Settings {
  // SDK no longer accepts UI properties
}

/**
 * A thin, ergonomic facade over WebSocketHub.
 *
 * The goal is to hide the complexity of SignalR / WebSocket logic while still
 * exposing the most common actions an integrating app needs:
 *   1. connect / disconnect
 *   2. send chat or data messages to a specific agent
 *   3. subscribe to high-level events (message, connection_change, error, …)
 */
export class AgentSDK {
  private hub: Hub;
  private initialized = false;
  private connecting = false;
  private readonly options: AgentSDKOptions;
  static #shared: AgentSDK | null = null;
  private static _hub: Hub | null = null;
  private static _initPromise: Promise<void> | null = null;

  constructor(options: AgentSDKOptions) {
    this.options = options;
    if (!AgentSDK._hub) {
      AgentSDK._hub = new Hub();
    }
    this.hub = AgentSDK._hub;
  }

  /**
   * Establish websocket connections for all configured agents.
   * Safe to call multiple times – subsequent calls become no-ops.
   * Prevents multiple concurrent connection attempts.
   */
  async connect(agents: Agent[]): Promise<void> {
    if (this.initialized) {
      console.log('[AgentSDK] Already initialized, skipping connect');
      return;
    }
    
    if (this.connecting) {
      console.log('[AgentSDK] Connection in progress, waiting...');
      if (AgentSDK._initPromise) {
        await AgentSDK._initPromise;
      }
      return;
    }
    
    try {
      this.connecting = true;
      console.log('[AgentSDK] Starting connection process...');
      
      if (!this.hub) throw new Error('Hub not ready');
      
      AgentSDK._initPromise = this.hub.initialize(this.options as Settings, agents);
      await AgentSDK._initPromise;
      
      this.initialized = true;
      console.log('[AgentSDK] Connection established successfully');
    } catch (error) {
      console.error('[AgentSDK] Connection failed:', error);
      throw error;
    } finally {
      this.connecting = false;
      AgentSDK._initPromise = null;
    }
  }

  /** Disconnect every active agent connection */
  async disconnect(): Promise<void> {
    if (!this.initialized) {
      console.log('[AgentSDK] Not initialized, skipping disconnect');
      return;
    }
    
    console.log('[AgentSDK] Disconnecting...');
    await this.hub.disconnectAll();
    this.initialized = false;
    this.connecting = false;
    AgentSDK._initPromise = null;
    console.log('[AgentSDK] Disconnected successfully');
  }

  /**
   * Send a plain-text chat message to the agent identified by `workflowType`.
   */
  async sendChat(workflowType: string, text: string, data: any = {}, overrideDefaultData?: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('SDK not initialized. Call connect() first.');
    }
    await this.hub.sendChat(workflowType, text, data, overrideDefaultData);
  }

  /**
   * Send an arbitrary JSON-serialisable payload as a *Data* message.
   */
  async sendData(workflowType: string, data: unknown): Promise<void> {
    if (!this.initialized) {
      throw new Error('SDK not initialized. Call connect() first.');
    }
    await this.hub.sendData(workflowType, data);
  }

  /**
   * Subscribe to hub-level events in a type-safe manner.  
   * Returns an unsubscribe function for convenience.
   */
  on<E extends keyof HubEvents>(event: E, handler: (ev: any) => void): () => void {
    this.hub.on(event, handler);
    // Provide a disposer so callers can easily remove the listener
    return () => this.hub.off(event, handler);
  }

  /** Manually remove a subscription created earlier via `on`. */
  off<E extends keyof HubEvents>(event: E, handler: (ev: any) => void): void {
    this.hub.off(event, handler);
  }

  /** Convenience accessor to inspect current connection states */
  getConnectionStates() {
    return this.hub.getConnectionStates();
  }

  /** Convenience accessor to retrieve chat history for a given workflow */
  getChatHistory(workflowType: string) {
    return this.hub.getChatHistory(workflowType);
  }

  /**
   * Expose hub statistics – handy for debugging dashboards.
   */
  getStats() {
    return this.hub.getStats();
  }

  /**
   * Retrieve connection information for a specific agent workflow.
   */
  getAgentConnectionStateByWorkflowType(workflowType: string) {
    return this.hub.getAgentConnectionState(workflowType);
  }

  /**
   * Refresh thread history for a specific workflow by requesting it from the server.
   * Returns true if the request was successful, false otherwise.
   */
  async refreshThreadHistory(workflowType: string): Promise<boolean> {
    if (!this.initialized) {
      console.warn('SDK not initialized. Call connect() first.');
      return false;
    }
    return await this.hub.refreshThreadHistory(workflowType);
  }

  /**
   * Subscribe to *data* messages coming from the backend.
   * This allows you to receive both Chat and Data message types from agents.
   */
  subscribeToData(
    subscriberId: string,
    messageTypes: string[],
    callback: (msg: any) => void
  ) {
    return this.hub.subscribeToData(subscriberId, messageTypes, callback);
  }

  /** Unsubscribe from data messages by subscriber ID. */
  unsubscribeFromData(subscriberId: string) {
    this.hub.unsubscribeFromData(subscriberId);
  }

  /**
   * Subscribe specifically to chat messages.
   * This provides a dedicated channel for handling regular conversation messages.
   * 
   * @param callback - Function called when a chat message is received
   * @returns Unsubscribe function
   */
  subscribeToChatMessages(callback: (chat: ChatMessageData) => void): () => void {
    return this.on('message', (ev: { workflowId: string; data: any }) => {
      const message = ev.data;
      if (message.messageType === 'Chat') {
        const chatMessage: ChatMessageData = {
          workflowId: ev.workflowId,
          text: message.text,
          direction: message.direction,
          timestamp: message.timestamp,
          threadId: message.threadId,
          data: message.data,
          isHistorical: message.isHistorical || false
        };
        callback(chatMessage);
      }
    });
  }

  /**
   * Subscribe specifically to handoff messages.
   * This provides a dedicated channel for handling agent-to-agent handoffs.
   * 
   * @param callback - Function called when a handoff message is received
   * @returns Unsubscribe function
   */
  subscribeToHandoffs(callback: (handoff: HandoffMessage) => void): () => void {
    return this.on('message', (ev: { workflowId: string; data: any }) => {
      const message = ev.data;
      if (message.messageType === 'Handoff') {
        const handoffMessage: HandoffMessage = {
          workflowId: ev.workflowId,
          text: message.text,
          direction: message.direction,
          timestamp: message.timestamp,
          threadId: message.threadId,
          data: message.data,
          isHistorical: message.isHistorical || false
        };
        callback(handoffMessage);
      }
    });
  }



  /**
   * Initialise a shared singleton instance. Subsequent calls return the first
   * instance that was created, ignoring the provided options (they should be
   * identical across the app anyway).
   */
  static initShared(options: AgentSDKOptions): AgentSDK {
    if (!AgentSDK.#shared) {
      console.log('[AgentSDK] Creating new shared instance');
      AgentSDK.#shared = new AgentSDK(options);
    } else {
      console.log('[AgentSDK] Reusing existing shared instance');
    }
    return AgentSDK.#shared;
  }

  /** Obtain the previously-initialised shared instance. */
  static getShared(): AgentSDK {
    if (!AgentSDK.#shared)
      throw new Error('Call AgentSDK.initShared(options) first.');
    return AgentSDK.#shared;           // return the SDK instance, not Hub
  }

  /**
   * Reset the shared instance - useful for testing or hot reloads
   */
  static resetShared(): void {
    if (AgentSDK.#shared) {
      console.log('[AgentSDK] Resetting shared instance');
      AgentSDK.#shared.disconnect().catch(console.error);
      AgentSDK.#shared = null;
      AgentSDK._hub = null;
      AgentSDK._initPromise = null;
    }
  }

  /**
   * Get connection status for debugging
   */
  getConnectionStatus() {
    return {
      initialized: this.initialized,
      connecting: this.connecting,
      hasSharedInstance: !!AgentSDK.#shared,
      hasHub: !!this.hub,
      connectionStates: this.getConnectionStates()
    };
  }
}

export default AgentSDK; 