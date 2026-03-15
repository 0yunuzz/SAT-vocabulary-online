import { useMemo, useState } from "react";
import { WordDetail } from "../components/WordDetail";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { AppData, VocabWord } from "../types";
import { normalizeAnswer } from "../utils/text";
import { wordStatus } from "../domain/mastery";

type LibraryFilter = "all" | "mastered" | "weak" | "missed" | "unseen" | "bookmarked";

interface LibraryPageProps {
  words: VocabWord[];
  appData: AppData;
  onToggleBookmark: (wordId: string) => void;
}

export const LibraryPage = ({ words, appData, onToggleBookmark }: LibraryPageProps) => {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LibraryFilter>("all");
  const [selectedWordId, setSelectedWordId] = useState<string | undefined>();
  const debouncedQuery = useDebouncedValue(query, 120);

  const bookmarked = useMemo(() => new Set(appData.bookmarks), [appData.bookmarks]);

  const filteredWords = useMemo(() => {
    const normalizedQuery = normalizeAnswer(debouncedQuery);

    return words.filter((word) => {
      const progress = appData.wordProgress[word.id];
      const status = wordStatus(progress);
      const isBookmarked = bookmarked.has(word.id);
      const missed = (progress?.missed ?? 0) > 0;

      const byFilter =
        filter === "all"
          ? true
          : filter === "mastered"
          ? status === "mastered"
          : filter === "weak"
          ? status === "weak"
          : filter === "missed"
          ? missed
          : filter === "unseen"
          ? status === "unseen"
          : isBookmarked;

      if (!byFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return (
        normalizeAnswer(word.word).includes(normalizedQuery) ||
        normalizeAnswer(word.definition).includes(normalizedQuery)
      );
    });
  }, [words, appData.wordProgress, bookmarked, filter, debouncedQuery]);

  const selectedWord = selectedWordId
    ? words.find((word) => word.id === selectedWordId)
    : undefined;

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h2>Word Library</h2>
          <p>Search definitions, inspect mastery, and curate bookmarks.</p>
        </div>
      </header>

      <div className="library-layout">
        <article className="panel library-list-panel">
          <div className="library-tools">
            <input
              type="search"
              placeholder="Search word or definition"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select value={filter} onChange={(event) => setFilter(event.target.value as LibraryFilter)}>
              <option value="all">All</option>
              <option value="mastered">Mastered</option>
              <option value="weak">Weak</option>
              <option value="missed">Missed</option>
              <option value="unseen">Unseen</option>
              <option value="bookmarked">Bookmarked</option>
            </select>
          </div>

          <p className="small-note">Showing {filteredWords.length} words</p>

          <ul className="library-list">
            {filteredWords.map((word) => {
              const progress = appData.wordProgress[word.id];
              const status = wordStatus(progress);
              return (
                <li
                  key={word.id}
                  className={selectedWordId === word.id ? "selected" : ""}
                  onClick={() => setSelectedWordId(word.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      setSelectedWordId(word.id);
                    }
                  }}
                  tabIndex={0}
                >
                  <div>
                    <strong>{word.word}</strong>
                    <p>{word.definition}</p>
                  </div>
                  <div className="library-meta">
                    <span className={`pill ${status}`}>{status}</span>
                    <span>{Math.round(progress?.masteryScore ?? 0)}%</span>
                    {bookmarked.has(word.id) ? <span className="pill bookmark">bookmarked</span> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </article>

        <article className="panel library-detail-panel">
          {selectedWord ? (
            <WordDetail
              word={selectedWord}
              progress={appData.wordProgress[selectedWord.id]}
              bookmarked={bookmarked.has(selectedWord.id)}
              onToggleBookmark={() => onToggleBookmark(selectedWord.id)}
              onClose={() => setSelectedWordId(undefined)}
            />
          ) : (
            <div className="empty-state">
              <h3>Select a word</h3>
              <p>Pick any row to view details, performance history, and bookmark controls.</p>
            </div>
          )}
        </article>
      </div>
    </section>
  );
};

