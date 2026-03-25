import { NextResponse } from "next/server";
import {
  AssignmentMode,
  AssignmentSourceType,
  UserRole
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthContext } from "@/lib/authz";
import {
  autoSubmitOverdueAttemptsForStudent,
  createAssignmentForTeacher,
  getAssignmentStatus
} from "@/lib/classroom";
import { toErrorResponse } from "@/lib/api";

const createSchema = z.object({
  title: z.string().min(1).max(160),
  instructions: z.string().max(2500).optional().nullable(),
  classId: z.string().min(1),
  dueAt: z.string().min(1),
  allowLateSubmissions: z.boolean(),
  questionCount: z.number().int().min(1).max(150),
  mode: z.enum(["MULTIPLE_CHOICE", "TYPED_RESPONSE", "MIXED"]),
  sourceType: z.enum(["DIRECT_WORDS", "SOURCE_GROUP"]),
  sourceLabel: z.string().max(120).optional(),
  wordIds: z.array(z.number().int().positive()).optional()
});

export async function GET() {
  try {
    const auth = await requireAuthContext();

    if (auth.role === UserRole.STUDENT) {
      await autoSubmitOverdueAttemptsForStudent(auth.userId);

      const assignments = await prisma.assignment.findMany({
        where: {
          OR: [
            {
              classroom: {
                memberships: {
                  some: {
                    studentId: auth.userId,
                    removedAt: null
                  }
                }
              }
            },
            {
              attempts: {
                some: {
                  studentId: auth.userId
                }
              }
            }
          ]
        },
        orderBy: { dueAt: "asc" },
        include: {
          classroom: {
            select: {
              id: true,
              name: true,
              teacher: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          },
          attempts: {
            where: {
              studentId: auth.userId
            },
            take: 1,
            select: {
              id: true,
              startedAt: true,
              submittedAt: true,
              submittedLate: true,
              submissionKind: true,
              questionsCompleted: true,
              totalQuestions: true,
              finalCorrect: true
            }
          }
        }
      });

      return NextResponse.json({
        assignments: assignments.map((assignment) => {
          const attempt = assignment.attempts[0];
          return {
            id: assignment.id,
            title: assignment.title,
            dueAt: assignment.dueAt,
            allowLateSubmissions: assignment.allowLateSubmissions,
            mode: assignment.mode,
            questionCount: assignment.questionCount,
            classroom: assignment.classroom,
            status: getAssignmentStatus({
              dueAt: assignment.dueAt,
              allowLateSubmissions: assignment.allowLateSubmissions,
              startedAt: attempt?.startedAt,
              submittedAt: attempt?.submittedAt,
              submittedLate: attempt?.submittedLate
            }),
            attempt
          };
        })
      });
    }

    if (auth.role === UserRole.TEACHER) {
      const assignments = await prisma.assignment.findMany({
        where: {
          teacherId: auth.userId
        },
        orderBy: { createdAt: "desc" },
        include: {
          classroom: {
            select: {
              id: true,
              name: true
            }
          },
          _count: {
            select: {
              attempts: true
            }
          }
        }
      });
      return NextResponse.json({ assignments });
    }

    const assignments = await prisma.assignment.findMany({
      orderBy: { createdAt: "desc" },
      take: 300,
      include: {
        classroom: {
          select: {
            id: true,
            name: true
          }
        },
        teacher: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        _count: {
          select: {
            attempts: true
          }
        }
      }
    });
    return NextResponse.json({ assignments });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthContext();
    if (auth.role !== UserRole.TEACHER) {
      throw new Error("FORBIDDEN");
    }

    const parsed = createSchema.parse(await request.json());
    const dueAt = new Date(parsed.dueAt);
    if (Number.isNaN(dueAt.getTime())) {
      throw new Error("INVALID_DATE");
    }

    const assignmentId = await createAssignmentForTeacher(auth.userId, {
      classId: parsed.classId,
      title: parsed.title,
      instructions: parsed.instructions ?? undefined,
      dueAt,
      allowLateSubmissions: parsed.allowLateSubmissions,
      questionCount: parsed.questionCount,
      mode: AssignmentMode[parsed.mode],
      sourceType: AssignmentSourceType[parsed.sourceType],
      sourceLabel: parsed.sourceLabel,
      wordIds: parsed.wordIds
    });

    return NextResponse.json({ assignmentId });
  } catch (error) {
    return toErrorResponse(error);
  }
}
