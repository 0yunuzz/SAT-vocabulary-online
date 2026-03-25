import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { requireAuthContext } from "@/lib/authz";
import { joinClassroomByCode } from "@/lib/classroom";
import { toErrorResponse } from "@/lib/api";

const payloadSchema = z.object({
  joinCode: z.string().min(1).max(20)
});

export async function POST(request: Request) {
  try {
    const context = await requireAuthContext();
    if (context.role !== UserRole.STUDENT) {
      throw new Error("FORBIDDEN");
    }

    const payload = payloadSchema.parse(await request.json());
    const result = await joinClassroomByCode(context.userId, payload.joinCode);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
