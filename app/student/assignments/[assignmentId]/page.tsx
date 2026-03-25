import { UserRole } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { PortalShell } from "@/components/platform/PortalShell";
import { AssignmentRunner } from "@/components/platform/AssignmentRunner";
import { getAuthContext } from "@/lib/authz";
import { roleHomePath } from "@/lib/navigation";
import { prisma } from "@/lib/prisma";
import { autoSubmitOverdueAttemptsForStudent } from "@/lib/classroom";

interface AssignmentDetailPageProps {
  params: Promise<{ assignmentId: string }>;
}

function jsonArrayToStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
}

export default async function StudentAssignmentDetailPage({
  params
}: AssignmentDetailPageProps) {
  const auth = await getAuthContext();
  if (!auth) redirect("/");
  if (!auth.roleSelectedAt && auth.role !== UserRole.ADMIN) redirect("/welcome");
  if (auth.role !== UserRole.STUDENT) redirect(roleHomePath(auth.role));

  const { assignmentId } = await params;
  await autoSubmitOverdueAttemptsForStudent(auth.userId);

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      classroom: {
        select: {
          id: true,
          name: true,
          memberships: {
            where: {
              studentId: auth.userId,
              removedAt: null
            },
            select: { id: true }
          }
        }
      },
      questions: {
        orderBy: { position: "asc" }
      },
      attempts: {
        where: { studentId: auth.userId },
        include: {
          responses: true
        },
        take: 1
      }
    }
  });

  if (!assignment) notFound();
  const attempt = assignment.attempts[0];
  const hasMembership = assignment.classroom.memberships.length > 0;

  if (!hasMembership && !attempt) {
    redirect("/student/assignments");
  }

  const now = Date.now();
  const duePassed = now > assignment.dueAt.getTime();
  const canStart =
    hasMembership &&
    !attempt?.submittedAt &&
    (!duePassed || assignment.allowLateSubmissions || Boolean(attempt?.startedAt));

  const responseMap = new Map(attempt?.responses.map((response) => [response.questionId, response]) ?? []);
  const responseRows = assignment.questions.map((question) => {
    const response = responseMap.get(question.id);
    return {
      questionId: question.id,
      attempts: response?.attempts ?? 0,
      completed: Boolean(response?.completedAt),
      isCorrect: response?.isCorrect ?? null,
      firstCorrect: response?.firstCorrect ?? null
    };
  });

  return (
    <PortalShell
      role={auth.role}
      userName={auth.name}
      userEmail={auth.email}
      title={assignment.title}
      subtitle={`${assignment.classroom.name} assignment`}
    >
      <AssignmentRunner
        assignmentId={assignment.id}
        title={assignment.title}
        dueAtIso={assignment.dueAt.toISOString()}
        allowLateSubmissions={assignment.allowLateSubmissions}
        started={Boolean(attempt?.startedAt)}
        submittedAtIso={attempt?.submittedAt?.toISOString() ?? null}
        submissionKind={attempt?.submissionKind ?? null}
        canStart={canStart}
        questions={assignment.questions.map((question) => ({
          id: question.id,
          position: question.position,
          prompt: question.prompt,
          subPrompt: question.subPrompt,
          format: question.format,
          choices: jsonArrayToStrings(question.choices)
        }))}
        responses={responseRows}
      />
    </PortalShell>
  );
}
