import { create } from "zustand";
import * as interviewService from "../services/interview.service";
import type { Interview, InterviewConfig } from "../types";
import { normalizeInterview } from "../normalizers/interview";

const CACHE_TTL_MS = 30_000;

type InterviewListState = {
  interviews: Interview[];
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  fetchedAt: number | null;
  fetchInterviews: (options?: { force?: boolean }) => Promise<Interview[]>;
  createInterview: (config: InterviewConfig) => Promise<string>;
  cancelInterview: (id: string) => Promise<void>;
  reset: () => void;
};

let inFlight: Promise<Interview[]> | null = null;
/** Bumped by `reset()` so a request that started before the reset cannot write
 * its (now stale) result into the fresh state. */
let generation = 0;

export const useInterviewListStore = create<InterviewListState>((set, get) => ({
  interviews: [],
  status: "idle",
  error: null,
  fetchedAt: null,

  async fetchInterviews({ force = false } = {}) {
    const current = get();
    if (
      !force &&
      current.status === "ready" &&
      current.fetchedAt &&
      Date.now() - current.fetchedAt < CACHE_TTL_MS
    ) {
      return current.interviews;
    }
    // Share one request between concurrent mounts.
    if (inFlight) return inFlight;

    const requestGeneration = generation;
    set({ status: "loading", error: null });

    const request = interviewService
      .listInterviews()
      .then((response) => response.map(normalizeInterview))
      .then((interviews) => {
        // Ignore a result that belongs to a state we already reset away from.
        if (requestGeneration !== generation) return interviews;
        set({
          interviews,
          status: "ready",
          error: null,
          fetchedAt: Date.now(),
        });
        return interviews;
      })
      .catch((error: unknown) => {
        // Without this the store stayed in `loading` forever, so a failed fetch
        // rendered the skeleton permanently instead of the error message.
        if (requestGeneration === generation) {
          set({
            status: "error",
            error: error instanceof Error ? error.message : "Failed to load interviews",
            fetchedAt: null,
          });
        }
        throw error;
      })
      .finally(() => {
        // Only clear our own request: a request that never settles must not pin
        // `inFlight` forever, or every later fetch would await a dead promise.
        if (inFlight === request) inFlight = null;
      });

    inFlight = request;
    return request;
  },

  async createInterview(config) {
    const response = await interviewService.createInterview(config);
    await get().fetchInterviews({ force: true });
    return response.id ?? response.interviewId ?? "";
  },

  async cancelInterview(id) {
    const previous = get().interviews;
    set({
      interviews: previous.map((interview) =>
        interview.id === id ? { ...interview, status: "CANCELLED" } : interview,
      ),
    });
    try {
      await interviewService.cancelInterview(id);
      await get().fetchInterviews({ force: true });
    } catch (error) {
      set({ interviews: previous });
      throw error;
    }
  },

  reset() {
    // Invalidate anything already in flight so it can't repopulate fresh state.
    generation += 1;
    inFlight = null;
    set({ interviews: [], status: "idle", error: null, fetchedAt: null });
  },
}));
