import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import ResendProvider from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import type { Role } from "@prisma/client";

const credSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * env().AUTH_SESSION_MAX_AGE_HOURS,
  },
  trustHost: true,
  secret: env().AUTH_SECRET,
  pages: {
    signIn: "/login",
    verifyRequest: "/login/check-email",
  },
  providers: [
    ResendProvider({
      apiKey: env().RESEND_API_KEY || "missing-resend-key",
      from: env().EMAIL_FROM,
    }),
    Credentials({
      name: "Email + password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credSchema.safeParse(raw);
        if (!parsed.success) return null;
        const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
        if (!user || !user.active || !user.passwordHash) return null;
        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const db = await prisma.user.findUnique({ where: { email: user.email } });
      if (!db || !db.active) return false;
      await prisma.user.update({
        where: { id: db.id },
        data: { lastLoginAt: new Date() },
      });
      return true;
    },
    async jwt({ token, user }) {
      if (user && "role" in user) {
        token.userId = (user as { id: string }).id;
        token.role = (user as { role: Role }).role;
      } else if (token.email && !token.role) {
        const db = await prisma.user.findUnique({ where: { email: token.email } });
        if (db) {
          token.userId = db.id;
          token.role = db.role;
          token.name = db.name;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      if (user.id) {
        await prisma.auditLog.create({
          data: {
            actorUserId: user.id,
            entityType: "User",
            entityId: user.id,
            action: "LOGIN",
          },
        }).catch(() => {});
      }
    },
  },
});
