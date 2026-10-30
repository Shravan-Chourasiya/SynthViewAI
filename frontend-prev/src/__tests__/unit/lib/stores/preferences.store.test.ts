import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_INTERVIEW_DEFAULTS,
  DEFAULT_MEDIA_PREFERENCES,
  usePreferencesStore,
} from '@/lib/stores/preferences.store';

const STORAGE_KEY = 'syntheview.preferences';

describe('preferences store', () => {
  beforeEach(() => {
    localStorage.clear();
    usePreferencesStore.getState().reset();
  });

  it('starts from the same values the New Interview wizard defaults to', () => {
    const { interviewDefaults } = usePreferencesStore.getState();
    // Guards the contract that a fresh install behaves exactly like the wizard
    // did before saved defaults existed.
    expect(interviewDefaults).toEqual(DEFAULT_INTERVIEW_DEFAULTS);
    expect(interviewDefaults.type).toBe('Mixed');
    expect(interviewDefaults.difficulty).toBe('Adaptive');
    expect(interviewDefaults.experienceLevel).toBe('Entry');
    expect(interviewDefaults.interviewStyle).toBe('REGULAR');
    expect(interviewDefaults.durationMin).toBe(30);
    expect(interviewDefaults.endingCriteria).toBe('DURATION');
    expect(interviewDefaults.questionCount).toBe(5);
    expect(interviewDefaults.topics).toEqual([]);
  });

  it('defaults to prompting for screen sharing in the lobby', () => {
    expect(usePreferencesStore.getState().media).toEqual(DEFAULT_MEDIA_PREFERENCES);
    expect(usePreferencesStore.getState().media.requestScreenShareInLobby).toBe(true);
  });

  it('merges partial interview default patches without dropping other fields', () => {
    usePreferencesStore.getState().setInterviewDefaults({ durationMin: 45, topics: ['React'] });
    const { interviewDefaults } = usePreferencesStore.getState();
    expect(interviewDefaults.durationMin).toBe(45);
    expect(interviewDefaults.topics).toEqual(['React']);
    expect(interviewDefaults.difficulty).toBe('Adaptive');
  });

  it('merges partial media preference patches without dropping device choices', () => {
    usePreferencesStore.getState().setMediaPreferences({ preferredCameraDeviceId: 'cam-1' });
    usePreferencesStore.getState().setMediaPreferences({ requestScreenShareInLobby: false });
    const { media } = usePreferencesStore.getState();
    expect(media.preferredCameraDeviceId).toBe('cam-1');
    expect(media.requestScreenShareInLobby).toBe(false);
    expect(media.preferredMicDeviceId).toBeNull();
  });

  it('persists to localStorage so preferences survive a reload', () => {
    usePreferencesStore.getState().setInterviewDefaults({ type: 'Technical', durationMin: 60 });
    usePreferencesStore.getState().setMediaPreferences({ preferredMicDeviceId: 'mic-9' });

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    const persisted = JSON.parse(raw as string);
    expect(persisted.state.interviewDefaults.type).toBe('Technical');
    expect(persisted.state.interviewDefaults.durationMin).toBe(60);
    expect(persisted.state.media.preferredMicDeviceId).toBe('mic-9');
  });

  it('never persists the action functions', () => {
    usePreferencesStore.getState().setInterviewDefaults({ durationMin: 15 });
    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) as string);
    expect(persisted.state.setInterviewDefaults).toBeUndefined();
    expect(persisted.state.reset).toBeUndefined();
  });

  it('rehydrates saved preferences from localStorage', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        state: {
          interviewDefaults: { ...DEFAULT_INTERVIEW_DEFAULTS, type: 'Behavioral', questionCount: 12 },
          media: { ...DEFAULT_MEDIA_PREFERENCES, preferredCameraDeviceId: 'cam-7' },
          preferAdaptiveFollowUps: false,
        },
      }),
    );

    await usePreferencesStore.persist.rehydrate();

    const state = usePreferencesStore.getState();
    expect(state.interviewDefaults.type).toBe('Behavioral');
    expect(state.interviewDefaults.questionCount).toBe(12);
    expect(state.media.preferredCameraDeviceId).toBe('cam-7');
    expect(state.preferAdaptiveFollowUps).toBe(false);
  });

  it('restores every default on reset', () => {
    const store = usePreferencesStore.getState();
    store.setInterviewDefaults({ type: 'Technical', durationMin: 60, topics: ['SQL'] });
    store.setMediaPreferences({ requestScreenShareInLobby: false, preferredMicDeviceId: 'mic-1' });
    store.setPreferAdaptiveFollowUps(false);

    usePreferencesStore.getState().reset();

    const state = usePreferencesStore.getState();
    expect(state.interviewDefaults).toEqual(DEFAULT_INTERVIEW_DEFAULTS);
    expect(state.media).toEqual(DEFAULT_MEDIA_PREFERENCES);
    expect(state.preferAdaptiveFollowUps).toBe(true);
  });
});
