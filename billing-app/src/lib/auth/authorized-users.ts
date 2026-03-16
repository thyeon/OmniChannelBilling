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
