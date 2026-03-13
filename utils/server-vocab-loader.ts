import { promises as fs } from "node:fs";
import path from "node:path";
import type { VocabWord } from "../lib/types";
import { parseVocabCsv } from "./vocab-loader";

export async function loadWordsFromCsvFile(csvPath: string): Promise<VocabWord[]> {
  const content = await fs.readFile(csvPath, "utf8");
  return parseVocabCsv(content);
}

export async function loadWordsFromPublicCsv(): Promise<VocabWord[]> {
  const csvPath = path.join(process.cwd(), "public", "data", "sat_vocab.csv");
  return loadWordsFromCsvFile(csvPath);
}
