/**
 * Admin overview (`/admin` — `AdminOverviewPage`) and its `AdminGate`.
 *
 * The page reads its numbers from `useAdminStore`, which delegates to the admin
 * service — so the service is the stub and the store stays real.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { AdminOverviewPage } from "@/pages/admin/overview";
import { useAuthStore } from "@/lib/stores/auth.store";
import { makeMe, primeApi, renderPage } from "./support.js";

vi.mock("@/lib/api", async () => (await import("./support.js")).apiModuleMock());

vi.mock("@/lib/services/admin.service", () => ({
  adminService: {
    getOverviewStats: vi.fn().mockResolvedValue({
      totalUsers: 128,
      totalInterviews: 342,
      interviewsByStatus: { COMPLETED: 300, INPROGRESS: 42 },
      recentSignups: 17,
      activeUsers: 64,
    }),
    getUsers: vi.fn(),
    getUserById: vi.fn(),
    updateUserRole: vi.fn(),
    suspendUser: vi.fn(),
    reinstateUser: vi.fn(),
    getInterviews: vi.fn(),
    getInterviewById: vi.fn(),
  },
}));

describe("admin overview page", () => {
  beforeEach(() => {
    primeApi();
    vi.clearAllMocks();
  });

  it("shows platform totals to an admin", async () => {
    useAuthStore.setState({ user: makeMe({ userrole: "admin" }) as never, status: "authenticated" });

    renderPage(<AdminOverviewPage />, { route: "/admin", path: "/admin" });

    expect(await screen.findByText(/platform overview/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("128")).toBeInTheDocument());
    expect(screen.getByText("342")).toBeInTheDocument();
    expect(screen.queryByText(/admin access required/i)).not.toBeInTheDocument();
  });

  it("refuses to render admin data for a candidate", async () => {
    useAuthStore.setState({
      user: makeMe({ userrole: "user" }) as never,
      status: "authenticated",
    });

    renderPage(<AdminOverviewPage />, { route: "/admin", path: "/admin" });

    expect(await screen.findByText(/admin access required/i)).toBeInTheDocument();
    expect(screen.queryByText(/platform overview/i)).not.toBeInTheDocument();
  });
});
