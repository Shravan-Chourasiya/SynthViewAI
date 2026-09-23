/**
 * UI-level flows driven through the real `App` router — not a page in isolation
 * — so the guards, lazy routes, providers and stores all participate.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import App from "@/App";
import * as authSvc from "@/lib/services/auth.service";
import { useAuthStore } from "@/lib/stores/auth.store";
import { makeMe, makeInterview, primeApi, apiMock } from "./support.js";

vi.mock("@/lib/api", async () => (await import("./support.js")).apiModuleMock());
vi.mock("@/lib/services/auth.service");
// The interview list store talks to `services/interview.service` directly
// (not through `@/lib/api`), so the dashboard's data source needs its own stub.
vi.mock("@/lib/services/interview.service", () => ({
  listInterviews: vi.fn().mockResolvedValue([]),
  // The sidebar's resumable badge (doc 07 Task A) also consumes the service.
  resumableInterviews: vi.fn().mockResolvedValue([]),
  getInterview: vi.fn(),
  createInterview: vi.fn(),
}));
vi.mock("@/lib/services/notification.service", () => ({
  notificationService: {
    getNotifications: vi.fn().mockResolvedValue({ items: [], page: 1, limit: 20, total: 0 }),
    markNotificationRead: vi.fn().mockResolvedValue(undefined),
    markAllNotificationsRead: vi.fn().mockResolvedValue(undefined),
  },
}));

function renderApp(route: string) {
  return render(
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe("app-level flows", () => {
  beforeEach(() => {
    primeApi();
    vi.clearAllMocks();
    useAuthStore.setState({ user: null, pendingEmail: null, status: "idle", error: null });
  });

  it("signs in and lands on the dashboard", async () => {
    // Visitors start logged out: bootstrap finds no session.
    vi.mocked(authSvc.me)
      .mockRejectedValueOnce(new Error("no session"))
      .mockResolvedValue(makeMe() as never);
    vi.mocked(authSvc.login).mockResolvedValue(undefined as never);
    apiMock.listInterviews.mockResolvedValue([makeInterview({ status: "COMPLETED" })]);

    renderApp("/login");

    // The auth card mounts every mode slot, so fields are addressed by id.
    await screen.findByText(/welcome back/i);
    fireEvent.change(document.getElementById("login-email") as HTMLInputElement, {
      target: { value: "lean@example.com" },
    });
    fireEvent.change(document.getElementById("login-password") as HTMLInputElement, {
      target: { value: "LeanSuite1Pass" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(useAuthStore.getState().status).toBe("authenticated"));
    // The dashboard is a lazy route that then loads its interview list; with a
    // completed interview seeded it shows the recent-interviews section.
    expect(
      await screen.findByText(/candidate dashboard/i, undefined, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(useAuthStore.getState().status).toBe("authenticated");
  });

  it("redirects an unauthenticated visitor from a protected route to sign-in", async () => {
    vi.mocked(authSvc.me).mockRejectedValue(new Error("no session"));

    renderApp("/dashboard");

    expect(await screen.findByText(/welcome back/i)).toBeInTheDocument();
    expect(useAuthStore.getState().status).toBe("unauthenticated");
  });

  it("hands a new registration to the verification step", async () => {
    vi.mocked(authSvc.me).mockRejectedValue(new Error("no session"));
    vi.mocked(authSvc.register).mockResolvedValue(undefined as never);

    renderApp("/register");
    await waitFor(() => expect(document.getElementById("register-name")).not.toBeNull());

    fireEvent.change(document.getElementById("register-name") as HTMLInputElement, {
      target: { value: "Lean Candidate" },
    });
    fireEvent.change(document.getElementById("register-username") as HTMLInputElement, {
      target: { value: "leancandidate" },
    });
    fireEvent.change(document.getElementById("register-email") as HTMLInputElement, {
      target: { value: "lean@example.com" },
    });
    fireEvent.change(document.getElementById("register-password") as HTMLInputElement, {
      target: { value: "LeanSuite1Pass" },
    });
    fireEvent.change(document.getElementById("register-confirm") as HTMLInputElement, {
      target: { value: "LeanSuite1Pass" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(authSvc.register).toHaveBeenCalled());
    await waitFor(() => expect(useAuthStore.getState().pendingEmail).toBe("lean@example.com"));
  });
});
