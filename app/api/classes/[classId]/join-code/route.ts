import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { requireAuthContext } from "@/lib/authz";
import { regenerateClassJoinCode } from "@/lib/classroom";
import { toErrorResponse } from "@/lib/api";

interface RouteContext {
  params: Promise<{ classId: string }>;
}

export async function POST(_: Request, context: RouteContext) {
  try {
    const auth = await requireAuthContext();
    if (auth.role !== UserRole.TEACHER) {
      throw new Error("FORBIDDEN");
    }

    const { classId } = await context.params;
    const updated = await regenerateClassJoinCode(auth.userId, classId);
    return NextResponse.json({ classroom: updated });
  } catch (error) {
    return toErrorResponse(error);
  }
}
