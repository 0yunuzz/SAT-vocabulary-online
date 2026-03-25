import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuthContext } from "@/lib/authz";
import { removeStudentFromClass } from "@/lib/classroom";
import { toErrorResponse } from "@/lib/api";

interface RouteContext {
  params: Promise<{
    classId: string;
    studentId: string;
  }>;
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const auth = await requireAuthContext();
    if (auth.role !== UserRole.TEACHER && auth.role !== UserRole.ADMIN) {
      throw new Error("FORBIDDEN");
    }

    const { classId, studentId } = await context.params;

    const classroom = await prisma.classroom.findUnique({
      where: { id: classId },
      select: { id: true, teacherId: true }
    });
    if (!classroom) {
      throw new Error("CLASS_NOT_FOUND");
    }
    if (auth.role === UserRole.TEACHER && classroom.teacherId !== auth.userId) {
      throw new Error("FORBIDDEN");
    }

    const membership = await prisma.classMembership.findUnique({
      where: {
        classId_studentId: {
          classId,
          studentId
        }
      },
      select: { id: true }
    });
    if (!membership) {
      throw new Error("CLASS_NOT_FOUND");
    }

    await removeStudentFromClass(classId, studentId, auth.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
