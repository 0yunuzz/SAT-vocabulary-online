import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import type { NextAuthOptions } from "next-auth";
import { prisma } from "@/lib/prisma";
import { getEffectiveRole, isAdminEmail } from "@/lib/roles";
import { UserRole } from "@prisma/client";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID ?? "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? ""
    })
  ],
  secret: process.env.AUTH_SECRET,
  callbacks: {
    async signIn({ user }) {
      if (!user.id) return true;

      if (isAdminEmail(user.email)) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            role: UserRole.ADMIN,
            roleSelectedAt: new Date()
          }
        });
      }

      return true;
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: {
            role: true,
            roleSelectedAt: true,
            email: true
          }
        });
        const role = getEffectiveRole(dbUser?.role, dbUser?.email ?? session.user.email);
        session.user.role = role;
        session.user.roleSelectedAt = dbUser?.roleSelectedAt?.toISOString() ?? null;
      }
      return session;
    }
  },
  pages: {
    signIn: "/"
  }
};
