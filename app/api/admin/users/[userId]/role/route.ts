import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { isAdminEmail } from "@/lib/roles";
import { toErrorResponse } from "@/lib/api";

interface RouteContext {
  params: Promise<{ userId: string }>;
}

const payloadSchema = z.object({
  role: z.enum(["STUDENT", "TEACHER", "ADMIN"])
});

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const auth = await requireRole([UserRole.ADMIN]);
    const { userId } = await context.params;
    const payload = payloadSchema.parse(await request.json());

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true
      }
    });
    if (!target) {
      throw new Error("USER_NOT_FOUND");
    }

    if (isAdminEmail(target.email) && payload.role !== "ADMIN") {
      throw new Error("ROLE_NOT_ALLOWED");
    }
    if (!isAdminEmail(target.email) && payload.role === "ADMIN") {
      throw new Error("ROLE_NOT_ALLOWED");
    }

    const nextRole = UserRole[payload.role];
    if (target.role === nextRole) {
      return NextResponse.json({ role: nextRole });
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: target.id },
        data: {
          role: nextRole,
          roleSelectedAt: new Date()
        }
      }),
      prisma.roleAuditLog.create({
        data: {
          targetUserId: target.id,
          changedById: auth.userId,
          previousRole: target.role,
          newRole: nextRole
        }
      })
    ]);

    return NextResponse.json({ role: nextRole });
  } catch (error) {
    return toErrorResponse(error);
  }
}
