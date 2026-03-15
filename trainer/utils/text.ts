export const normalizeWhitespace = (value: string): string =>
  value.replace(/\s+/g, " ").trim();

export const normalizeAnswer = (value: string): string =>
  normalizeWhitespace(value.toLowerCase().replace(/[.,!?;:"'()\[\]{}]/g, ""));

export const toSlug = (value: string): string =>
  normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const splitListValue = (value?: string): string[] => {
  if (!value) {
    return [];
  }

  return value
    .split(/[;,|]/g)
    .map((item) => normalizeWhitespace(item))
    .filter(Boolean);
};

export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export const average = (values: number[]): number => {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, current) => sum + current, 0) / values.length;
};

export const shuffle = <T>(items: T[]): T[] => {
  const clone = [...items];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
};

export const unique = <T>(items: T[]): T[] => Array.from(new Set(items));

export const levenshteinDistance = (a: string, b: string): number => {
  const left = normalizeAnswer(a);
  const right = normalizeAnswer(b);

  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= right.length; i += 1) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= left.length; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= right.length; i += 1) {
    for (let j = 1; j <= left.length; j += 1) {
      if (right[i - 1] === left[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[right.length][left.length];
};

export const isCloseWordMatch = (attempt: string, answer: string): boolean => {
  const normalizedAttempt = normalizeAnswer(attempt);
  const normalizedAnswer = normalizeAnswer(answer);
  if (!normalizedAttempt || !normalizedAnswer) {
    return false;
  }

  const distance = levenshteinDistance(normalizedAttempt, normalizedAnswer);
  const threshold = normalizedAnswer.length >= 8 ? 2 : 1;
  return distance <= threshold;
};
