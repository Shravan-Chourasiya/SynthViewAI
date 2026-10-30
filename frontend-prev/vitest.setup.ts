import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
import { server } from './src/__tests__/mocks/node';

// Establish API mocking before all tests
beforeAll(() => {
  server.listen({
    onUnhandledRequest: 'error', // This will help catch unhandled requests
  });
});

// Reset any request handlers between tests
afterEach(() => {
  server.resetHandlers();
});

// Clean up after all tests
afterAll(() => {
  server.close();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
class IntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
window.IntersectionObserver = IntersectionObserver;

// Mock ResizeObserver
class ResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
window.ResizeObserver = ResizeObserver;

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// Mock HTMLCanvasElement.toBlob
HTMLCanvasElement.prototype.toBlob = function (
  callback,
  type = 'image/png',
  quality
) {
  callback(new Blob([''], { type }));
};

// Mock navigator.mediaDevices
Object.defineProperty(navigator, 'mediaDevices', {
  value: {
    getUserMedia: vi.fn().mockResolvedValue({
      getTracks: vi.fn().mockReturnValue([{ stop: vi.fn() }]),
      active: true,
    }),
    getDisplayMedia: vi.fn().mockResolvedValue({
      getTracks: vi.fn().mockReturnValue([{ stop: vi.fn() }]),
      active: true,
    }),
  },
  writable: true,
});