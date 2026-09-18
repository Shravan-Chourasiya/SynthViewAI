import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { LobbyPage } from '@/pages/interviews/lobby';
import { usePreferencesStore } from '@/lib/stores/preferences.store';
import type { Interview } from '@/lib/types';

const mockGetInterview = vi.fn();

vi.mock('@/lib/api', () => ({
  api: { getInterview: (id: string) => mockGetInterview(id) },
}));

// Minimal stand-in for the Socket.IO client used by the lobby's connectivity
// preflight: `connect()` immediately reports a successful connection.
vi.mock('@/lib/socket/interview-socket', () => ({
  createInterviewSocket: () => {
    const handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
    return {
      io: { opts: {} as { reconnection?: boolean } },
      once: (event: string, cb: (...args: unknown[]) => void) => {
        handlers[event] = [cb];
      },
      off: () => {},
      disconnect: vi.fn(),
      connect: () => handlers.connect?.forEach((cb) => cb()),
    };
  },
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
const screenTrack = { stop: vi.fn(), enabled: true, label: 'Entire Screen' };

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
const displayStream = {
  getTracks: () => [screenTrack],
  getVideoTracks: () => [screenTrack],
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

    let getUserMediaCall = 0;
    // The shared setup already defines `navigator.mediaDevices` on a
    // non-configurable descriptor, so replace the individual mocks rather than
    // redefining the whole object.
    const mediaDevices = navigator.mediaDevices as unknown as {
      getUserMedia: ReturnType<typeof vi.fn>;
      getDisplayMedia: ReturnType<typeof vi.fn>;
      enumerateDevices: ReturnType<typeof vi.fn>;
    };
    mediaDevices.getUserMedia = vi.fn(() => {
      getUserMediaCall += 1;
      // First call is the camera, second the microphone.
      return Promise.resolve(getUserMediaCall === 1 ? cameraStream : micStream);
    });
    mediaDevices.getDisplayMedia = vi.fn().mockResolvedValue(displayStream);
    mediaDevices.enumerateDevices = vi.fn().mockResolvedValue([]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

  it('asks for screen sharing instead of only reporting it as supported', async () => {
    renderLobby();

    // The regression this covers: the lobby used to render a static
    // "Supported — permission is requested only when you share" label and
    // never offered a way to grant screen access before entering.
    const grantButtons = await screen.findAllByRole('button', { name: /grant access/i });
    expect(grantButtons.length).toBeGreaterThan(0);
    expect(screen.queryByText(/requested only when you share/i)).not.toBeInTheDocument();
    expect(navigator.mediaDevices.getDisplayMedia).not.toHaveBeenCalled();
  });

  it('grants screen access when the candidate clicks the prompt', async () => {
    renderLobby();

    const [grantButton] = await screen.findAllByRole('button', { name: /grant access/i });
    fireEvent.click(grantButton);

    await waitFor(() =>
      expect(navigator.mediaDevices.getDisplayMedia).toHaveBeenCalledWith({ video: true }),
    );

    // The probe is released immediately so the OS sharing indicator does not
    // stay on while the candidate is still reading the lobby.
    await waitFor(() => expect(screen.getByText(/access granted for/i)).toBeInTheDocument());
    expect(screen.getByText(/Entire Screen/)).toBeInTheDocument();
    expect(screenTrack.stop).toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryAllByRole('button', { name: /grant access/i })).toHaveLength(0),
    );
  });

  it('reports a cancelled screen picker without blocking entry', async () => {
    vi.mocked(navigator.mediaDevices.getDisplayMedia).mockRejectedValueOnce(
      new DOMException('Permission denied', 'NotAllowedError'),
    );
    renderLobby();

    const [grantButton] = await screen.findAllByRole('button', { name: /grant access/i });
    fireEvent.click(grantButton);

    await waitFor(() =>
      expect(screen.getByText(/screen sharing permission was denied/i)).toBeInTheDocument(),
    );
    // Connectivity is still the only hard requirement for entering.
    expect(screen.getByRole('button', { name: /start interview/i })).toBeEnabled();
  });

  it('honours the saved preference that turns the lobby screen prompt off', async () => {
    usePreferencesStore.getState().setMediaPreferences({ requestScreenShareInLobby: false });
    renderLobby();

    await waitFor(() =>
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(2),
    );
    expect(await screen.findByText(/lobby prompt is off/i)).toBeInTheDocument();
    expect(screen.queryAllByRole('button', { name: /grant access/i })).toHaveLength(0);
  });
});