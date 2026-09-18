import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { SettingsPage } from '@/pages/settings';
import { usePreferencesStore } from '@/lib/stores/preferences.store';

vi.mock('@/lib/api', () => ({
  api: { changePassword: vi.fn(), deleteAccount: vi.fn(), updateProfile: vi.fn() },
}));

// The settings page and the shell around it only read `user` and `logout` from
// the auth store, so a selector-driven stub is enough here.
vi.mock('@/lib/stores/auth.store', () => {
  const user = {
    id: 'user-1',
    email: 'candidate@example.com',
    username: 'candidate',
    firstName: 'Casey',
    lastName: 'Candidate',
    userrole: 'user',
    accountStatus: 'active',
    createdAt: '2024-01-01T00:00:00.000Z',
  };
  return {
    useAuthStore: (selector: (state: Record<string, unknown>) => unknown) =>
      selector({
        user,
        status: 'authenticated',
        pendingEmail: null,
        error: null,
        logout: vi.fn(),
        bootstrap: vi.fn(),
        login: vi.fn(),
        register: vi.fn(),
        verifyOtp: vi.fn(),
      }),
  };
});

const renderSettings = () =>
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/settings']}>
        <SettingsPage />
      </MemoryRouter>
    </ThemeProvider>,
  );

describe('settings interview preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    usePreferencesStore.getState().reset();

    const mediaDevices = navigator.mediaDevices as unknown as {
      enumerateDevices: ReturnType<typeof vi.fn>;
    };
    mediaDevices.enumerateDevices = vi.fn().mockResolvedValue([
      { kind: 'videoinput', deviceId: 'cam-1', label: 'Integrated Webcam' },
      { kind: 'videoinput', deviceId: 'cam-2', label: 'USB Camera' },
      { kind: 'audioinput', deviceId: 'mic-1', label: 'Internal Mic' },
    ]);
  });

  it('renders exactly one camera and one microphone picker', async () => {
    renderSettings();

    // Regression: the device block was previously rendered twice, so every
    // device field appeared twice on the page.
    const selects = await screen.findAllByRole('combobox');
    const cameraSelects = selects.filter((select) => (select as HTMLSelectElement).id === 'preferredCamera');
    const micSelects = selects.filter((select) => (select as HTMLSelectElement).id === 'preferredMic');
    expect(cameraSelects).toHaveLength(1);
    expect(micSelects).toHaveLength(1);
  });

  it('lists the enumerated devices in the pickers', async () => {
    renderSettings();

    expect(await screen.findByRole('option', { name: 'USB Camera' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Internal Mic' })).toBeInTheDocument();
    expect(screen.getAllByRole('option', { name: 'Auto-select' })).toHaveLength(2);
  });

  it('saves device choices, the screen-share prompt and interview defaults', async () => {
    renderSettings();

    fireEvent.change(await screen.findByLabelText('Default camera'), { target: { value: 'cam-2' } });
    fireEvent.change(screen.getByLabelText('Default microphone'), { target: { value: 'mic-1' } });
    fireEvent.change(screen.getByLabelText('Default interview type'), { target: { value: 'Technical' } });
    fireEvent.change(screen.getByLabelText('Default duration'), { target: { value: '45' } });
    fireEvent.change(screen.getByLabelText('Default topics'), { target: { value: 'React, SQL' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /prompt me to confirm screen sharing/i }));

    fireEvent.click(screen.getByRole('button', { name: /save preferences/i }));

    await waitFor(() => expect(screen.getByText(/preferences saved/i)).toBeInTheDocument());

    const state = usePreferencesStore.getState();
    expect(state.media.preferredCameraDeviceId).toBe('cam-2');
    expect(state.media.preferredMicDeviceId).toBe('mic-1');
    expect(state.media.requestScreenShareInLobby).toBe(false);
    expect(state.interviewDefaults.type).toBe('Technical');
    expect(state.interviewDefaults.durationMin).toBe(45);
    expect(state.interviewDefaults.topics).toEqual(['React', 'SQL']);
    // Unchanged fields must survive the partial save.
    expect(state.interviewDefaults.difficulty).toBe('Adaptive');
    expect(state.interviewDefaults.questionCount).toBe(5);
  });

  it('writes the saved preferences to localStorage so they survive a reload', async () => {
    renderSettings();

    fireEvent.change(await screen.findByLabelText('Default experience level'), { target: { value: 'Senior' } });
    fireEvent.click(screen.getByRole('button', { name: /save preferences/i }));

    await waitFor(() => {
      const raw = localStorage.getItem('syntheview.preferences');
      expect(raw).toBeTruthy();
      expect(JSON.parse(raw as string).state.interviewDefaults.experienceLevel).toBe('Senior');
    });
  });
});