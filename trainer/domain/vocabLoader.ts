import { VocabLoadResult, VocabLoadWarning, VocabWord } from "../types";
import { parseCsv } from "../utils/csv";
import { normalizeAnswer, normalizeWhitespace, splitListValue, toSlug } from "../utils/text";

interface RawVocabRow {
  word?: string;
  definition?: string;
  example_sentence?: string;
  part_of_speech?: string;
  synonyms?: string | string[];
  difficulty?: string | number;
  source_group?: string;
  notes?: string;
}

const requiredFields = ["word", "definition", "example_sentence"];

const toWord = (
  row: RawVocabRow,
  index: number,
  warnings: VocabLoadWarning[],
  sourceLabel: string
): VocabWord | null => {
  const word = normalizeWhitespace(String(row.word ?? ""));
  const definition = normalizeWhitespace(String(row.definition ?? ""));
  const exampleSentence = normalizeWhitespace(String(row.example_sentence ?? ""));

  if (!word || !definition || !exampleSentence) {
    warnings.push({
      row: index,
      message: `${sourceLabel}: missing required field(s). Required: word, definition, example_sentence.`,
    });
    return null;
  }

  const synonyms = Array.isArray(row.synonyms)
    ? row.synonyms.map((item) => normalizeWhitespace(item)).filter(Boolean)
    : splitListValue(typeof row.synonyms === "string" ? row.synonyms : "");

  const parsedDifficulty = Number(row.difficulty);
  const difficulty = Number.isFinite(parsedDifficulty) ? parsedDifficulty : undefined;

  return {
    id: `${toSlug(word)}-${index}`,
    word,
    definition,
    exampleSentence,
    partOfSpeech: normalizeWhitespace(String(row.part_of_speech ?? "")) || undefined,
    synonyms,
    difficulty,
    sourceGroup: normalizeWhitespace(String(row.source_group ?? "")) || undefined,
    notes: normalizeWhitespace(String(row.notes ?? "")) || undefined,
    normalizedWord: normalizeAnswer(word),
    normalizedDefinition: normalizeAnswer(definition),
    firstLetter: word.slice(0, 1).toUpperCase(),
  };
};

const dedupeWords = (words: VocabWord[], warnings: VocabLoadWarning[]): VocabWord[] => {
  const seen = new Map<string, VocabWord>();

  for (const word of words) {
    const key = word.normalizedWord;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, word);
      continue;
    }

    warnings.push({
      row: 0,
      message: `Duplicate word "${word.word}" found. Keeping the first occurrence.`,
    });

    if (!existing.partOfSpeech && word.partOfSpeech) {
      existing.partOfSpeech = word.partOfSpeech;
    }
    if (!existing.synonyms.length && word.synonyms.length) {
      existing.synonyms = [...word.synonyms];
    }
    if (!existing.sourceGroup && word.sourceGroup) {
      existing.sourceGroup = word.sourceGroup;
    }
    if (!existing.notes && word.notes) {
      existing.notes = word.notes;
    }
  }

  return Array.from(seen.values()).map((entry, idx) => ({
    ...entry,
    id: `${toSlug(entry.word)}-${idx + 1}`,
  }));
};

const parseCsvVocab = (raw: string): VocabLoadResult => {
  const parsed = parseCsv(raw);
  const warnings: VocabLoadWarning[] = parsed.warnings.map((message) => ({ row: 0, message }));

  if (!parsed.headers.length) {
    return {
      words: [],
      warnings: [...warnings, { row: 0, message: "CSV is missing a header row." }],
      source: "csv",
    };
  }

  const missingFields = requiredFields.filter((field) => !parsed.headers.includes(field));
  if (missingFields.length) {
    return {
      words: [],
      warnings: [
        ...warnings,
        {
          row: 0,
          message: `CSV is missing required columns: ${missingFields.join(", ")}.`,
        },
      ],
      source: "csv",
    };
  }

  const words: VocabWord[] = [];

  parsed.rows.forEach((row, rowIndex) => {
    const obj: Record<string, string> = {};
    parsed.headers.forEach((header, index) => {
      obj[header] = row[index] ?? "";
    });

    const word = toWord(obj, rowIndex + 2, warnings, "CSV row");
    if (word) {
      words.push(word);
    }
  });

  return {
    words: dedupeWords(words, warnings),
    warnings,
    source: "csv",
  };
};

const parseJsonVocab = (raw: string): VocabLoadResult => {
  const warnings: VocabLoadWarning[] = [];
  let jsonData: unknown;

  try {
    jsonData = JSON.parse(raw);
  } catch {
    return {
      words: [],
      warnings: [{ row: 0, message: "JSON file could not be parsed." }],
      source: "json",
    };
  }

  if (!Array.isArray(jsonData)) {
    return {
      words: [],
      warnings: [{ row: 0, message: "JSON vocab must be an array of objects." }],
      source: "json",
    };
  }

  const words: VocabWord[] = [];
  jsonData.forEach((item, index) => {
    const word = toWord(item as RawVocabRow, index + 1, warnings, "JSON row");
    if (word) {
      words.push(word);
    }
  });

  return {
    words: dedupeWords(words, warnings),
    warnings,
    source: "json",
  };
};

const fetchIfExists = async (path: string): Promise<Response | null> => {
  try {
    const response = await fetch(path, { cache: "no-store" });
    return response.ok ? response : null;
  } catch {
    return null;
  }
};

export const loadVocabulary = async (): Promise<VocabLoadResult> => {
  const csvResponse = await fetchIfExists("/data/sat_vocab.csv");
  if (csvResponse) {
    const text = await csvResponse.text();
    return parseCsvVocab(text);
  }

  const fallbackCsvResponse = await fetchIfExists("/data/vocab.csv");
  if (fallbackCsvResponse) {
    const text = await fallbackCsvResponse.text();
    return parseCsvVocab(text);
  }

  const jsonResponse = await fetchIfExists("/data/sat_vocab.json");
  if (jsonResponse) {
    const text = await jsonResponse.text();
    return parseJsonVocab(text);
  }

  const fallbackJsonResponse = await fetchIfExists("/data/vocab.json");
  if (fallbackJsonResponse) {
    const text = await fallbackJsonResponse.text();
    return parseJsonVocab(text);
  }

  return {
    words: [],
    warnings: [
      {
        row: 0,
        message:
          "No vocabulary file found. Place sat_vocab.csv or vocab.csv in public/data/."
      }
    ],
    source: "csv"
  };
};
