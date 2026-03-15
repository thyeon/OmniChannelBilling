# Technology Stack

**Analysis Date:** 2026-03-15

## Languages

**Primary:**
- TypeScript 5.x - All application code (frontend and backend API routes)
- JavaScript (Node.js) - Runtime for Next.js

**Secondary:**
- CSS - Tailwind CSS for styling (not plain CSS)

## Runtime

**Environment:**
- Node.js - Required runtime (version managed via nvm or system Node)
- Next.js 14.2.35 - Full-stack React framework

**Package Manager:**
- npm - Primary package manager
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- Next.js 14.2.35 - React full-stack framework with App Router
- React 18 - UI library

**Styling:**
- Tailwind CSS 3.4.1 - Utility-first CSS framework
- tailwindcss-animate 1.0.7 - Animation utilities for Tailwind
- Radix UI - Unstyled, accessible UI primitives

**State Management:**
- Zustand 5.0.11 - Lightweight state management
- @tanstack/react-query 5.90.20 - Server state and caching

**Database:**
- MongoDB 6.21.0 - NoSQL database via official MongoDB driver

**Authentication:**
- next-auth 4.24.13 - Authentication for Next.js with Google OAuth

## Key Dependencies

**Critical:**
- next 14.2.35 - Framework core
- react 18 - UI library
- mongodb 6.21.0 - Database driver
- next-auth 4.24.13 - Authentication

**UI Components (Radix-based):**
- @radix-ui/react-checkbox - Checkbox component
- @radix-ui/react-dialog - Modal dialog
- @radix-ui/react-select - Select dropdown
- @radix-ui/react-tabs - Tabbed interface
- @radix-ui/react-switch - Toggle switch
- lucide-react 0.563.0 - Icon library

**Utilities:**
- zustand 5.0.11 - State management
- @tanstack/react-query 5.90.20 - Data fetching/caching
- tailwind-merge 3.4.0 - Tailwind class merging
- clsx 2.1.1 - Conditional classnames
- class-variance-authority 0.7.1 - Component variants

## Configuration

**Environment:**
- `.env.local` - Local environment configuration
- Required env vars (from code analysis):
  - `MONGODB_URI` - MongoDB connection string
  - `MONGODB_DB_NAME` - Database name
  - `GOOGLE_CLIENT_ID` - Google OAuth client ID
  - `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
  - `NEXTAUTH_SECRET` - NextAuth secret (implied)
  - `NEXTAUTH_URL` - NextAuth URL (implied)
  - `AUTOCOUNT_BASE_URL` - AutoCount API base URL
  - `AUTOCOUNT_API_TOKEN` - AutoCount API token

**Build:**
- `tsconfig.json` - TypeScript configuration with strict mode enabled
- `next.config.mjs` - Next.js configuration (standalone output mode)
- `tailwind.config.ts` - Tailwind CSS configuration
- `postcss.config.mjs` - PostCSS configuration
- `.eslintrc.json` - ESLint configuration (extends Next.js TypeScript rules)

**Path Aliases:**
- `@/*` maps to `./src/*` (defined in tsconfig.json)

## Platform Requirements

**Development:**
- Node.js
- npm
- MongoDB instance (local or remote)

**Production:**
- Node.js runtime
- MongoDB database
- Docker support (Dockerfile and docker-compose.yml present)
- Deployment to Vercel (recommended) or self-hosted

---

*Stack analysis: 2026-03-15*
