import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthContext } from "@/lib/authz";
import { isAdminEmail } from "@/lib/roles";
import { toErrorResponse } from "@/lib/api";

const payloadSchema = z.object({
  role: z.enum(["STUDENT", "TEACHER"])
});

export async function POST(request: Request) {
  try {
    const context = await requireAuthContext();
    const payload = payloadSchema.parse(await request.json());

    if (isAdminEmail(context.email)) {
      return NextResponse.json({
        role: UserRole.ADMIN,
        roleSelectedAt: context.roleSelectedAt?.toISOString() ?? new Date().toISOString()
      });
    }

    const selectedRole =
      payload.role === "TEACHER" ? UserRole.TEACHER : UserRole.STUDENT;

    if (context.roleSelectedAt && context.role !== selectedRole) {
      throw new Error("ROLE_SELECTION_LOCKED");
    }

    const updated = await prisma.user.update({
      where: { id: context.userId },
      data: {
        role: selectedRole,
        roleSelectedAt: context.roleSelectedAt ?? new Date()
      },
      select: {
        role: true,
        roleSelectedAt: true
      }
    });

    return NextResponse.json({
      role: updated.role,
      roleSelectedAt: updated.roleSelectedAt?.toISOString() ?? null
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
