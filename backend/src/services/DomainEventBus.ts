import { EventEmitter } from 'events';

export interface DomainEvent<T = any> {
  eventId: string;
  eventType: string;
  organizationId: string;
  actorId?: string;
  timestamp: Date;
  payload: T;
}

class DomainEventBus extends EventEmitter {
  public publish<T>(eventType: string, organizationId: string, payload: T, actorId?: string): DomainEvent<T> {
    const event: DomainEvent<T> = {
      eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      eventType,
      organizationId,
      actorId,
      timestamp: new Date(),
      payload,
    };

    // Emit event asynchronously
    this.emit(eventType, event);
    this.emit('*', event);

    return event;
  }
}

export const eventBus = new DomainEventBus();
