import NextAuth from "next-auth";
import type { UserRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user?: {
      id: string;
      role: UserRole;
      roleSelectedAt?: string | null;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
