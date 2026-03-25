import { UserRole } from "@prisma/client";

export const ADMIN_EMAIL = "0yunus.kilinc@gmail.com";

export function normalizeEmail(email?: string | null): string {
  return (email ?? "").trim().toLowerCase();
}

export function isAdminEmail(email?: string | null): boolean {
  return normalizeEmail(email) === ADMIN_EMAIL;
}

export function getEffectiveRole(
  role: UserRole | null | undefined,
  email?: string | null
): UserRole {
  if (isAdminEmail(email)) return UserRole.ADMIN;
  if (role === UserRole.ADMIN) return UserRole.STUDENT;
  return role ?? UserRole.STUDENT;
}

export function canManageRole(targetEmail?: string | null): boolean {
  return !isAdminEmail(targetEmail);
}
