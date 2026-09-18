import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type {
  Difficulty,
  EndingCriteria,
  ExperienceLevel,
  InterviewStyle,
  InterviewType,
} from '../types'

// Candidate-saved defaults that are re-applied every time the New Interview
// wizard is opened, so the repetitive configuration steps do not have to be
// re-entered for every interview.
//
// Deliberately NOT stored here: roleTitle, domain and target company. Those are
// the per-interview inputs that make each session different, so pre-filling them
// would work against the user rather than save them time.
export type InterviewDefaults = {
  type: InterviewType
  difficulty: Difficulty
  experienceLevel: ExperienceLevel
  interviewStyle: InterviewStyle
  durationMin: number
  endingCriteria: EndingCriteria
  questionCount: number
  topics: string[]
}

// Media preferences applied by the interview lobby. The lobby is the only place
// that requests camera/microphone/screen access (see pages/interviews/lobby.tsx),
// so anything configured here takes effect from the next lobby visit onward.
export type MediaPreferences = {
  /** Saved via Settings; passed to getUserMedia as an `ideal` deviceId hint. */
  preferredCameraDeviceId: string | null
  /** Saved via Settings; passed to getUserMedia as an `ideal` deviceId hint. */
  preferredMicDeviceId: string | null
  /**
   * Whether the lobby should prompt for screen-sharing access before every
   * interview. Browsers never persist screen-share grants and require a user
   * gesture, so this controls whether the lobby surfaces that prompt.
   */
  requestScreenShareInLobby: boolean
}

export const DEFAULT_INTERVIEW_DEFAULTS: InterviewDefaults = {
  type: 'Mixed',
  difficulty: 'Adaptive',
  experienceLevel: 'Entry',
  interviewStyle: 'REGULAR',
  durationMin: 30,
  endingCriteria: 'DURATION',
  questionCount: 5,
  topics: [],
}

export const DEFAULT_MEDIA_PREFERENCES: MediaPreferences = {
  preferredCameraDeviceId: null,
  preferredMicDeviceId: null,
  requestScreenShareInLobby: true,
}

type PreferencesState = {
  interviewDefaults: InterviewDefaults
  media: MediaPreferences
  /**
   * Stored-only preference. Adaptive follow-ups are currently driven by
   * `difficulty: 'Adaptive'` (which the create service maps to the backend's
   * `isAdaptive` flag), and the backend caps follow-up depth with its own
   * fixed `maxFollowUps` default, so this flag does not alter requests yet.
   */
  preferAdaptiveFollowUps: boolean
  setInterviewDefaults: (patch: Partial<InterviewDefaults>) => void
  setMediaPreferences: (patch: Partial<MediaPreferences>) => void
  setPreferAdaptiveFollowUps: (value: boolean) => void
  reset: () => void
}

const initialState = {
  interviewDefaults: DEFAULT_INTERVIEW_DEFAULTS,
  media: DEFAULT_MEDIA_PREFERENCES,
  preferAdaptiveFollowUps: true,
}

// Persisted so preferences survive reloads and new sessions. Kept client-side
// on purpose: the backend profile schema only accepts firstName/lastName, so
// there is no server field to sync these to yet.
export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      ...initialState,
      setInterviewDefaults: (patch) =>
        set((state) => ({ interviewDefaults: { ...state.interviewDefaults, ...patch } })),
      setMediaPreferences: (patch) =>
        set((state) => ({ media: { ...state.media, ...patch } })),
      setPreferAdaptiveFollowUps: (preferAdaptiveFollowUps) => set({ preferAdaptiveFollowUps }),
      reset: () => set({ ...initialState }),
    }),
    {
      name: 'syntheview.preferences',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Only persist data, never the action functions.
      partialize: (state) => ({
        interviewDefaults: state.interviewDefaults,
        media: state.media,
        preferAdaptiveFollowUps: state.preferAdaptiveFollowUps,
      }),
    },
  ),
)