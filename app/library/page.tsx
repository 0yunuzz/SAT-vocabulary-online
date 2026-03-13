"use client";

import { useMemo, useState } from "react";
import { ModeBadge } from "@/components/mode-badge";
import { useStudyData } from "@/utils/use-study-data";
import { useVocabWords } from "@/utils/use-vocab-words";

export default function LibraryPage() {
  const { words, loading, error } = useVocabWords();
  const { snapshot, toggleBookmark, mode, syncStatus } = useStudyData();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return words;
    return words.filter(
      (entry) =>
        entry.word.toLowerCase().includes(query) ||
        entry.definition.toLowerCase().includes(query) ||
        entry.exampleSentence.toLowerCase().includes(query)
    );
  }, [search, words]);

  return (
    <>
      <section className="panel splitColumns">
        <div>
          <h2>Word Library</h2>
          <ModeBadge mode={mode} syncStatus={syncStatus} />
        </div>
        <div>
          <label className="eyebrow" htmlFor="search">
            Search words
          </label>
          <input
            id="search"
            type="search"
            placeholder="Search by word, definition, or sentence"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </section>

      {loading ? (
        <section className="panel">
          <p>Loading vocabulary dataset...</p>
        </section>
      ) : null}
      {error ? (
        <section className="panel">
          <p>{error}</p>
        </section>
      ) : null}

      <section className="panel">
        <p className="muted">
          Showing {filtered.length} of {words.length} words
        </p>
        <div className="libraryList">
          {filtered.map((entry) => {
            const progress = snapshot.wordProgress[entry.word];
            const bookmarked = snapshot.bookmarks.includes(entry.word);
            return (
              <article className="libraryItem" key={entry.word}>
                <div className="buttonRow">
                  <strong>{entry.word}</strong>
                  <span className="pill">
                    Mastery {progress ? Math.round(progress.masteryScore * 100) : 0}%
                  </span>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => toggleBookmark(entry.word)}
                  >
                    {bookmarked ? "Bookmarked" : "Bookmark"}
                  </button>
                </div>
                <p>{entry.definition}</p>
                <p className="muted">{entry.exampleSentence}</p>
                <p className="muted">
                  Attempts: {progress?.attempts ?? 0} | Correct:{" "}
                  {progress?.correctAnswers ?? 0} | Incorrect:{" "}
                  {progress?.incorrectAnswers ?? 0}
                </p>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
