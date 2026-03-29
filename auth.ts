import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    signIn({ user }) {
      const allowed = process.env.ALLOWED_EMAIL;
      if (!allowed) return true;
      const emails = allowed.split(',').map(e => e.trim());
      return emails.includes(user.email ?? '');
    },
  },
});
