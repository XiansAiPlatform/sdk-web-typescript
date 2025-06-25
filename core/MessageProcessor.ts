import type { Message, ChatMessage } from './types';
import { MetadataMessageRouter } from './MetadataMessageRouter';

export interface ProcessedChatMessage extends ChatMessage {
  workflowId: string;
}

export interface MessageProcessorEvents {
  onChatMessage: (workflowId: string, message: ProcessedChatMessage) => void;
  onThreadUpdate: (workflowId: string, threadId: string) => void;
  onError: (workflowId: string, error: any) => void;
}

export class MessageProcessor {
  private histories = new Map<string, Message[]>();
  constructor(private events: MessageProcessorEvents, private metadataRouter: MetadataMessageRouter) {}

  processMessage(workflowId: string, msg: Message, isHistorical = false) {
    if (!this.histories.has(workflowId)) this.histories.set(workflowId, []);
    this.histories.get(workflowId)!.push(msg);

    // Ensure timestamp is always a Date object
    let timestamp: Date;
    try {
      timestamp = msg.createdAt instanceof Date ? msg.createdAt : new Date(msg.createdAt || Date.now());
    } catch (error) {
      console.warn('[MessageProcessor] Invalid timestamp, using current time:', msg.createdAt);
      timestamp = new Date();
    }

    const processed: ProcessedChatMessage = {
      id: crypto.randomUUID(),
      text: msg.text || '',
      direction: this.mapDirection(msg.direction),
      messageType: msg.messageType || this.guessType(msg),
      timestamp,
      threadId: msg.threadId,
      data: msg.data,
      isHistorical,
      workflowId
    };
    this.events.onChatMessage(workflowId, processed);
  }

  processMetadata(message: any) {
    let finalType = message?.messageType || message?.data?.messageType || message?.metadata?.messageType;
    // If the top-level type is generic 'Data' but nested type is more specific, prefer nested
    if (message?.messageType === 'Data' && message?.data?.messageType) {
      finalType = message.data.messageType;
    }
    let payload = message;
    if (message?.data?.messageType) {
      payload = { ...message.data };
    }
    let detectedType = finalType;
    if (!detectedType) {
      if (message?.auditResult) {
        detectedType = 'DocumentResponse';
      } else if (typeof message?.summary === 'string') {
        detectedType = 'ActivityLog';
      }
    }
    payload.messageType = detectedType || 'UNKNOWN';
    console.log('[MessageProcessor] (SDK) raw metadata received', message);
    this.metadataRouter.routeMessage(payload);
  }

  processThreadUpdate(threadId: string, workflowId: string) {
    this.events.onThreadUpdate(workflowId, threadId);
  }

  guessType(msg: Message): 'Chat' | 'Data' | 'Handoff' {
    if (msg.messageType) return msg.messageType;
    if (msg.data) return 'Data';
    return 'Chat';
  }
  mapDirection(d: any): 'Incoming' | 'Outgoing' {
    if (typeof d === 'number') return d === 0 ? 'Incoming' : 'Outgoing';
    if (typeof d === 'string') return d.toLowerCase() === 'incoming' ? 'Incoming' : 'Outgoing';
    return 'Outgoing';
  }

  getChatHistory(workflowId: string): Message[] { return this.histories.get(workflowId) || []; }
  clearChatHistory(workflowId: string) { this.histories.delete(workflowId); }

  /**
   * Handle a batch of historical messages sent by the server when we first
   * subscribe to a workflow (ThreadHistory event). They arrive oldest→newest.
   * Reverse them so newest messages appear at bottom of chat.
   */
  processThreadHistory(history: Message[], workflowId: string) {
    if (!history || history.length === 0) return;
    // Reverse to show newest messages at bottom
    history.reverse().forEach(m => this.processMessage(workflowId, m, true));
  }
} 