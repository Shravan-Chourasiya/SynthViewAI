import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { LobbyPage } from '@/pages/interviews/lobby';
import { usePreferencesStore } from '@/lib/stores/preferences.store';
import type { Interview } from '@/lib/types';

const mockGetInterview = vi.fn();

// The lobby used to build a throwaway socket to "prove" connectivity before
// letting the candidate in. Asserting this factory is never called is the
// regression test for that row's removal: the page having loaded is proof enough.
const { mockCreateInterviewSocket } = vi.hoisted(() => ({
  mockCreateInterviewSocket: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: { getInterview: (id: string) => mockGetInterview(id) },
}));

vi.mock('@/lib/socket/interview-socket', () => ({
  createInterviewSocket: mockCreateInterviewSocket,
}));

const interview: Interview = {
  id: 'interview-123',
  userId: 'user-1',
  status: 'CREATED',
  createdAt: new Date().toISOString(),
  lastActivityAt: new Date().toISOString(),
  progress: 0,
  score: null,
  currentRound: 1,
  currentQuestion: 0,
  domain: 'Frontend',
  roleTitle: 'Frontend Engineer',
  experienceLevel: 'Mid-level',
  difficulty: 'Adaptive',
  type: 'Mixed',
  durationMin: 30,
  rounds: 1,
  topics: ['React'],
  interviewStyle: 'REGULAR',
  endingCriteria: 'DURATION',
};

const videoTrack = { stop: vi.fn(), enabled: true, label: 'FaceTime HD Camera' };
const audioTrack = { stop: vi.fn(), enabled: true, label: 'Built-in Microphone' };

const cameraStream = {
  getTracks: () => [videoTrack],
  getVideoTracks: () => [videoTrack],
  getAudioTracks: () => [] as unknown[],
};
const micStream = {
  getTracks: () => [audioTrack],
  getVideoTracks: () => [] as unknown[],
  getAudioTracks: () => [audioTrack],
};

/** Minimal PermissionStatus: the lobby only adds/removes a `change` listener. */
class FakePermissionStatus {
  state = 'prompt';
  private listeners = new Set<() => void>();
  addEventListener = (_type: string, listener: () => void) => {
    this.listeners.add(listener);
  };
  removeEventListener = (_type: string, listener: () => void) => {
    this.listeners.delete(listener);
  };
  /** Fire a real permission change (denied → granted, or the reverse). */
  emitChange = () => this.listeners.forEach((listener) => listener());
}

let permissionStatus: FakePermissionStatus;
let getUserMediaCall = 0;

const mediaDevicesMock = () =>
  navigator.mediaDevices as unknown as {
    getUserMedia: ReturnType<typeof vi.fn>;
    enumerateDevices: ReturnType<typeof vi.fn>;
  };

/** Point getUserMedia at live devices, or at a permission denial. */
const installGetUserMedia = ({ denied = false }: { denied?: boolean } = {}) => {
  getUserMediaCall = 0;
  mediaDevicesMock().getUserMedia = vi.fn(() => {
    getUserMediaCall += 1;
    if (denied) return Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
    // First call is the camera, second the microphone.
    return Promise.resolve(getUserMediaCall === 1 ? cameraStream : micStream);
  });
};

const renderLobby = () =>
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/interviews/interview-123/lobby']}>
        <Routes>
          <Route path="/interviews/:id/lobby" element={<LobbyPage />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );

describe('interview lobby permission prompts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    usePreferencesStore.getState().reset();
    mockGetInterview.mockResolvedValue(interview);

    // jsdom implements neither MediaStream nor device capture, so provide the
    // smallest surface the lobby actually uses.
    vi.stubGlobal(
      'MediaStream',
      class {
        constructor(public readonly tracks: unknown[]) {}
        getTracks() {
          return this.tracks;
        }
      },
    );

    // The shared setup already defines `navigator.mediaDevices` on a
    // non-configurable descriptor, so replace the individual mocks rather than
    // redefining the whole object.
    installGetUserMedia();
    mediaDevicesMock().enumerateDevices = vi.fn().mockResolvedValue([]);

    // jsdom has no Permissions API; the lobby subscribes to it when present.
    permissionStatus = new FakePermissionStatus();
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      writable: true,
      value: { query: () => Promise.resolve(permissionStatus) },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'permissions');
  });

  it('requests camera and microphone on every lobby visit', async () => {
    renderLobby();

    await waitFor(() =>
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(2),
    );

    const calls = vi.mocked(navigator.mediaDevices.getUserMedia).mock.calls;
    expect(calls[0][0]).toEqual({ video: true });
    expect(calls[1][0]).toEqual({ audio: true });
    expect(await screen.findByText(/^Camera$/)).toBeInTheDocument();
  });

  it('checks only the camera and the microphone', async () => {
    renderLobby();

    expect(await screen.findByText(/^Camera$/)).toBeInTheDocument();
    expect(screen.getByText(/^Microphone$/)).toBeInTheDocument();
    // Both removed rows must stay removed.
    expect(screen.queryByText(/real-time connection/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/screen sharing/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /grant access/i })).not.toBeInTheDocument();
  });

  it('never opens a socket just to prove connectivity', async () => {
    renderLobby();

    await waitFor(() => expect(screen.getAllByText('Ready').length).toBe(2));
    expect(mockCreateInterviewSocket).not.toHaveBeenCalled();
  });

  it('gates Start on the media checks settling, not on a connection probe', async () => {
    renderLobby();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /start interview/i })).toBeEnabled(),
    );
    expect(mockCreateInterviewSocket).not.toHaveBeenCalled();
  });

  it('re-reads a blocked device when the permission changes', async () => {
    installGetUserMedia({ denied: true });
    renderLobby();

    // The stale state the candidate complained about: denied at one instant,
    // granted a moment later by a second prompt or in browser site settings.
    await waitFor(() => expect(screen.getAllByText('Blocked').length).toBe(2));

    installGetUserMedia();
    await act(async () => {
      permissionStatus.emitChange();
    });

    await waitFor(() => expect(screen.getAllByText('Ready').length).toBe(2));
    expect(screen.queryByText('Blocked')).not.toBeInTheDocument();
  });

  it('offers text mode only when a device is actually denied', async () => {
    renderLobby();
    await waitFor(() => expect(screen.getAllByText('Ready').length).toBe(2));
    expect(screen.queryByText(/you can continue in text mode/i)).not.toBeInTheDocument();
  });

  it('offers text mode after a real denial', async () => {
    installGetUserMedia({ denied: true });
    renderLobby();

    expect(await screen.findByText(/you can continue in text mode/i)).toBeInTheDocument();
  });
});
