import { io, type Socket } from "socket.io-client";
import { env } from "../env";

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
