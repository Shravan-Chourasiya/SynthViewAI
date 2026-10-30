import { io, type Socket } from "socket.io-client";
import { env } from "../env";

/**
 * The one place a socket to the interview gateway is built. Tests mock this
 * module rather than socket.io-client, so the hook must never call `io()`
 * directly.
 */
export function createInterviewSocket(): Socket {
  return io(env.socketUrl, {
    path: env.socketPath,
    withCredentials: true,
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 8,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
  });
}
