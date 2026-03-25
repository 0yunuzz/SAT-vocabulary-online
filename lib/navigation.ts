import { UserRole } from "@prisma/client";

export function roleHomePath(role: UserRole): string {
  if (role === UserRole.TEACHER) return "/teacher";
  if (role === UserRole.ADMIN) return "/admin";
  return "/student";
}
