# Karigar Ops — admin web (static design)

React + TypeScript build of the admin console mockups in `docs/design/screens/admin/` (frames A-01a … A-06j).
It is a static design: every screen renders typed mock data, every dialog opens, and no API is called yet.

## Run

```bash
nvm use            # Node 22 (see .nvmrc)
npm install
npm run dev        # http://localhost:5173/screens lists every designed frame with a link to it
npm run build      # typecheck + production build
npm run lint
npm run format
npm run check      # typecheck + lint + format check
npm run test:e2e   # Playwright: every screen at 4 screen sizes, user journeys, WCAG checks
```

E2E runs on the installed Google Chrome. To test live source without a build, or to run two suites at once:
`E2E_SERVER=dev E2E_PORT=5191 npx playwright test --grep A-03`.

Opening the app signed out goes to `/login`; **Log in** then **Verify** signs you in (any code works in this static build)
and returns you to the page you asked for. The preview starts as `SUPER_ADMIN` so every screen is reachable; use the
role picker under your name in the sidebar to see what each staff role sees (LLD-020 §3.2). **Log out** is next to it.

## Stack

| Concern  | Choice                                                                                                  |
| -------- | ------------------------------------------------------------------------------------------------------- |
| Build    | Vite 8                                                                                                  |
| UI       | React 19, TypeScript (strict, `noUncheckedIndexedAccess`)                                               |
| Styling  | Tailwind CSS 4. Design tokens live in `src/styles/globals.css` under `@theme`                           |
| Variants | `class-variance-authority` + `mergeClassNames` (clsx + tailwind-merge)                                  |
| Routing  | React Router 7, one lazy-loaded chunk per feature                                                       |
| Icons    | lucide-react (SVG components, sized and coloured with Tailwind classes)                                 |
| Themes   | Light, dark and system via `data-theme` on `<html>`; toggle in the top bar and on sign-in screens       |
| Testing  | Playwright (mobile 390, tablet 768, laptop 1280, desktop 1440) + axe-core WCAG 2.1 AA in light and dark |
| Quality  | ESLint 9 (typescript-eslint, react-hooks, jsx-a11y), Prettier with Tailwind class sorting               |

## Structure

```text
e2e/                     Playwright specs (every-screen, user-journeys) and support helpers
src/
├── app/                 router and route metadata (breadcrumb, required permission)
├── assets/              static files (tool pattern SVGs)
├── components/
│   ├── ui/              design-system components; import from '@/components/ui'
│   └── layout/          AuthenticatedLayout, SignInLayout, SidebarNavigation, TopBar, PageHeader
├── config/              route-paths, sidebar-navigation, design-screen-index
├── features/            one folder per business area
│   ├── auth/            session, permissions, RequirePermission
│   ├── access/          A-01 login, MFA, ops dashboard and queues
│   ├── people/          A-02 user lookup, customer and worker detail
│   ├── marketplace/     A-03 requests and bookings
│   ├── trust/           A-04 verifications, disputes, reviews
│   ├── money/           A-05 payments, refunds, payouts, ledger
│   └── config/          A-06 catalog, zones, notifications, outbox, audit, staff, settings
├── hooks/               cross-feature hooks (useUrlDialog)
├── lib/                 pure helpers (formatters, merge-class-names)
├── mocks/               ids shared across features
├── pages/               app-level pages (screen index, not found)
└── styles/              globals.css: Tailwind import and design tokens
```

A feature folder looks like this:

```text
features/people/
├── index.ts             public API: only the page components the router needs
├── types.ts             domain types for this feature
├── mock-data.ts         typed mock records (replaced by API calls later)
├── pages/               one file per route, e.g. CustomerDetailPage.tsx
└── components/          parts used only inside this feature, e.g. SuspendCustomerDialog.tsx
```

## Rules

- **Names say what things do.** Files, components, hooks, functions and variables use full descriptive names
  (`SuspendWorkerDialog.tsx`, `formatMoney`, `handleAcknowledgeClick`). No short forms such as `cn`, `Can`, `x`, `tmp`.
- **One component per file**, and the file is named after it (PascalCase for components, kebab-case for other modules).
- **Features import each other only through their `index.ts`** (enforced by ESLint).
  Shared UI goes in `components/ui`, shared helpers in `lib`.
- **No hard-coded colours, radii or shadows.** Use the theme tokens (`bg-primary`, `text-fg-muted`, `rounded-lg`,
  `shadow-e2`). Need a new one? Add it to `@theme` in `globals.css`.
- **No inline `style`** except for truly data-driven values (for example a meter position).
- **Money is integer paise** (ADR-0006) and is shown with `formatMoney`. Ids are UUIDv7 shown with `CopyId`.
- **Links use `paths` from `@/config/route-paths`**, never string literals.
- **Sign-in redirects only to in-app paths.** Use `readSafeRedirectPath` / `withRedirectParam` from `@/features/auth`;
  never navigate to a raw `?redirectTo=` value (open-redirect risk).
- **Light and dark themes come from tokens.** Components never use `dark:` for colours; the dark values of every token
  live under `:root[data-theme='dark']` in `globals.css`. Add a token there if a colour does not adapt.
  The theme (Light / Dark / System, default System) is set before first paint in `index.html`.
- **Loading states use `LoadingSpinner`** (or the route-level `RouteLoadingFallback` and the top progress bar, which
  are automatic). Never plain "Loading…" text.
- **Dialogs use `useUrlDialog(name)`**, so `?dialog=name` deep-links to any open dialog and Back closes it.
- **Permission-gated actions** are wrapped in `<RequirePermission permission="…">`. This only hides UI;
  the API is the authority (security/01).
- **Icons come from `lucide-react`**, never emoji. Pass the component (`icon={Wrench}`) to UI-kit props, size it with
  Tailwind (`className="size-4"`), and mark decorative icons `aria-hidden`.
- **Responsive, mobile first.** Every screen must work at 390, 768, 1280 and 1440 px with no sideways page scroll.
  Use breakpoint prefixes (`grid-cols-1 md:grid-cols-2 xl:grid-cols-4`, `flex-col xl:flex-row`), let filter bars wrap,
  give side rails a width only from `xl:`, and keep wide tables inside `DataTable` (it scrolls on its own).
  The sidebar becomes a drawer below 1024 px.
- **Accessibility:** real `<button>` and `<a>` elements, labelled form controls (`Field`), `aria-hidden` on decorative emoji,
  table headers with `scope`, visible focus, colour never the only signal.

## Wiring the real API later

Each feature's `mock-data.ts` is the only place data comes from. Replace those reads with API calls
(for example TanStack Query hooks in `features/<name>/api/`) and the pages stay unchanged.
Login, MFA and the session in `features/auth` become `GET /api/v1/admin/me`.
