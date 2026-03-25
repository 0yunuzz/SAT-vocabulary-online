import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { requireAuthContext } from "@/lib/authz";
import { submitAssignmentAttempt } from "@/lib/classroom";
import { toErrorResponse } from "@/lib/api";

interface RouteContext {
  params: Promise<{ assignmentId: string }>;
}

export async function POST(_: Request, context: RouteContext) {
  try {
    const auth = await requireAuthContext();
    if (auth.role !== UserRole.STUDENT) {
      throw new Error("FORBIDDEN");
    }

    const { assignmentId } = await context.params;
    const attempt = await submitAssignmentAttempt(auth.userId, assignmentId);
    return NextResponse.json({ attempt });
  } catch (error) {
    return toErrorResponse(error);
  }
}
