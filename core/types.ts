/*
 * SDK-internal type declarations – intentionally minimal and UI-agnostic.
 */

// Connection / authentication settings expected by the backend SignalR hub
export interface Settings {
  agentWebsocketUrl: string; // full hub URL (without querystring)
  Authorization: string;      // bearer token or similar
  tenantId: string;
  participantId: string;
  getDefaultData?: () => string | undefined; // optional function to get contextual data for each chat
}

// Definition of a single backend agent (bot)
export interface Agent {
  id: string; // developer-friendly identifier unique inside the app
  workflowType: string; // server-side unique workflow identifier - now required
  workflowId?: string; // optional - provided by backend when subscribing
  agent?: string; // server expects this
  title?: string;
  description?: string;
}

// High-level connection state snapshot
export interface ConnectionState {
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  lastError?: string;
  lastActivity?: Date;
  lastConnectAttempt?: Date;
}

// Raw message coming from SignalR (subset)
export interface Message {
  text: string | null;
  direction: 'Incoming' | 'Outgoing' | number | string;
  messageType?: 'Chat' | 'Data' | 'Handoff';
  createdAt: Date;
  workflowId: string;
  threadId: string;
  participantId: string;
  data?: any;
}

// Convenience processed chat message – mirrors the original MessageProcessor output
export interface ChatMessage {
  id: string;
  text: string;
  direction: 'Incoming' | 'Outgoing';
  messageType: 'Chat' | 'Data' | 'Handoff';
  timestamp: Date;
  threadId: string;
  data?: any;
  isHistorical?: boolean;
} 