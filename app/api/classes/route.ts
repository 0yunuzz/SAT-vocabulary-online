import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuthContext } from "@/lib/authz";
import { createClassroomForTeacher } from "@/lib/classroom";
import { toErrorResponse } from "@/lib/api";

const createClassSchema = z.object({
  name: z.string().min(1).max(120)
});

export async function GET() {
  try {
    const context = await requireAuthContext();

    if (context.role === UserRole.TEACHER) {
      const classes = await prisma.classroom.findMany({
        where: { teacherId: context.userId },
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: {
              memberships: {
                where: {
                  removedAt: null
                }
              },
              assignments: true
            }
          }
        }
      });
      return NextResponse.json({ classes });
    }

    if (context.role === UserRole.STUDENT) {
      const memberships = await prisma.classMembership.findMany({
        where: {
          studentId: context.userId,
          removedAt: null
        },
        orderBy: { joinedAt: "desc" },
        include: {
          classroom: {
            include: {
              teacher: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          }
        }
      });
      return NextResponse.json({
        classes: memberships.map((membership) => ({
          id: membership.classroom.id,
          name: membership.classroom.name,
          joinCode: membership.classroom.joinCode,
          teacher: membership.classroom.teacher,
          joinedAt: membership.joinedAt
        }))
      });
    }

    const classes = await prisma.classroom.findMany({
      orderBy: { createdAt: "desc" },
      take: 300,
      include: {
        teacher: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        _count: {
          select: {
            memberships: {
              where: {
                removedAt: null
              }
            },
            assignments: true
          }
        }
      }
    });
    return NextResponse.json({ classes });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireAuthContext();
    if (context.role !== UserRole.TEACHER) {
      throw new Error("FORBIDDEN");
    }

    const payload = createClassSchema.parse(await request.json());
    const classroom = await createClassroomForTeacher(context.userId, payload.name);
    return NextResponse.json({ classroom });
  } catch (error) {
    return toErrorResponse(error);
  }
}
