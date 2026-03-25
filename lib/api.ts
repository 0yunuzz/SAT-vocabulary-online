import { NextResponse } from "next/server";

const statusByCode: Record<string, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  CLASS_NOT_FOUND: 404,
  ASSIGNMENT_NOT_FOUND: 404,
  QUESTION_NOT_FOUND: 404,
  ATTEMPT_NOT_FOUND: 404,
  USER_NOT_FOUND: 404,
  ROLE_SELECTION_LOCKED: 403,
  ROLE_NOT_ALLOWED: 403,
  NOT_IN_CLASS: 403,
  ASSIGNMENT_LOCKED: 403,
  ATTEMPT_ALREADY_SUBMITTED: 400,
  ATTEMPT_NOT_STARTED: 400,
  ASSIGNMENT_AUTO_SUBMITTED: 409,
  CLASS_NAME_REQUIRED: 400,
  JOIN_CODE_REQUIRED: 400,
  TEACHER_CANNOT_JOIN_OWN_CLASS: 400,
  QUESTION_COUNT_INVALID: 400,
  ASSIGNMENT_WORDS_REQUIRED: 400,
  SOURCE_GROUP_REQUIRED: 400,
  NOT_ENOUGH_WORDS: 400,
  ANSWER_REQUIRED: 400,
  INVALID_DATE: 400,
  RESPONSE_ROW_NOT_FOUND: 500
};

const messageByCode: Record<string, string> = {
  UNAUTHORIZED: "You must be signed in.",
  FORBIDDEN: "You do not have permission for this action.",
  CLASS_NOT_FOUND: "Class not found.",
  ASSIGNMENT_NOT_FOUND: "Assignment not found.",
  QUESTION_NOT_FOUND: "Question not found.",
  ATTEMPT_NOT_FOUND: "Assignment attempt not found.",
  USER_NOT_FOUND: "User not found.",
  ROLE_SELECTION_LOCKED: "Role selection is locked for this account.",
  ROLE_NOT_ALLOWED: "This role is not allowed.",
  NOT_IN_CLASS: "You are not enrolled in this class.",
  ASSIGNMENT_LOCKED: "This assignment can no longer be started.",
  ATTEMPT_ALREADY_SUBMITTED: "This assignment was already submitted.",
  ATTEMPT_NOT_STARTED: "Start the assignment before submitting answers.",
  ASSIGNMENT_AUTO_SUBMITTED:
    "This assignment reached its due time and was auto-submitted.",
  CLASS_NAME_REQUIRED: "Class name is required.",
  JOIN_CODE_REQUIRED: "Join code is required.",
  TEACHER_CANNOT_JOIN_OWN_CLASS: "Teachers cannot join their own classes as a student.",
  QUESTION_COUNT_INVALID: "Question count must be at least 1.",
  ASSIGNMENT_WORDS_REQUIRED: "Pick at least one word for this assignment.",
  SOURCE_GROUP_REQUIRED: "Pick a source group for this assignment.",
  NOT_ENOUGH_WORDS: "Not enough words match this assignment setup.",
  ANSWER_REQUIRED: "Answer is required.",
  INVALID_DATE: "Invalid date or time.",
  RESPONSE_ROW_NOT_FOUND: "Assignment response state is missing."
};

export function errorCode(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "UNKNOWN_ERROR";
}

export function toErrorResponse(error: unknown) {
  const code = errorCode(error);
  const status = statusByCode[code] ?? 500;
  const message = messageByCode[code] ?? "Unexpected server error.";
  return NextResponse.json({ error: message, code }, { status });
}
