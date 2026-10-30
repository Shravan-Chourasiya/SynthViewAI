import { EventEmitter } from 'events';

interface SocketOptions {
  forceNew?: boolean;
  transports?: string[];
  timeout?: number;
  reconnection?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
  // Add other options as needed
}

/** Anything the hook registers with `socket.on` / `off`. */
type Listener = (...args: unknown[]) => void;

export class FakeSocket extends EventEmitter {
  connected: boolean = false;
  disconnected: boolean = false;
  id: string | null = null;
  
  // Track emitted events for testing
  emittedEvents: Array<{event: string, data: unknown}> = [];
  /** Payloads grouped by event name — lets a test read what the hook sent. */
  emitted: Record<string, unknown[]> = {};
  
  // Store event handlers
  eventHandlers: Record<string, Listener[]> = {};
  
  // IO manager properties
  io: {
    opts: SocketOptions & { reconnection: boolean };
    on: (event: string, fn: Listener) => void;
    off: (event: string, fn?: Listener) => void;
    removeAllListeners: (event?: string) => void;
    listeners: (event: string) => Listener[];
  };
  
  constructor(private url?: string, private options?: SocketOptions) {
    super();
    
    // Initialize with default options
    this.io = {
      opts: {
        ...options,
        reconnection: options?.reconnection ?? true,
      },
      on: (event: string, fn: Listener) => {
        this.on(`io:${event}`, fn);
      },
      off: (event: string, fn?: Listener) => {
        if (fn) {
          this.off(`io:${event}`, fn);
        } else {
          this.removeAllListeners(`io:${event}`);
        }
      },
      removeAllListeners: (event?: string) => {
        if (event) {
          this.removeAllListeners(`io:${event}`);
        } else {
            const ioEvents = Object.keys(this.eventNames()).filter(name => typeof name === 'string' && name.startsWith('io:'));
            ioEvents.forEach(ioEvent => this.removeAllListeners(ioEvent));
        }
      },
      listeners: (event: string) => {
        return this.listeners(`io:${event}`) as unknown as Listener[];
      }
    };
  }

  connect(): this {
    this.connected = true;
    this.disconnected = false;
    setImmediate(() => {
      this.emit('connect');
    });
    return this;
  }

  disconnect(close?: boolean): this {
    this.connected = false;
    this.disconnected = true;
    this.emit('disconnect', close ? 'io client disconnect' : undefined);
    return this;
  }  emit(event: string, ...args: unknown[]): boolean {
    // Track emitted events for testing
    if (args.length > 0) {
      this.emittedEvents.push({ event, data: args[0] });
      this.emitted[event] = [...(this.emitted[event] ?? []), args[0]];
    }

    return super.emit(event, ...args);
  }

  /** Emit on the manager (io) channel, e.g. `reconnect_attempt`. */
  ioEmit(event: string, ...args: unknown[]): boolean {
    return super.emit(`io:${event}`, ...args);
  }


  send(...args: unknown[]): this {
    this.emit('message', ...args);
    return this;
  }

  // Method to simulate server sending an event to client
  simulateServerEvent(event: string, data: unknown) {
    setImmediate(() => {
      this.emit(event, data);
    });
  }

  // Method to simulate connection
  simulateConnect() {
    this.connected = true;
    this.disconnected = false;
    this.id = `fake-socket-${Date.now()}`;
    this.emit('connect');
  }

  // Method to simulate disconnection
  simulateDisconnect() {
    this.connected = false;
    this.disconnected = true;
    this.emit('disconnect');
  }

  // Method to simulate reconnection
  simulateReconnect() {
    this.connected = true;
    this.disconnected = false;
    this.emit('connect');
    this.emit('io:reconnect');
  }

  // Method to simulate connection error
  simulateConnectError(error: Error) {
    this.emit('connect_error', error);
  }

  // Method to simulate reconnection attempt
  simulateReconnectAttempt() {
    this.emit('io:reconnect_attempt');
  }

  // Method to simulate reconnection failure
  simulateReconnectFailed() {
    this.emit('io:reconnect_failed');
  }

  // Method to clear emitted events
  clearEmittedEvents() {
    this.emittedEvents = [];
    this.emitted = {};
  }

  // Override on to track handlers
  on(event: string, fn: Listener): this {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(fn);
    super.on(event, fn);
    return this;
  }

  // Override off to remove from tracked handlers
  off(event: string, fn?: Listener): this {
    if (fn && this.eventHandlers[event]) {
      const index = this.eventHandlers[event].indexOf(fn);
      if (index !== -1) {
        this.eventHandlers[event].splice(index, 1);
      }
    } else if (!fn) {
      delete this.eventHandlers[event];
    }
    super.off(event, fn);
    return this;
  }

  // Override removeAllListeners to clear tracked handlers
  removeAllListeners(event?: string): this {
    if (event) {
      delete this.eventHandlers[event];
    } else {
      this.eventHandlers = {};
    }
    super.removeAllListeners(event);
    return this;
  }
}

export function createFakeSocket(url?: string, options?: SocketOptions): FakeSocket {
  return new FakeSocket(url, options);
}

export function createConnectedFakeSocket(url?: string, options?: SocketOptions): FakeSocket {
  const socket = createFakeSocket(url, options);
  socket.simulateConnect();
  return socket;
}

export function createDisconnectedFakeSocket(url?: string, options?: SocketOptions): FakeSocket {
  return createFakeSocket(url, options);
}