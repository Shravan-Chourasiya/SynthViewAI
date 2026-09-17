# SyntheView AI Frontend

This is the frontend for the SyntheView AI application, built with React, TypeScript, and Tailwind CSS.

## Project Structure

```
frontend/
├── public/
├── src/
│   ├── assets/
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   ├── pages/
│   ├── types/
│   └── utils/
├── __tests__/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── package.json
└── vite.config.ts
```

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:5173](http://localhost:5173) to view the app in the browser.

## Testing

### Unit Tests
Run unit tests with Vitest:
```bash
npm run test:unit
```

### Integration Tests
Run integration tests with Vitest:
```bash
npm run test:integration
```

### E2E Tests
Run E2E tests with Playwright:
```bash
npm run test:e2e
```

To run Playwright tests in headed mode (with UI):
```bash
npm run test:e2e:headed
```

To open the Playwright test UI:
```bash
npm run test:e2e:ui
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run test` - Run all tests
- `npm run test:unit` - Run unit tests only
- `npm run test:integration` - Run integration tests only
- `npm run test:e2e` - Run E2E tests only
- `npm run test:watch` - Run tests in watch mode

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Radix UI Primitives
- Lucide React Icons
- Framer Motion (Animations)
- Zod (Validation)
- React Hook Form
- Vitest (Unit Testing)
- Playwright (E2E Testing)

## Design system

- Single source of truth: src/index.css (oklch tokens, light + dark, signal colors,
  radius scale, full animation language — ported 1:1 from the finalized landing page).
- Primitives: shadcn/ui base-nova style in src/components/ui/.
- Fonts: Inter (UI) + JetBrains Mono (data), loaded in index.html.
- Theme: dark default, class-based, localStorage key synthview-theme, no-flash script.

## Vite adaptation notes (vs. the original Next.js project)

1. next/font → Google Fonts in index.html, exposed as --font-inter / --font-jetbrains-mono.
2. 'use client' directives removed (not applicable outside Next.js).
3. usePathname → useLocation from react-router-dom.
4. @import 'shadcn/tailwind.css' removed — every token it provides is defined in index.css.
5. Theme no-flash script moved from layout.tsx into index.html.