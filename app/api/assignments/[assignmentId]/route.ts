import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { requireAuthContext } from "@/lib/authz";
import { updateAssignmentSettings } from "@/lib/classroom";
import { toErrorResponse } from "@/lib/api";

interface RouteContext {
  params: Promise<{ assignmentId: string }>;
}

const patchSchema = z.object({
  dueAt: z.string().optional(),
  instructions: z.string().max(2500).nullable().optional(),
  allowLateSubmissions: z.boolean().optional()
});

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const auth = await requireAuthContext();
    if (auth.role !== UserRole.TEACHER) {
      throw new Error("FORBIDDEN");
    }

    const { assignmentId } = await context.params;
    const payload = patchSchema.parse(await request.json());
    const dueAt = payload.dueAt ? new Date(payload.dueAt) : undefined;
    if (dueAt && Number.isNaN(dueAt.getTime())) {
      throw new Error("INVALID_DATE");
    }

    const updated = await updateAssignmentSettings(auth.userId, assignmentId, {
      dueAt,
      instructions:
        payload.instructions === undefined ? undefined : payload.instructions,
      allowLateSubmissions: payload.allowLateSubmissions
    });

    return NextResponse.json({ assignment: updated });
  } catch (error) {
    return toErrorResponse(error);
  }
}
