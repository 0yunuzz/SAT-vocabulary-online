"use client";

import { useEffect, useState } from "react";
import type { VocabWord } from "@/lib/types";
import { loadClientWords } from "@/utils/vocab-loader";

const WORD_CACHE_KEY = "sat_vocab_cached_words";

export function useVocabWords() {
  const [words, setWords] = useState<VocabWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const setFromCache = () => {
      const cached = localStorage.getItem(WORD_CACHE_KEY);
      if (!cached) return false;
      try {
        const parsed = JSON.parse(cached) as VocabWord[];
        if (!Array.isArray(parsed) || parsed.length === 0) return false;
        if (!cancelled) {
          setWords(parsed);
          setLoading(false);
        }
        return true;
      } catch {
        return false;
      }
    };

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await loadClientWords();
        if (cancelled) return;
        setWords(data);
        setLoading(false);
        localStorage.setItem(WORD_CACHE_KEY, JSON.stringify(data));
      } catch (err) {
        const fromCache = setFromCache();
        if (!fromCache && !cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load words.");
          setLoading(false);
        }
      }
    };

    if (!setFromCache()) {
      void load();
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return { words, loading, error };
}
