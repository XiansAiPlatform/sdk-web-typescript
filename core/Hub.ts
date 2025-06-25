import { ConnectionManager, ConnectionManagerEvents } from './ConnectionManager';
import { MessageProcessor, MessageProcessorEvents } from './MessageProcessor';
import { MetadataMessageRouter } from './MetadataMessageRouter';
import { EventDispatcher } from './EventDispatcher';
import type { Settings, Agent, ConnectionState } from './types';

export interface HubEvents {
  message: { workflowId: string; data: any };
  connection_change: { workflowId: string; data: ConnectionState };
  error: any;
}

export class Hub {
  private connMgr: ConnectionManager;
  private router: MetadataMessageRouter;
  private processor: MessageProcessor;
  private dispatcher = new EventDispatcher<HubEvents>();
  private agents: Agent[] = [];
  private settings!: Settings;

  // Bind public methods after instantiation to avoid referencing before init
  on = this.dispatcher.on.bind(this.dispatcher);
  off = this.dispatcher.off.bind(this.dispatcher);

  constructor() {
    this.router = new MetadataMessageRouter();

    const mpEvents: MessageProcessorEvents = {
      onChatMessage: (workflowId, msg) => this.dispatcher.emit('message', { workflowId, data: msg }),
      onThreadUpdate: () => {},
      onError: (_, err) => this.dispatcher.emit('error', err)
    };
    this.processor = new MessageProcessor(mpEvents, this.router);

    const cmEvents: ConnectionManagerEvents = {
      onConnectionChange: (idx, state) => {
        const workflowType = this.agents[idx]?.workflowType;
        if (workflowType) this.dispatcher.emit('connection_change', { workflowId: workflowType, data: state });
      },
      onConnectionError: (_, err) => this.dispatcher.emit('error', err)
    };
    this.connMgr = new ConnectionManager(cmEvents, this.processor);

    // Nothing else
  }

  async initialize(settings: Settings, agents: Agent[]) {
    this.settings = settings;
    this.agents = agents;
    await this.connMgr.initialize(settings, agents);
  }

  sendChat(workflowType: string, text: string, extraData: any = {}, overrideDefaultData?: string) {
    const idx = this.findAgentIndex(workflowType);
    const conn = this.connMgr.getConnection(idx);
    if (!conn) throw new Error('No connection');
    const agent = this.agents[idx];
    
    // Get default data dynamically if function is provided, otherwise use override if provided
    let defaultDataToUse: any = {};
    if (overrideDefaultData !== undefined) {
      // Use the explicit override if provided
      try {
        defaultDataToUse = overrideDefaultData ? JSON.parse(overrideDefaultData) : {};
      } catch {
        console.warn('[Hub] Invalid JSON in overrideDefaultData, using empty object');
        defaultDataToUse = {};
      }
    } else if (this.settings.getDefaultData) {
      // Use the dynamic function
      const defaultDataStr = this.settings.getDefaultData();
      if (defaultDataStr) {
        try {
          defaultDataToUse = JSON.parse(defaultDataStr);
        } catch {
          console.warn('[Hub] Invalid JSON from getDefaultData, using empty object');
          defaultDataToUse = {};
        }
      }
    }
    
    const payload = {
      participantId: this.settings.participantId,
      workflowType: agent.workflowType,
      ...(agent.workflowId ? { workflowId: agent.workflowId } : {}),
      ...(agent.agent ? { agent: agent.agent } : {}),
      ...(this.connMgr.getThreadId(idx) ? { threadId: this.connMgr.getThreadId(idx) } : {}),
      text,
      data: {
        ...defaultDataToUse,
        ...extraData
      }
    };
    return conn.invoke('SendInboundMessage', payload, 'Chat');
  }

  sendData(workflowType: string, data: any) {
    const idx = this.findAgentIndex(workflowType);
    const conn = this.connMgr.getConnection(idx);
    if (!conn) throw new Error('No connection');
    const agent = this.agents[idx];
    const payload = {
      participantId: this.settings.participantId,
      workflowType: agent.workflowType,
      ...(agent.workflowId ? { workflowId: agent.workflowId } : {}),
      ...(agent.agent ? { agent: agent.agent } : {}),
      ...(this.connMgr.getThreadId(idx) ? { threadId: this.connMgr.getThreadId(idx) } : {}),
      data
    };
    return conn.invoke('SendInboundMessage', payload, 'Data');
  }

  private findAgentIndex(workflowType: string) {
    const idx = this.agents.findIndex(a => a.workflowType === workflowType);
    if (idx === -1) throw new Error(`Agent ${workflowType} not registered`);
    return idx;
  }

  subscribeToData(id: string, types: string[], cb: (msg:any)=>void) {
    console.log('[Hub] subscribeToData', id, types);
    return this.router.subscribe({ id, messageTypes: types, callback: cb });
  }

  unsubscribeFromData(id: string) { this.router.unsubscribe(id); }

  disconnectAll() { return this.connMgr.disconnectAll(); }

  async refreshThreadHistory(workflowType: string): Promise<boolean> {
    try {
      const idx = this.findAgentIndex(workflowType);
      const conn = this.connMgr.getConnection(idx);
      if (!conn || conn.state !== 'Connected') {
        console.warn(`[Hub] Cannot refresh history - no active connection for ${workflowType}`);
        return false;
      }
      
      const agent = this.agents[idx];
      await conn.invoke('GetThreadHistory', agent.workflowType, this.settings.participantId, 1, 100);
      console.log(`[Hub] Successfully requested thread history refresh for ${workflowType}`);
      return true;
    } catch (error) {
      console.error(`[Hub] Failed to refresh thread history for ${workflowType}:`, error);
      return false;
    }
  }

  // Expose helpers later
  getChatHistory = (wf: string) => this.processor.getChatHistory(wf);
  getConnectionStates = () => this.connMgr.getConnectionStates();
  getAgentConnectionState = (workflowType: string): ConnectionState | undefined => {
    const map = this.connMgr.getConnectionStates();
    for (const [idx, state] of map.entries()) {
      if (this.agents[idx]?.workflowType === workflowType) return state;
    }
    return undefined;
  };

  getStats = () => ({
    connectionStats: [...this.connMgr.getConnectionStates().entries()],
    metadataStats: this.router.getStats(),
    eventStats: this.dispatcher.getStats()
  });
} 