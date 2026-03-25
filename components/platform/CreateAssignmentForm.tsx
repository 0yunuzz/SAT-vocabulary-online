"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface ClassOption {
  id: string;
  name: string;
}

interface WordOption {
  id: number;
  word: string;
  sourceGroup: string | null;
}

interface CreateAssignmentFormProps {
  classes: ClassOption[];
  words: WordOption[];
  sourceGroups: string[];
  defaultClassId?: string;
}

type AssignmentModeValue = "MULTIPLE_CHOICE" | "TYPED_RESPONSE" | "MIXED";
type SourceTypeValue = "DIRECT_WORDS" | "SOURCE_GROUP";

export function CreateAssignmentForm({
  classes,
  words,
  sourceGroups,
  defaultClassId
}: CreateAssignmentFormProps) {
  const router = useRouter();
  const hasSourceGroups = sourceGroups.length > 0;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [classId, setClassId] = useState(defaultClassId ?? classes[0]?.id ?? "");
  const [dueAtLocal, setDueAtLocal] = useState("");
  const [allowLate, setAllowLate] = useState(false);
  const [questionCount, setQuestionCount] = useState(20);
  const [mode, setMode] = useState<AssignmentModeValue>("MIXED");
  const [sourceType, setSourceType] = useState<SourceTypeValue>("DIRECT_WORDS");
  const [sourceGroup, setSourceGroup] = useState(sourceGroups[0] ?? "");
  const [wordInput, setWordInput] = useState("");

  const wordMap = useMemo(
    () =>
      new Map(
        words.map((word) => [word.word.trim().toLowerCase(), word.id])
      ),
    [words]
  );

  const buildWordIds = (): number[] => {
    const tokens = wordInput
      .split(/[\n,]+/)
      .map((token) => token.trim().toLowerCase())
      .filter(Boolean);
    const ids: number[] = [];

    for (const token of tokens) {
      const id = wordMap.get(token);
      if (id) ids.push(id);
    }

    return Array.from(new Set(ids));
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setBusy(true);

    try {
      if (!classId) throw new Error("Choose a class.");
      if (!dueAtLocal) throw new Error("Choose a due date and time.");
      if (!title.trim()) throw new Error("Assignment title is required.");

      const dueDate = new Date(dueAtLocal);
      if (Number.isNaN(dueDate.getTime())) throw new Error("Invalid due date.");

      let wordIds: number[] | undefined;
      if (sourceType === "DIRECT_WORDS") {
        wordIds = buildWordIds();
        if (!wordIds.length) {
          throw new Error("Add at least one valid word for direct assignment.");
        }
      } else if (!sourceGroup) {
        throw new Error("Choose a source group.");
      }

      const response = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          instructions,
          classId,
          dueAt: dueDate.toISOString(),
          allowLateSubmissions: allowLate,
          questionCount,
          mode,
          sourceType,
          sourceLabel: sourceType === "SOURCE_GROUP" ? sourceGroup : undefined,
          wordIds
        })
      });
      const payload = (await response.json()) as { error?: string; assignmentId?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not create assignment.");
      }

      if (payload.assignmentId) {
        router.push(`/teacher/assignments/${payload.assignmentId}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create assignment.");
      setBusy(false);
      return;
    }

    setBusy(false);
  };

  return (
    <form className="panel form-panel" onSubmit={onSubmit}>
      <h3>Create assignment</h3>

      <label className="field">
        <span>Title</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>

      <label className="field">
        <span>Instructions (optional)</span>
        <textarea
          className="input-textarea"
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          rows={4}
        />
      </label>

      <div className="field-row">
        <label className="field">
          <span>Class</span>
          <select value={classId} onChange={(event) => setClassId(event.target.value)}>
            {classes.map((classroom) => (
              <option key={classroom.id} value={classroom.id}>
                {classroom.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Due date & time</span>
          <input
            type="datetime-local"
            value={dueAtLocal}
            onChange={(event) => setDueAtLocal(event.target.value)}
          />
        </label>
      </div>

      <div className="field-row">
        <label className="field">
          <span>Question count</span>
          <input
            type="number"
            min={1}
            max={150}
            value={questionCount}
            onChange={(event) => setQuestionCount(Number(event.target.value))}
          />
        </label>
        <label className="field">
          <span>Mode</span>
          <select value={mode} onChange={(event) => setMode(event.target.value as AssignmentModeValue)}>
            <option value="MULTIPLE_CHOICE">Multiple choice</option>
            <option value="TYPED_RESPONSE">Typed response</option>
            <option value="MIXED">Mixed</option>
          </select>
        </label>
      </div>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={allowLate}
          onChange={(event) => setAllowLate(event.target.checked)}
        />
        Allow late submissions
      </label>

      <label className="field">
        <span>Assignment source</span>
        <select
          value={sourceType}
          onChange={(event) => setSourceType(event.target.value as SourceTypeValue)}
        >
          <option value="DIRECT_WORDS">Specific words</option>
          {hasSourceGroups ? <option value="SOURCE_GROUP">Vocab group/list</option> : null}
        </select>
      </label>
      {!hasSourceGroups ? (
        <p className="small-note">
          No source groups are available in the current vocabulary file, so assignments use direct words.
        </p>
      ) : null}

      {sourceType === "DIRECT_WORDS" ? (
        <label className="field">
          <span>Words (comma or newline separated)</span>
          <textarea
            className="input-textarea"
            value={wordInput}
            onChange={(event) => setWordInput(event.target.value)}
            rows={5}
            placeholder="abate, aberration, abstain"
          />
        </label>
      ) : (
        <label className="field">
          <span>Source group</span>
          <select value={sourceGroup} onChange={(event) => setSourceGroup(event.target.value)}>
            {sourceGroups.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>
        </label>
      )}

      <button className="btn primary" type="submit" disabled={busy}>
        {busy ? "Creating..." : "Create Assignment"}
      </button>
      {error ? <p className="error-copy">{error}</p> : null}
    </form>
  );
}
