import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { NewInterviewPage } from '@/pages/interviews/new';
import { usePreferencesStore } from '@/lib/stores/preferences.store';

vi.mock('@/lib/api', () => ({ api: {} }));

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

const renderWizard = () =>
  render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/interviews/new']}>
        <NewInterviewPage />
      </MemoryRouter>
    </ThemeProvider>,
  );

const continueStep = () => fireEvent.click(screen.getByRole('button', { name: /continue/i }));

describe('New Interview wizard saved defaults', () => {
  beforeEach(() => {
    localStorage.clear();
    usePreferencesStore.getState().reset();
  });

  it('pre-fills every repeated field from the saved preferences', async () => {
    usePreferencesStore.getState().setInterviewDefaults({
      type: 'Technical',
      difficulty: 'Hard',
      experienceLevel: 'Senior',
      interviewStyle: 'FAANG',
      durationMin: 45,
      endingCriteria: 'QUESTION_COUNT',
      questionCount: 8,
      topics: ['React', 'System Design'],
    });

    renderWizard();

    // Step 0 stays deliberately empty: role and domain are per-interview input.
    expect(screen.getByLabelText(/field \/ domain/i)).toHaveValue('');
    expect(screen.getByLabelText(/target role/i)).toHaveValue('');
    fireEvent.change(screen.getByLabelText(/field \/ domain/i), { target: { value: 'Backend' } });
    fireEvent.change(screen.getByLabelText(/target role/i), { target: { value: 'Backend Engineer' } });
    continueStep();

    // Step 1 — interview type
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Technical/ })).toHaveAttribute('aria-pressed', 'true'),
    );
    expect(screen.getByRole('button', { name: /^Mixed/ })).toHaveAttribute('aria-pressed', 'false');
    continueStep();

    // Step 2 — interview style
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^FAANG/ })).toHaveAttribute('aria-pressed', 'true'),
    );
    continueStep();

    // Step 3 — difficulty + experience level
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Hard/ })).toHaveAttribute('aria-pressed', 'true'),
    );
    expect(screen.getByLabelText(/experience level/i)).toHaveValue('Senior');
    continueStep();

    // Step 4 — topics. The suggestion row also contains these words, so assert
    // on the selected chips (each has a Remove button) and the counter.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Remove System Design' })).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Remove React' })).toBeInTheDocument();
    expect(screen.getByText('2/10 skills added')).toBeInTheDocument();
    continueStep();

    // Step 5 — duration + ending criteria
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '45 min' })).toHaveAttribute('aria-pressed', 'true'),
    );
    expect(screen.getByRole('button', { name: /by question count/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText(/question count/i)).toHaveValue(8);
    continueStep();

    // Step 6 — the review reflects every saved default
    await waitFor(() => expect(screen.getByText('Hard · Senior')).toBeInTheDocument());
    expect(screen.getByText('Technical')).toBeInTheDocument();
    expect(screen.getByText('45 minutes')).toBeInTheDocument();
    expect(screen.getByText('8 questions (or duration limit)')).toBeInTheDocument();
    expect(screen.getByText('React, System Design')).toBeInTheDocument();
  });

  it('still starts from wizard defaults when nothing is saved', async () => {
    renderWizard();

    fireEvent.change(screen.getByLabelText(/field \/ domain/i), { target: { value: 'Frontend' } });
    fireEvent.change(screen.getByLabelText(/target role/i), { target: { value: 'Frontend Engineer' } });
    continueStep();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Mixed/ })).toHaveAttribute('aria-pressed', 'true'),
    );
    continueStep();
    continueStep();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Adaptive/ })).toHaveAttribute('aria-pressed', 'true'),
    );
    expect(screen.getByLabelText(/experience level/i)).toHaveValue('Entry');
  });
});