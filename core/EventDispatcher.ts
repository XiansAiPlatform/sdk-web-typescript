export type EventCallback<T = any> = (data: T) => void;

export interface EventSubscription {
  unsubscribe: () => void;
}

/**
 * Lightweight typed event dispatcher, copied from original middleware but kept
 * UI-agnostic for npm packaging.
 */
export class EventDispatcher<T extends Record<string, any>> {
  private listeners: Map<keyof T, Set<EventCallback>> = new Map();

  on<K extends keyof T>(event: K, callback: EventCallback<T[K]>): EventSubscription {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const set = this.listeners.get(event)!;
    set.add(callback);
    return { unsubscribe: () => this.off(event, callback) };
  }

  off<K extends keyof T>(event: K, callback: EventCallback<T[K]>): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback);
      if (set.size === 0) this.listeners.delete(event);
    }
  }

  emit<K extends keyof T>(event: K, data: T[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    [...set].forEach(cb => {
      try {
        cb(data);
      } catch (e) {
        console.error(`[EventDispatcher] Listener error for ${String(event)}`, e);
      }
    });
  }

  listenerCount<K extends keyof T>(event: K): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  getStats() {
    const stats: Record<string, number> = {};
    let total = 0;
    for (const [evt, set] of this.listeners) {
      stats[String(evt)] = set.size;
      total += set.size;
    }
    return { totalEvents: this.listeners.size, totalListeners: total, eventStats: stats };
  }
} 