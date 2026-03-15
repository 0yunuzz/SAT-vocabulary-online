import { FormEvent, useMemo, useState } from "react";
import { classifyWordSets } from "../domain/adaptive";
import { modeLabels } from "../domain/session";
import { AppData, AppSettings, PracticeMode, QuestionType, SessionConfig, VocabWord } from "../types";

interface SetupPageProps {
  words: VocabWord[];
  appData: AppData;
  settings: AppSettings;
  lastConfig?: SessionConfig;
  onStartSession: (config: SessionConfig) => void;
}

const baseModes: PracticeMode[] = [
  "word_to_definition",
  "definition_to_word",
  "sentence_context",
  "mixed",
  "missed_words",
  "weak_words",
  "bookmarked_words",
  "recent_words",
  "custom",
];

const questionTypeOptions: QuestionType[] = [
  "word_to_definition_mc",
  "definition_to_word_mc",
  "sentence_context_mc",
];

const typeLabel: Record<QuestionType, string> = {
  word_to_definition_mc: "Word to definition",
  definition_to_word_mc: "Definition to word",
  sentence_context_mc: "Sentence context",
};

export const SetupPage = ({ words, appData, settings, lastConfig, onStartSession }: SetupPageProps) => {
  const [mode, setMode] = useState<PracticeMode>(lastConfig?.mode ?? "mixed");
  const [questionCount, setQuestionCount] = useState<number>(lastConfig?.questionCount ?? settings.defaultQuestionCount);
  const [timerMode, setTimerMode] = useState(lastConfig?.timerMode ?? settings.timerMode);
  const [questionLimit, setQuestionLimit] = useState(lastConfig?.questionTimeLimitSec ?? settings.questionTimeLimitSec);
  const [sessionLimit, setSessionLimit] = useState(lastConfig?.sessionTimeLimitSec ?? settings.sessionTimeLimitSec);
  const [customBucket, setCustomBucket] = useState(lastConfig?.customBucket ?? "all");
  const [manualStart, setManualStart] = useState<number | "">(lastConfig?.manualRangeStart ?? "");
  const [manualEnd, setManualEnd] = useState<number | "">(lastConfig?.manualRangeEnd ?? "");
  const [firstLetter, setFirstLetter] = useState(lastConfig?.firstLetterFilter ?? "");
  const [sourceGroup, setSourceGroup] = useState(lastConfig?.sourceGroupFilter ?? "");
  const [customTypes, setCustomTypes] = useState<QuestionType[]>(
    lastConfig?.customQuestionTypes.length
      ? lastConfig.customQuestionTypes
      : ["word_to_definition_mc", "definition_to_word_mc", "sentence_context_mc"]
  );

  const groups = useMemo(
    () => [...new Set(words.map((word) => word.sourceGroup).filter(Boolean))] as string[],
    [words]
  );

  const letters = useMemo(
    () => [...new Set(words.map((word) => word.firstLetter))].sort(),
    [words]
  );

  const statusCounts = useMemo(() => classifyWordSets(words, appData), [words, appData]);

  const toggleCustomType = (type: QuestionType) => {
    setCustomTypes((current) => {
      if (current.includes(type)) {
        const next = current.filter((entry) => entry !== type);
        return next.length ? next : current;
      }
      return [...current, type];
    });
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const config: SessionConfig = {
      mode,
      questionCount: Math.max(5, Math.min(200, Number(questionCount) || settings.defaultQuestionCount)),
      timerMode,
      customBucket,
      manualRangeStart: manualStart === "" ? undefined : Number(manualStart),
      manualRangeEnd: manualEnd === "" ? undefined : Number(manualEnd),
      firstLetterFilter: firstLetter || undefined,
      sourceGroupFilter: sourceGroup || undefined,
      customQuestionTypes: customTypes,
      questionTimeLimitSec: Math.max(5, Number(questionLimit) || settings.questionTimeLimitSec),
      sessionTimeLimitSec: Math.max(60, Number(sessionLimit) || settings.sessionTimeLimitSec),
    };

    onStartSession(config);
  };

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h2>Practice Setup</h2>
          <p>Choose a focused mode, then launch a session in one click.</p>
        </div>
      </header>

      <div className="setup-layout">
        <form className="panel form-panel" onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="mode">Study mode</label>
            <select id="mode" value={mode} onChange={(event) => setMode(event.target.value as PracticeMode)}>
              {baseModes.map((entry) => (
                <option key={entry} value={entry}>
                  {modeLabels[entry]}
                </option>
              ))}
            </select>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="count">Session size</label>
              <input
                id="count"
                type="number"
                min={5}
                max={200}
                value={questionCount}
                onChange={(event) => setQuestionCount(Number(event.target.value))}
              />
            </div>

            <div className="field">
              <label htmlFor="timerMode">Timer</label>
              <select id="timerMode" value={timerMode} onChange={(event) => setTimerMode(event.target.value as SessionConfig["timerMode"])}>
                <option value="untimed">Untimed</option>
                <option value="question">Per question</option>
                <option value="session">Full session</option>
              </select>
            </div>
          </div>

          {timerMode === "question" ? (
            <div className="field">
              <label htmlFor="questionLimit">Seconds per question</label>
              <input
                id="questionLimit"
                type="number"
                min={5}
                max={120}
                value={questionLimit}
                onChange={(event) => setQuestionLimit(Number(event.target.value))}
              />
            </div>
          ) : null}

          {timerMode === "session" ? (
            <div className="field">
              <label htmlFor="sessionLimit">Session time limit (seconds)</label>
              <input
                id="sessionLimit"
                type="number"
                min={60}
                max={3600}
                value={sessionLimit}
                onChange={(event) => setSessionLimit(Number(event.target.value))}
              />
            </div>
          ) : null}

          {mode === "custom" ? (
            <>
              <div className="field">
                <label htmlFor="customBucket">Word bucket</label>
                <select id="customBucket" value={customBucket} onChange={(event) => setCustomBucket(event.target.value as SessionConfig["customBucket"])}>
                  <option value="all">All words</option>
                  <option value="weak">Weak words</option>
                  <option value="missed">Missed words</option>
                  <option value="bookmarked">Bookmarked words</option>
                  <option value="recent">Recent words</option>
                  <option value="unmastered">Unmastered words</option>
                </select>
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="rangeStart">Manual range start</label>
                  <input
                    id="rangeStart"
                    type="number"
                    min={1}
                    value={manualStart}
                    onChange={(event) => setManualStart(event.target.value ? Number(event.target.value) : "")}
                    placeholder="1"
                  />
                </div>

                <div className="field">
                  <label htmlFor="rangeEnd">Manual range end</label>
                  <input
                    id="rangeEnd"
                    type="number"
                    min={1}
                    value={manualEnd}
                    onChange={(event) => setManualEnd(event.target.value ? Number(event.target.value) : "")}
                    placeholder={String(words.length)}
                  />
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="letterFilter">First letter</label>
                  <select id="letterFilter" value={firstLetter} onChange={(event) => setFirstLetter(event.target.value)}>
                    <option value="">Any</option>
                    {letters.map((letter) => (
                      <option key={letter} value={letter}>
                        {letter}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="groupFilter">Source group</label>
                  <select id="groupFilter" value={sourceGroup} onChange={(event) => setSourceGroup(event.target.value)}>
                    <option value="">Any</option>
                    {groups.map((group) => (
                      <option key={group} value={group}>
                        {group}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <fieldset className="field">
                <legend>Question types</legend>
                <div className="check-grid">
                  {questionTypeOptions.map((type) => (
                    <label key={type} className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={customTypes.includes(type)}
                        onChange={() => toggleCustomType(type)}
                      />
                      {typeLabel[type]}
                    </label>
                  ))}
                </div>
              </fieldset>
            </>
          ) : null}

          <button className="btn primary" type="submit">
            Start Session
          </button>
        </form>

        <aside className="panel setup-side">
          <h3>Deck Snapshot</h3>
          <ul className="metric-list">
            <li>
              <span>Total words</span>
              <strong>{words.length}</strong>
            </li>
            <li>
              <span>Weak words</span>
              <strong>{statusCounts.weak.length}</strong>
            </li>
            <li>
              <span>Mastered words</span>
              <strong>{statusCounts.mastered.length}</strong>
            </li>
            <li>
              <span>Unseen words</span>
              <strong>{statusCounts.unseen.length}</strong>
            </li>
            <li>
              <span>Bookmarked</span>
              <strong>{appData.bookmarks.length}</strong>
            </li>
          </ul>

          <p className="small-note">
            Mixed mode rotates between the three multiple-choice formats and keeps weak words in circulation.
          </p>
        </aside>
      </div>
    </section>
  );
};
