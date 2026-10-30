import { create } from 'zustand'
import type { LiveStatus } from '../types'

interface LiveState {
  interviewId: string | null
  startedAt: number | null
  elapsedSeconds: number
  status: LiveStatus
  transcript: string
  notes: string
  answers: Record<string, string>
  currentIndex: number
  connection: 'connected' | 'reconnecting' | 'offline'

  start: (interviewId: string) => void
  tick: () => void
  setStatus: (status: LiveStatus) => void
  appendTranscript: (text: string) => void
  clearTranscript: () => void
  setNote: (notes: string) => void
  setAnswer: (questionId: string, value: string) => void
  setCurrentIndex: (index: number) => void
  setConnection: (connection: LiveState['connection']) => void
  reset: () => void
}

export const useInterviewStore = create<LiveState>((set) => ({
  interviewId: null,
  startedAt: null,
  elapsedSeconds: 0,
  status: 'idle',
  transcript: '',
  notes: '',
  answers: {},
  currentIndex: 0,
  connection: 'connected',

  start: (interviewId) =>
    set({ interviewId, startedAt: Date.now(), elapsedSeconds: 0, status: 'listening' }),
  tick: () => set((s) => ({ elapsedSeconds: s.elapsedSeconds + 1 })),
  setStatus: (status) => set({ status }),
  appendTranscript: (text) => set((s) => ({ transcript: s.transcript + text })),
  clearTranscript: () => set({ transcript: '' }),
  setNote: (notes) => set({ notes }),
  setAnswer: (questionId, value) =>
    set((s) => ({ answers: { ...s.answers, [questionId]: value } })),
  setCurrentIndex: (currentIndex) => set({ currentIndex }),
  setConnection: (connection) => set({ connection }),
  reset: () =>
    set({
      interviewId: null,
      startedAt: null,
      elapsedSeconds: 0,
      status: 'idle',
      transcript: '',
      notes: '',
      answers: {},
      currentIndex: 0,
      connection: 'connected',
    }),
}))

export const useSessionElapsed = () => useInterviewStore((s) => s.elapsedSeconds)
