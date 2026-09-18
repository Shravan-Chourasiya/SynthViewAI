import { useEffect, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/lib/stores/auth.store";

// ── AuthBootstrap ─────────────────────────────────────────────────────────────
// Mount once above the router. Calls bootstrap() exactly once per page load.

export function AuthBootstrap({ children }: { children: ReactNode }) {
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    if (status === "idle") bootstrap();
  }, [bootstrap, status]);

  return <>{children}</>;
}

// ── RequireAuth ───────────────────────────────────────────────────────────────
// Wraps protected routes. Waits for bootstrap to resolve before deciding.
// Never flashes a redirect to /login while status is still idle/loading.

export function RequireAuth({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  if (status === "idle" || status === "loading") {
    return (
      <div className="flex min-h-screen flex-col gap-4 p-8">
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <Navigate to="/login" replace state={{ from: location.pathname }} />
    );
  }

  return <>{children}</>;
}

// ── RequireAdmin ───────────────────────────────────────────────────────────────
// Wraps admin routes. Checks if user has admin privileges.
export function RequireAdmin({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (status === "idle" || status === "loading") {
    return (
      <div className="flex min-h-screen flex-col gap-4 p-8">
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <Navigate to="/login" replace state={{ from: location.pathname }} />
    );
  }

  if (user?.userrole !== "admin") {
    return (
      <Navigate to="/dashboard" replace />
    );
  }

  return <>{children}</>;
}