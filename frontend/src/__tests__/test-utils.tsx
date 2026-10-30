import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/components/theme-provider';
import { MotionProvider } from '@/components/motion-provider';
import { PropsWithChildren } from 'react';

interface RenderWithProvidersOptions {
  route?: string;
  initialEntries?: string[];
  /** Route pattern the element is mounted on, e.g. `/interviews/:id/live`. */
  path?: string;
  /** Route parameters materialised next to the mounted pattern. */
  params?: { pattern: string; value: string }[];
}

/**
 * Pages read their data through react-query, so every page-level render needs a
 * client. Retries are off and the cache is per call: a failing query should
 * surface immediately instead of re-running the service mock.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

/** Navigates to `path` with `params` filled in, e.g. `/interviews/abc/live`. */
export function resolvePath(
  path: string,
  params: NonNullable<RenderWithProvidersOptions['params']>,
): string {
  return params.reduce((acc, { pattern, value }) => acc.replace(pattern, value), path);
}

export const renderWithProviders = (
  ui: React.ReactElement,
  { route = '/', initialEntries, path, params }: RenderWithProvidersOptions = {},
) => {
  const queryClient = createTestQueryClient();
  const target = path ? resolvePath(path, params ?? []) : undefined;

  const Wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        {/* Pages animate through `useMotion`, which throws without this. */}
        <MotionProvider>
          <MemoryRouter
            initialEntries={initialEntries ? initialEntries : [target ?? route]}
          >
            {children}
          </MemoryRouter>
        </MotionProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );

  return render(ui, { wrapper: Wrapper });
};

/**
 * Mounts a single page on its real route pattern, so `useParams()` sees the
 * values the router would produce in the app.
 */
export const renderRoute = (
  ui: React.ReactElement,
  {
    path = '/',
    params = [],
  }: { path?: string; params?: RenderWithProvidersOptions['params'] } = {},
) =>
  renderWithProviders(
    <Routes>
      <Route path={path} element={ui} />
    </Routes>,
    { path, params },
  );
