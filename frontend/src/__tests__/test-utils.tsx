import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme-provider';
import { PropsWithChildren } from 'react';

interface RenderWithProvidersOptions {
  route?: string;
  initialEntries?: string[];
}

export const renderWithProviders = (
  ui: React.ReactElement,
  { route = '/', initialEntries }: RenderWithProvidersOptions = {}
) => {
  const Wrapper = ({ children }: PropsWithChildren) => (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <MemoryRouter initialEntries={initialEntries ? initialEntries : [route]}>
        {children}
      </MemoryRouter>
    </ThemeProvider>
  );

  return render(ui, { wrapper: Wrapper });
};