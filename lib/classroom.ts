import {
  AssignmentMode,
  AssignmentPromptType,
  AssignmentQuestionFormat,
  AssignmentSourceType,
  Prisma,
  SubmissionKind
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AssignmentStatusLabel =
  | "not started"
  | "in progress"
  | "submitted on time"
  | "submitted late"
  | "overdue";

type BaseWord = {
  id: number;
  word: string;
  definition: string;
  exampleSentence: string;
};

export interface CreateAssignmentInput {
  classId: string;
  title: string;
  instructions?: string;
  dueAt: Date;
  allowLateSubmissions: boolean;
  questionCount: number;
  mode: AssignmentMode;
  sourceType: AssignmentSourceType;
  sourceLabel?: string;
  wordIds?: number[];
}

const PROMPT_CYCLE: AssignmentPromptType[] = [
  AssignmentPromptType.WORD_TO_DEFINITION,
  AssignmentPromptType.DEFINITION_TO_WORD,
  AssignmentPromptType.SENTENCE_CONTEXT
];

const codeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ");
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function jsonToStringArray(value: Prisma.JsonValue | null | undefined): string[] {
  if (!value || !Array.isArray(value)) return [];
  return value.map((item) => String(item));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sentenceWithBlank(sentence: string, targetWord: string): string {
  const regex = new RegExp(`\\b${escapeRegExp(targetWord)}\\b`, "gi");
  if (regex.test(sentence)) {
    return sentence.replace(regex, "_____");
  }
  return `${sentence} (missing word: _____)`;
}

function randomCode(length = 6): string {
  let output = "";
  for (let i = 0; i < length; i += 1) {
    output += codeAlphabet[Math.floor(Math.random() * codeAlphabet.length)];
  }
  return output;
}

export async function generateUniqueJoinCode(
  tx: Prisma.TransactionClient | typeof prisma = prisma
): Promise<string> {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const code = randomCode();
    const exists = await tx.classroom.findUnique({
      where: { joinCode: code },
      select: { id: true }
    });
    if (!exists) return code;
  }
  throw new Error("JOIN_CODE_GENERATION_FAILED");
}

export function getAssignmentStatus({
  dueAt,
  allowLateSubmissions,
  startedAt,
  submittedAt,
  submittedLate
}: {
  dueAt: Date;
  allowLateSubmissions: boolean;
  startedAt?: Date | null;
  submittedAt?: Date | null;
  submittedLate?: boolean | null;
}): AssignmentStatusLabel {
  const now = Date.now();

  if (submittedAt) {
    return submittedLate ? "submitted late" : "submitted on time";
  }

  if (startedAt) {
    if (now > dueAt.getTime() && allowLateSubmissions) return "overdue";
    return "in progress";
  }

  if (now > dueAt.getTime()) return "overdue";
  return "not started";
}

function formatForQuestion(
  mode: AssignmentMode,
  questionIndex: number
): AssignmentQuestionFormat {
  if (mode === AssignmentMode.MULTIPLE_CHOICE) {
    return AssignmentQuestionFormat.MULTIPLE_CHOICE;
  }
  if (mode === AssignmentMode.TYPED_RESPONSE) {
    return AssignmentQuestionFormat.TYPED_RESPONSE;
  }
  return questionIndex % 2 === 0
    ? AssignmentQuestionFormat.MULTIPLE_CHOICE
    : AssignmentQuestionFormat.TYPED_RESPONSE;
}

function promptForQuestion(word: BaseWord, promptType: AssignmentPromptType): string {
  if (promptType === AssignmentPromptType.WORD_TO_DEFINITION) {
    return word.word;
  }
  if (promptType === AssignmentPromptType.DEFINITION_TO_WORD) {
    return word.definition;
  }
  return sentenceWithBlank(word.exampleSentence, word.word);
}

function subPromptForQuestion(
  promptType: AssignmentPromptType,
  format: AssignmentQuestionFormat
): string {
  if (format === AssignmentQuestionFormat.TYPED_RESPONSE) {
    if (promptType === AssignmentPromptType.WORD_TO_DEFINITION) {
      return "Type the best definition.";
    }
    if (promptType === AssignmentPromptType.DEFINITION_TO_WORD) {
      return "Type the SAT word that matches the definition.";
    }
    return "Type the word that best fits the sentence context.";
  }

  if (promptType === AssignmentPromptType.WORD_TO_DEFINITION) {
    return "Choose the best definition.";
  }
  if (promptType === AssignmentPromptType.DEFINITION_TO_WORD) {
    return "Choose the SAT word that matches the definition.";
  }
  return "Choose the word that best fits the sentence context.";
}

function answerTextForQuestion(
  word: BaseWord,
  promptType: AssignmentPromptType
): string {
  if (promptType === AssignmentPromptType.WORD_TO_DEFINITION) {
    return word.definition;
  }
  return word.word;
}

function choicePoolValue(word: BaseWord, promptType: AssignmentPromptType): string {
  if (promptType === AssignmentPromptType.WORD_TO_DEFINITION) {
    return word.definition;
  }
  return word.word;
}

function makeChoices(
  target: BaseWord,
  allWords: BaseWord[],
  promptType: AssignmentPromptType
): string[] {
  const answer = choicePoolValue(target, promptType);
  const answerKey = normalizeText(answer);
  const distractorPool = shuffled(
    allWords.filter((candidate) => candidate.id !== target.id)
  );

  const picked: string[] = [];
  const seen = new Set<string>([answerKey]);

  for (const candidate of distractorPool) {
    const value = choicePoolValue(candidate, promptType);
    const key = normalizeText(value);
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(value);
    if (picked.length >= 3) break;
  }

  return shuffled([answer, ...picked]).slice(0, 4);
}

function buildAssignmentQuestionRows(params: {
  assignmentId: string;
  selectedWords: BaseWord[];
  allWords: BaseWord[];
  mode: AssignmentMode;
}): Prisma.AssignmentQuestionCreateManyInput[] {
  const { assignmentId, selectedWords, allWords, mode } = params;

  return selectedWords.map((word, index) => {
    const promptType = PROMPT_CYCLE[index % PROMPT_CYCLE.length];
    const format = formatForQuestion(mode, index);
    const prompt = promptForQuestion(word, promptType);
    const answerText = answerTextForQuestion(word, promptType);
    const choices =
      format === AssignmentQuestionFormat.MULTIPLE_CHOICE
        ? makeChoices(word, allWords, promptType)
        : null;

    const aliases =
      promptType === AssignmentPromptType.WORD_TO_DEFINITION
        ? [word.definition]
        : [word.word];

    return {
      assignmentId,
      wordId: word.id,
      position: index + 1,
      promptType,
      format,
      prompt,
      subPrompt: subPromptForQuestion(promptType, format),
      choices: choices ?? Prisma.JsonNull,
      answerText,
      answerAliases: aliases,
      sentenceWithBlank:
        promptType === AssignmentPromptType.SENTENCE_CONTEXT ? prompt : null
    };
  });
}

async function ensureTeacherOwnsClass(
  tx: Prisma.TransactionClient,
  teacherId: string,
  classId: string
) {
  const classroom = await tx.classroom.findFirst({
    where: {
      id: classId,
      teacherId
    },
    select: {
      id: true
    }
  });
  if (!classroom) throw new Error("CLASS_NOT_FOUND");
}

export async function createClassroomForTeacher(teacherId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("CLASS_NAME_REQUIRED");

  return prisma.$transaction(async (tx) => {
    const joinCode = await generateUniqueJoinCode(tx);
    return tx.classroom.create({
      data: {
        name: trimmed,
        teacherId,
        joinCode
      }
    });
  });
}

export async function regenerateClassJoinCode(teacherId: string, classId: string) {
  return prisma.$transaction(async (tx) => {
    await ensureTeacherOwnsClass(tx, teacherId, classId);
    const joinCode = await generateUniqueJoinCode(tx);
    return tx.classroom.update({
      where: { id: classId },
      data: { joinCode },
      select: {
        id: true,
        joinCode: true
      }
    });
  });
}

export async function joinClassroomByCode(studentId: string, code: string) {
  const joinCode = code.trim().toUpperCase();
  if (!joinCode) throw new Error("JOIN_CODE_REQUIRED");

  const classroom = await prisma.classroom.findUnique({
    where: { joinCode },
    select: {
      id: true,
      teacherId: true,
      name: true
    }
  });
  if (!classroom) throw new Error("CLASS_NOT_FOUND");
  if (classroom.teacherId === studentId) throw new Error("TEACHER_CANNOT_JOIN_OWN_CLASS");

  const membership = await prisma.classMembership.upsert({
    where: {
      classId_studentId: {
        classId: classroom.id,
        studentId
      }
    },
    create: {
      classId: classroom.id,
      studentId,
      removedAt: null
    },
    update: {
      removedAt: null,
      removedById: null,
      joinedAt: new Date()
    }
  });

  return { classroom, membership };
}

export async function removeStudentFromClass(
  classId: string,
  studentId: string,
  removedById: string
) {
  return prisma.classMembership.update({
    where: {
      classId_studentId: {
        classId,
        studentId
      }
    },
    data: {
      removedAt: new Date(),
      removedById
    }
  });
}

export async function createAssignmentForTeacher(
  teacherId: string,
  input: CreateAssignmentInput
) {
  if (input.questionCount < 1) throw new Error("QUESTION_COUNT_INVALID");

  return prisma.$transaction(async (tx) => {
    await ensureTeacherOwnsClass(tx, teacherId, input.classId);

    let selectedWords: BaseWord[] = [];

    if (input.sourceType === AssignmentSourceType.DIRECT_WORDS) {
      const ids = Array.from(new Set(input.wordIds ?? []));
      if (!ids.length) throw new Error("ASSIGNMENT_WORDS_REQUIRED");

      const words = await tx.word.findMany({
        where: {
          id: { in: ids }
        },
        select: {
          id: true,
          word: true,
          definition: true,
          exampleSentence: true
        }
      });

      const map = new Map(words.map((word) => [word.id, word]));
      selectedWords = ids
        .map((id) => map.get(id))
        .filter((value): value is BaseWord => Boolean(value));
    } else {
      const sourceGroup = input.sourceLabel?.trim();
      if (!sourceGroup) throw new Error("SOURCE_GROUP_REQUIRED");
      selectedWords = await tx.word.findMany({
        where: { sourceGroup },
        select: {
          id: true,
          word: true,
          definition: true,
          exampleSentence: true
        },
        orderBy: { word: "asc" }
      });
    }

    if (selectedWords.length < input.questionCount) {
      throw new Error("NOT_ENOUGH_WORDS");
    }

    const assignmentWords = selectedWords.slice(0, input.questionCount);
    const allWords = await tx.word.findMany({
      select: {
        id: true,
        word: true,
        definition: true,
        exampleSentence: true
      }
    });

    const createdAssignment = await tx.assignment.create({
      data: {
        classId: input.classId,
        teacherId,
        title: input.title.trim(),
        instructions: input.instructions?.trim() || null,
        dueAt: input.dueAt,
        allowLateSubmissions: input.allowLateSubmissions,
        questionCount: assignmentWords.length,
        mode: input.mode,
        sourceType: input.sourceType,
        sourceLabel: input.sourceLabel?.trim() || null
      },
      select: {
        id: true
      }
    });

    await tx.assignmentWord.createMany({
      data: assignmentWords.map((word, index) => ({
        assignmentId: createdAssignment.id,
        wordId: word.id,
        position: index + 1
      }))
    });

    const questionRows = buildAssignmentQuestionRows({
      assignmentId: createdAssignment.id,
      selectedWords: assignmentWords,
      allWords,
      mode: input.mode
    });

    await tx.assignmentQuestion.createMany({
      data: questionRows
    });

    return createdAssignment.id;
  });
}

export async function updateAssignmentSettings(
  teacherId: string,
  assignmentId: string,
  patch: {
    dueAt?: Date;
    instructions?: string | null;
    allowLateSubmissions?: boolean;
  }
) {
  const assignment = await prisma.assignment.findFirst({
    where: {
      id: assignmentId,
      teacherId
    },
    select: {
      id: true
    }
  });
  if (!assignment) throw new Error("ASSIGNMENT_NOT_FOUND");

  return prisma.assignment.update({
    where: { id: assignmentId },
    data: {
      dueAt: patch.dueAt,
      instructions: patch.instructions,
      allowLateSubmissions: patch.allowLateSubmissions
    }
  });
}

function isAnswerCorrect(
  question: {
    format: AssignmentQuestionFormat;
    answerText: string;
    answerAliases: Prisma.JsonValue | null;
  },
  answer: string
): boolean {
  const normalizedAnswer = normalizeText(answer);
  if (!normalizedAnswer) return false;

  if (question.format === AssignmentQuestionFormat.MULTIPLE_CHOICE) {
    return normalizeText(question.answerText) === normalizedAnswer;
  }

  const aliases = [question.answerText, ...jsonToStringArray(question.answerAliases)];
  return aliases.some((alias) => normalizeText(alias) === normalizedAnswer);
}

async function recomputeAttemptSummary(
  tx: Prisma.TransactionClient,
  attemptId: string
) {
  const responses = await tx.assignmentResponse.findMany({
    where: { attemptId },
    select: {
      attempts: true,
      responseMs: true,
      firstCorrect: true,
      isCorrect: true,
      completedAt: true
    }
  });

  const questionsCompleted = responses.filter((response) => response.completedAt).length;
  const firstTryCorrect = responses.filter((response) => response.firstCorrect === true).length;
  const finalCorrect = responses.filter((response) => response.isCorrect === true).length;
  const totalAttempts = responses.reduce((sum, response) => sum + response.attempts, 0);
  const totalResponseMs = responses.reduce((sum, response) => sum + response.responseMs, 0);

  return tx.assignmentAttempt.update({
    where: { id: attemptId },
    data: {
      questionsCompleted,
      firstTryCorrect,
      finalCorrect,
      totalAttempts,
      totalResponseMs
    }
  });
}

async function applyAttemptToMastery(
  tx: Prisma.TransactionClient,
  attemptId: string
) {
  const attempt = await tx.assignmentAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      studentId: true,
      masteryAppliedAt: true,
      responses: {
        where: {
          completedAt: { not: null },
          attempts: { gt: 0 }
        },
        select: {
          wordId: true,
          responseMs: true,
          isCorrect: true,
          firstCorrect: true
        }
      }
    }
  });

  if (!attempt || attempt.masteryAppliedAt) return;

  const now = new Date();
  for (const response of attempt.responses) {
    const existing = await tx.userWordProgress.findUnique({
      where: {
        userId_wordId: {
          userId: attempt.studentId,
          wordId: response.wordId
        }
      }
    });

    const previousAttempts = existing?.attempts ?? 0;
    const newAttempts = previousAttempts + 1;
    const previousAverage = existing?.averageResponseMs ?? 0;
    const averageResponseMs =
      ((previousAverage * previousAttempts + response.responseMs) / newAttempts) || 0;

    const correct = response.isCorrect === true;
    const masteryDelta = correct ? (response.firstCorrect ? 8 : 4) : -6;
    const masteryScore = clamp((existing?.masteryScore ?? 0) + masteryDelta, 0, 100);
    const correctAnswers = (existing?.correctAnswers ?? 0) + (correct ? 1 : 0);
    const incorrectAnswers = (existing?.incorrectAnswers ?? 0) + (correct ? 0 : 1);

    await tx.userWordProgress.upsert({
      where: {
        userId_wordId: {
          userId: attempt.studentId,
          wordId: response.wordId
        }
      },
      create: {
        userId: attempt.studentId,
        wordId: response.wordId,
        masteryScore,
        attempts: newAttempts,
        correctAnswers,
        incorrectAnswers,
        lastReviewed: now,
        averageResponseMs,
        lastResponseMs: response.responseMs,
        needsRetry: !correct,
        isWeak: masteryScore < 45,
        missedCount: correct ? 0 : 1,
        lastResult: correct ? "correct" : "incorrect"
      },
      update: {
        masteryScore,
        attempts: newAttempts,
        correctAnswers,
        incorrectAnswers,
        lastReviewed: now,
        averageResponseMs,
        lastResponseMs: response.responseMs,
        needsRetry: !correct,
        isWeak: masteryScore < 45,
        missedCount: (existing?.missedCount ?? 0) + (correct ? 0 : 1),
        lastResult: correct ? "correct" : "incorrect"
      }
    });
  }

  await tx.assignmentAttempt.update({
    where: { id: attempt.id },
    data: {
      masteryAppliedAt: now
    }
  });
}

async function submitAttemptInternal(params: {
  tx: Prisma.TransactionClient;
  attemptId: string;
  allowLateSubmissions: boolean;
  dueAt: Date;
  kind: SubmissionKind;
}) {
  const { tx, attemptId, allowLateSubmissions, dueAt } = params;
  const now = new Date();
  const duePassed = now.getTime() > dueAt.getTime();
  const kind =
    duePassed && !allowLateSubmissions ? SubmissionKind.AUTO_SUBMIT : params.kind;
  const submittedLate = duePassed && allowLateSubmissions;

  await recomputeAttemptSummary(tx, attemptId);
  const updated = await tx.assignmentAttempt.update({
    where: { id: attemptId },
    data: {
      submittedAt: now,
      submissionKind: kind,
      submittedLate,
      autoSubmittedAt: kind === SubmissionKind.AUTO_SUBMIT ? now : null,
      lastActivityAt: now
    }
  });

  await applyAttemptToMastery(tx, attemptId);
  return updated;
}

export async function autoSubmitOverdueAttemptsForStudent(studentId: string) {
  const overdue = await prisma.assignmentAttempt.findMany({
    where: {
      studentId,
      startedAt: { not: null },
      submittedAt: null,
      assignment: {
        allowLateSubmissions: false,
        dueAt: { lt: new Date() }
      }
    },
    select: {
      id: true,
      assignment: {
        select: {
          dueAt: true,
          allowLateSubmissions: true
        }
      }
    }
  });

  if (!overdue.length) return 0;

  await prisma.$transaction(async (tx) => {
    for (const attempt of overdue) {
      await submitAttemptInternal({
        tx,
        attemptId: attempt.id,
        dueAt: attempt.assignment.dueAt,
        allowLateSubmissions: attempt.assignment.allowLateSubmissions,
        kind: SubmissionKind.AUTO_SUBMIT
      });
    }
  });

  return overdue.length;
}

export async function autoSubmitOverdueAttemptsForAssignment(assignmentId: string) {
  const overdue = await prisma.assignmentAttempt.findMany({
    where: {
      assignmentId,
      startedAt: { not: null },
      submittedAt: null,
      assignment: {
        allowLateSubmissions: false,
        dueAt: { lt: new Date() }
      }
    },
    select: {
      id: true,
      assignment: {
        select: {
          dueAt: true,
          allowLateSubmissions: true
        }
      }
    }
  });

  if (!overdue.length) return 0;

  await prisma.$transaction(async (tx) => {
    for (const attempt of overdue) {
      await submitAttemptInternal({
        tx,
        attemptId: attempt.id,
        dueAt: attempt.assignment.dueAt,
        allowLateSubmissions: attempt.assignment.allowLateSubmissions,
        kind: SubmissionKind.AUTO_SUBMIT
      });
    }
  });

  return overdue.length;
}

export async function startAssignmentAttempt(studentId: string, assignmentId: string) {
  return prisma.$transaction(async (tx) => {
    const assignment = await tx.assignment.findUnique({
      where: { id: assignmentId },
      select: {
        id: true,
        classId: true,
        dueAt: true,
        allowLateSubmissions: true,
        questionCount: true,
        questions: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            position: true,
            wordId: true
          }
        },
        classroom: {
          select: {
            memberships: {
              where: {
                studentId,
                removedAt: null
              },
              select: { id: true }
            }
          }
        }
      }
    });

    if (!assignment) throw new Error("ASSIGNMENT_NOT_FOUND");
    const hasMembership = assignment.classroom.memberships.length > 0;
    if (!hasMembership) throw new Error("NOT_IN_CLASS");

    if (!assignment.allowLateSubmissions && Date.now() > assignment.dueAt.getTime()) {
      throw new Error("ASSIGNMENT_LOCKED");
    }

    const existing = await tx.assignmentAttempt.findUnique({
      where: {
        assignmentId_studentId: {
          assignmentId,
          studentId
        }
      },
      select: {
        id: true,
        submittedAt: true,
        startedAt: true
      }
    });

    let attemptId = existing?.id;
    if (!attemptId) {
      const created = await tx.assignmentAttempt.create({
        data: {
          assignmentId,
          classId: assignment.classId,
          studentId,
          startedAt: new Date(),
          lastActivityAt: new Date(),
          totalQuestions: assignment.questionCount
        },
        select: { id: true }
      });
      attemptId = created.id;
    } else if (existing && !existing.submittedAt && !existing.startedAt) {
      await tx.assignmentAttempt.update({
        where: { id: attemptId },
        data: {
          startedAt: new Date(),
          lastActivityAt: new Date()
        }
      });
    }

    if (!attemptId) throw new Error("ATTEMPT_START_FAILED");

    await tx.assignmentResponse.createMany({
      data: assignment.questions.map((question) => ({
        attemptId,
        questionId: question.id,
        questionPosition: question.position,
        wordId: question.wordId
      })),
      skipDuplicates: true
    });

    if (!existing) {
      await tx.assignment.update({
        where: { id: assignmentId },
        data: {
          firstStartedAt: new Date()
        }
      });
    }

    return tx.assignmentAttempt.findUnique({
      where: { id: attemptId },
      include: {
        responses: true
      }
    });
  });
}

export async function submitAssignmentAnswer(params: {
  studentId: string;
  assignmentId: string;
  questionId: string;
  answer: string;
  responseMs: number;
}) {
  const { studentId, assignmentId, questionId } = params;
  const answer = params.answer.trim();
  const responseMs = clamp(Math.round(params.responseMs), 250, 120000);
  if (!answer) throw new Error("ANSWER_REQUIRED");

  await autoSubmitOverdueAttemptsForStudent(studentId);

  return prisma.$transaction(async (tx) => {
    const attempt = await tx.assignmentAttempt.findUnique({
      where: {
        assignmentId_studentId: {
          assignmentId,
          studentId
        }
      },
      include: {
        assignment: {
          select: {
            dueAt: true,
            allowLateSubmissions: true
          }
        }
      }
    });

    if (!attempt) throw new Error("ATTEMPT_NOT_FOUND");
    if (!attempt.startedAt) throw new Error("ATTEMPT_NOT_STARTED");
    if (attempt.submittedAt) throw new Error("ATTEMPT_ALREADY_SUBMITTED");

    if (!attempt.assignment.allowLateSubmissions && Date.now() > attempt.assignment.dueAt.getTime()) {
      await submitAttemptInternal({
        tx,
        attemptId: attempt.id,
        dueAt: attempt.assignment.dueAt,
        allowLateSubmissions: attempt.assignment.allowLateSubmissions,
        kind: SubmissionKind.AUTO_SUBMIT
      });
      throw new Error("ASSIGNMENT_AUTO_SUBMITTED");
    }

    const question = await tx.assignmentQuestion.findFirst({
      where: {
        id: questionId,
        assignmentId
      },
      select: {
        id: true,
        answerText: true,
        answerAliases: true,
        format: true
      }
    });
    if (!question) throw new Error("QUESTION_NOT_FOUND");

    const response = await tx.assignmentResponse.findUnique({
      where: {
        attemptId_questionId: {
          attemptId: attempt.id,
          questionId: question.id
        }
      }
    });
    if (!response) throw new Error("RESPONSE_ROW_NOT_FOUND");

    if (response.completedAt) {
      return {
        alreadyCompleted: true,
        correct: response.isCorrect === true,
        needsRetry: false,
        attempts: response.attempts,
        answerText: question.answerText
      };
    }

    const currentAttempts = response.attempts;
    const nextAttempts = currentAttempts + 1;
    const correct = isAnswerCorrect(question, answer);
    const completed = correct || nextAttempts >= 2;
    const firstCorrect =
      currentAttempts === 0 ? correct : response.firstCorrect ?? false;

    await tx.assignmentResponse.update({
      where: { id: response.id },
      data: {
        firstAnswer: currentAttempts === 0 ? answer : response.firstAnswer,
        finalAnswer: answer,
        firstCorrect,
        isCorrect: completed ? correct : null,
        attempts: nextAttempts,
        responseMs: response.responseMs + responseMs,
        completedAt: completed ? new Date() : null
      }
    });

    await recomputeAttemptSummary(tx, attempt.id);
    await tx.assignmentAttempt.update({
      where: { id: attempt.id },
      data: {
        lastActivityAt: new Date()
      }
    });

    return {
      alreadyCompleted: false,
      correct,
      needsRetry: !correct && !completed,
      attempts: nextAttempts,
      answerText: question.answerText
    };
  });
}

export async function submitAssignmentAttempt(
  studentId: string,
  assignmentId: string
) {
  await autoSubmitOverdueAttemptsForStudent(studentId);

  return prisma.$transaction(async (tx) => {
    const attempt = await tx.assignmentAttempt.findUnique({
      where: {
        assignmentId_studentId: {
          assignmentId,
          studentId
        }
      },
      include: {
        assignment: {
          select: {
            dueAt: true,
            allowLateSubmissions: true
          }
        }
      }
    });

    if (!attempt) throw new Error("ATTEMPT_NOT_FOUND");
    if (!attempt.startedAt) throw new Error("ATTEMPT_NOT_STARTED");
    if (attempt.submittedAt) return attempt;

    return submitAttemptInternal({
      tx,
      attemptId: attempt.id,
      dueAt: attempt.assignment.dueAt,
      allowLateSubmissions: attempt.assignment.allowLateSubmissions,
      kind: SubmissionKind.STUDENT_SUBMIT
    });
  });
}
