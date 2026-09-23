/**
 * Auth area — `/login` and `/register`, both served by `AuthPage` from
 * `App.tsx`'s router config. The store is real; only the auth service beneath
 * it is stubbed, so the form → store → service path is exercised as written.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import * as authSvc from "@/lib/services/auth.service";
import { useAuthStore } from "@/lib/stores/auth.store";
import { AuthPage } from "@/pages/auth/auth";
import { makeMe, primeApi, renderPage } from "./support.js";

vi.mock("@/lib/api", async () => (await import("./support.js")).apiModuleMock());
vi.mock("@/lib/services/auth.service");

describe("auth pages", () => {
  beforeEach(() => {
    primeApi();
    vi.clearAllMocks();
    useAuthStore.setState({ user: null, pendingEmail: null, status: "idle", error: null });
  });

  it("renders the sign-in form at /login", () => {
    renderPage(<AuthPage />, { route: "/login", path: "/login" });

    expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
    // The card keeps all three mode slots mounted, so the same label exists
    // more than once — the sign-in field is the one wired to `login-email`.
    expect(document.getElementById("login-email")).toBeInTheDocument();
    expect(document.getElementById("login-password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("renders the account-creation form at /register", () => {
    renderPage(<AuthPage />, { route: "/register", path: "/register" });

    expect(document.getElementById("register-name")).toBeInTheDocument();
    expect(document.getElementById("register-username")).toBeInTheDocument();
    expect(document.getElementById("register-email")).toBeInTheDocument();
    expect(document.getElementById("register-confirm")).toBeInTheDocument();
  });

  it("signs in through the store and marks the session authenticated", async () => {
    vi.mocked(authSvc.login).mockResolvedValue(undefined as never);
    vi.mocked(authSvc.me).mockResolvedValue(makeMe() as never);

    renderPage(<AuthPage />, { route: "/login", path: "/login" });

    fireEvent.change(document.getElementById("login-email") as HTMLInputElement, {
      target: { value: "lean@example.com" },
    });
    fireEvent.change(document.getElementById("login-password") as HTMLInputElement, {
      target: { value: "LeanSuite1Pass" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() =>
      expect(authSvc.login).toHaveBeenCalledWith({
        email: "lean@example.com",
        password: "LeanSuite1Pass",
        deviceType: "desktop",
      }),
    );
    await waitFor(() => expect(useAuthStore.getState().status).toBe("authenticated"));
  });
});
