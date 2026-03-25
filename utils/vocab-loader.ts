import Papa from "papaparse";
import type { VocabWord } from "@/lib/types";

type CsvRow = Record<string, string | undefined>;

function normalizeHeader(header: string): string {
  return header
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function pickValue(row: CsvRow, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value && value.trim()) return value.trim();
  }
  return "";
}

export function parseVocabCsv(csvText: string): VocabWord[] {
  const parsed = Papa.parse<CsvRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeHeader
  });

  if (parsed.errors.length > 0) {
    const firstError = parsed.errors[0];
    throw new Error(`Unable to parse CSV: ${firstError.message}`);
  }

  const words = parsed.data
    .map((row) => {
      const word = pickValue(row, ["word", "term"]);
      const definition = pickValue(row, ["definition", "meaning"]);
      const exampleSentence = pickValue(row, [
        "example_sentence",
        "sentence",
        "example",
        "context"
      ]);
      const sourceGroup = pickValue(row, [
        "source_group",
        "group",
        "unit",
        "list",
        "category"
      ]);

      if (!word || !definition || !exampleSentence) return null;
      const normalized: VocabWord = {
        word,
        definition,
        exampleSentence
      };
      if (sourceGroup) {
        normalized.sourceGroup = sourceGroup;
      }
      return normalized;
    })
    .filter((item): item is VocabWord => item !== null);

  return words;
}

export async function loadClientWords(): Promise<VocabWord[]> {
  const response = await fetch("/data/sat_vocab.csv");
  if (!response.ok) {
    throw new Error("Unable to load SAT vocabulary dataset.");
  }
  const csvText = await response.text();
  return parseVocabCsv(csvText);
}
