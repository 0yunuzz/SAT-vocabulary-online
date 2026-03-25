export interface ParsedCsvResult {
  headers: string[];
  rows: string[][];
  warnings: string[];
}

const parseLineCells = (line: string): string[] => {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
};

export const parseCsv = (raw: string): ParsedCsvResult => {
  const warnings: string[] = [];
  const lines: string[] = [];
  let currentLine = "";
  let inQuotes = false;

  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i];
    const next = raw[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentLine += '""';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      currentLine += char;
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      lines.push(currentLine);
      currentLine = "";
      continue;
    }

    currentLine += char;
  }

  if (currentLine.trim().length) {
    lines.push(currentLine);
  }

  if (inQuotes) {
    warnings.push("CSV appears to have an unmatched quote near the end of file.");
  }

  const nonBlankLines = lines.filter((line) => line.trim().length > 0);
  if (!nonBlankLines.length) {
    return { headers: [], rows: [], warnings: ["CSV file is empty."] };
  }

  const headers = parseLineCells(nonBlankLines[0]).map((header) =>
    header
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
      .toLowerCase()
      .replace(/\s+/g, "_")
  );

  const rows: string[][] = [];
  for (let i = 1; i < nonBlankLines.length; i += 1) {
    const row = parseLineCells(nonBlankLines[i]);
    if (row.every((cell) => cell.trim() === "")) {
      continue;
    }
    if (row.length < headers.length) {
      warnings.push(`Row ${i + 1} has ${row.length} columns but expected ${headers.length}.`);
    }
    rows.push(row);
  }

  return { headers, rows, warnings };
};
