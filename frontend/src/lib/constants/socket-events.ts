// Every Socket.IO event name used by the frontend.
// Nothing in the codebase may type a raw event-name string outside this file.

export const EVENT_VERSION = 1 as const;

export const SOCKET_EVENTS = {
  /** Events emitted by the client → server */
  client: {
    join: "interview:join",
    leave: "interview:leave",
    heartbeatAck: "heartbeat:ack",
    answerSubmit: "answer:submit",
    codeSubmit: "code:submit",
    nextQuestion: "question:next",
    cancel: "interview:cancel",
    end: "interview:end",
  },
  /** Events emitted by the server → client */
  server: {
    joined: "interview:joined",
    left: "interview:left",
    answerAccepted: "answer:accepted",
    stateChange: "interview:state_change",
    questionDelivered: "question:delivered",
    aiStatus: "ai:status",
    evaluationFeedback: "evaluation:feedback",
    timerExpired: "timer:expired",
    heartbeatPing: "heartbeat:ping",
    error: "ws:error",
  },
} as const;
