export interface MetadataSubscriber {
  id: string;
  messageTypes: string[];
  callback: (message: any) => void;
}

/**
 * Routes backend *Data* messages (aka metadata) to subscribers based on the
 * declared `messageType` field inside the payload.
 */
export class MetadataMessageRouter {
  private subscribers: Map<string, MetadataSubscriber> = new Map();
  private messageTypeIndex: Map<string, Set<string>> = new Map();

  subscribe(sub: MetadataSubscriber): () => void {
    this.subscribers.set(sub.id, sub);
    sub.messageTypes.forEach(type => {
      if (!this.messageTypeIndex.has(type)) this.messageTypeIndex.set(type, new Set());
      this.messageTypeIndex.get(type)!.add(sub.id);
    });
    return () => this.unsubscribe(sub.id);
  }

  unsubscribe(id: string) {
    const sub = this.subscribers.get(id);
    if (!sub) return;
    sub.messageTypes.forEach(type => {
      const set = this.messageTypeIndex.get(type);
      if (set) {
        set.delete(id);
        if (set.size === 0) this.messageTypeIndex.delete(type);
      }
    });
    this.subscribers.delete(id);
  }

  routeMessage(message: any) {
    const type = message?.messageType;
    const ids = this.messageTypeIndex.get(type) || new Set<string>();
    ids.forEach(id => {
      const sub = this.subscribers.get(id);
      if (!sub) return;
      try {
        sub.callback(message);
      } catch (e) {
        console.error(`[MetadataMessageRouter] subscriber ${id} error`, e);
      }
    });
  }

  getStats() {
    const map: Record<string, number> = {};
    this.messageTypeIndex.forEach((set, type) => (map[type] = set.size));
    return {
      totalSubscribers: this.subscribers.size,
      messageTypes: [...this.messageTypeIndex.keys()],
      subscribersByType: map
    };
  }

  clear() {
    this.subscribers.clear();
    this.messageTypeIndex.clear();
  }
} 