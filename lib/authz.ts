import { UserRole } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEffectiveRole } from "@/lib/roles";

export interface AuthContext {
  userId: string;
  email: string | null;
  name: string | null;
  image: string | null;
  role: UserRole;
  roleSelectedAt: Date | null;
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      role: true,
      roleSelectedAt: true
    }
  });
  if (!user) return null;

  const role = getEffectiveRole(user.role, user.email);
  if (role === UserRole.ADMIN && user.role !== UserRole.ADMIN) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        role: UserRole.ADMIN,
        roleSelectedAt: user.roleSelectedAt ?? new Date()
      }
    });
  }

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    image: user.image,
    role,
    roleSelectedAt: user.roleSelectedAt
  };
}

export async function requireAuthContext(): Promise<AuthContext> {
  const context = await getAuthContext();
  if (!context) {
    throw new Error("UNAUTHORIZED");
  }
  return context;
}

export async function requireRole(allowed: UserRole[]): Promise<AuthContext> {
  const context = await requireAuthContext();
  if (!allowed.includes(context.role)) {
    throw new Error("FORBIDDEN");
  }
  return context;
}
