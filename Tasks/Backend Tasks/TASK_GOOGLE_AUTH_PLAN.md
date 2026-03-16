# Google Authentication Implementation Plan for Billing App

This plan refactors the Google Authentication implementation from `fcn-tracker` to be modular and compatible with the Next.js App Router architecture of `billing-app`.

## 1. Overview

The `fcn-tracker` uses Express + Passport.js with a hardcoded list of authorized users. The `billing-app` is built on Next.js 13+ App Router. The recommended approach for Next.js is using **NextAuth.js (Auth.js)**, which provides a more robust and framework-native solution while maintaining the same business logic (authorized user checks).

## 2. Dependencies

Install the necessary package:

```bash
npm install next-auth
```

## 3. Modular Architecture

The implementation will be split into modular components:

### A. Authorization Logic (Modular)

Create `src/lib/auth/authorized-users.ts` to isolate the user verification logic. This mimics `fcn-tracker/server/config/authorizedUsers.js`.

```typescript
// src/lib/auth/authorized-users.ts

export type UserRole = 'admin' | 'user';

export interface AuthorizedUser {
  email: string;
  name: string;
  role: UserRole;
}

// Hardcoded authorized users (Ported from fcn-tracker)
export const AUTHORIZED_USERS: AuthorizedUser[] = [
  {
    email: 'thyeon@gmail.com',
    name: 'Yam',
    role: 'admin'
  },
  {
    email: 'thyeon@g-i.com.my',
    name: 'Yam GI',
    role: 'user'
  },
  {
    email: 'sietyin0214@gmail.com',
    name: 'Colleague Two',
    role: 'user'
  }
];

export function isAuthorizedUser(email: string | null | undefined): AuthorizedUser | undefined {
  if (!email) return undefined;
  return AUTHORIZED_USERS.find(user => user.email.toLowerCase() === email.toLowerCase());
}
```

### B. Auth Configuration (Modular)

Create `src/lib/auth/config.ts` to configure NextAuth providers and callbacks. This effectively replaces `passport.js` configuration.

```typescript
// src/lib/auth/config.ts
import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { isAuthorizedUser } from "./authorized-users";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // Logic ported from fcn-tracker passport strategy callback
      const authorizedUser = isAuthorizedUser(user.email);

      if (!authorizedUser) {
        console.log(`Unauthorized access attempt: ${user.email}`);
        return false; // Access denied
      }

      return true; // Access granted
    },
    async jwt({ token, user }) {
      // Add role to JWT when user signs in
      if (user && user.email) {
        const authorizedUser = isAuthorizedUser(user.email);
        if (authorizedUser) {
          token.role = authorizedUser.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      // Expose role in session
      if (session.user) {
        (session.user as any).role = token.role;
      }
      return session;
    }
  },
  pages: {
    signIn: '/auth/login', // Custom login page if needed
    error: '/auth/error', // Error page
  }
};
```

### C. API Route (Integration)

Create the API route handler that NextAuth requires.

`src/app/api/auth/[...nextauth]/route.ts`:

```typescript
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth/config";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
```

## 4. Middleware Protection (Optional but Recommended)

Create `middleware.ts` in the root (or `src/`) to protect routes.

```typescript
// middleware.ts
export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    // Protect all routes under /api except auth
    "/api/((?!auth).*)",
    // Protect dashboard or other private pages
    "/dashboard/:path*",
    "/billing/:path*",
    "/customers/:path*",
    "/history/:path*"
  ]
};
```

## 5. Environment Variables

Add to `.env.local` (do not commit secrets):

```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate_openssl_rand_base64_32
```

## 6. Implementation Steps

1.  **Install dependencies**: Run `npm install next-auth`.
2.  **Create directory structure**: `mkdir -p src/lib/auth`.
3.  **Implement Logic**: Create `src/lib/auth/authorized-users.ts` and `src/lib/auth/config.ts`.
4.  **Create API Route**: Create `src/app/api/auth/[...nextauth]/route.ts`.
5.  **Configure Environment**: Set up Google Cloud Console credentials and update `.env.local`.
6.  **Update Root Layout**: Wrap the application with `SessionProvider` (requires a client component wrapper).

### Client Component Wrapper Example

`src/providers/session-provider.tsx`:

```typescript
'use client';

import { SessionProvider } from "next-auth/react";

export function NextAuthSessionProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

Then use it in `src/app/layout.tsx`.
