// src/lib/auth/config.ts
import { NextAuthOptions } from "next-auth";

// TEMP: Dev mode - bypass authentication
const DEV_MODE = true;

export const authOptions: NextAuthOptions = {
  providers: [],
  callbacks: DEV_MODE ? undefined : undefined,
  pages: {
    signIn: '/login',
  },
};
