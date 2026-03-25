import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { requireAuthContext } from "@/lib/authz";
import { submitAssignmentAnswer } from "@/lib/classroom";
import { toErrorResponse } from "@/lib/api";

interface RouteContext {
  params: Promise<{ assignmentId: string }>;
}

const answerSchema = z.object({
  questionId: z.string().min(1),
  answer: z.string().min(1).max(2000),
  responseMs: z.number().int().min(0).max(120000)
});

export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = await requireAuthContext();
    if (auth.role !== UserRole.STUDENT) {
      throw new Error("FORBIDDEN");
    }

    const { assignmentId } = await context.params;
    const payload = answerSchema.parse(await request.json());

    const result = await submitAssignmentAnswer({
      studentId: auth.userId,
      assignmentId,
      questionId: payload.questionId,
      answer: payload.answer,
      responseMs: payload.responseMs
    });

    return NextResponse.json({ result });
  } catch (error) {
    return toErrorResponse(error);
  }
}
