"use client";

import { useEffect } from "react";
import { signIn, signOut } from "next-auth/react";
import { UserRole } from "@prisma/client";
import { AppShell } from "./components/AppShell";
import { DashboardPage } from "./pages/DashboardPage";
import { StatisticsPage } from "./pages/StatisticsPage";
import { SetupPage } from "./pages/SetupPage";
import { PracticePage } from "./pages/PracticePage";
import { ResultsPage } from "./pages/ResultsPage";
import { ReviewPage } from "./pages/ReviewPage";
import { LibraryPage } from "./pages/LibraryPage";
import { SettingsPage } from "./pages/SettingsPage";
import { AchievementsPage } from "./pages/AchievementsPage";
import { useOnlineTrainer } from "./hooks/useOnlineTrainer";
import type { AppScreen, SessionConfig } from "./types";

interface TrainerAppProps {
  initialScreen?: AppScreen;
}

const quickConfig = (
  mode: SessionConfig["mode"],
  bucket: SessionConfig["customBucket"],
  count = 20
): SessionConfig => ({
  mode,
  questionCount: count,
  timerMode: "untimed",
  customBucket: bucket,
  customQuestionTypes: [],
  questionTimeLimitSec: 20,
  sessionTimeLimitSec: 600
});

export const TrainerApp = ({ initialScreen = "dashboard" }: TrainerAppProps) => {
  const { state, wordsById, modeState, actions } = useOnlineTrainer(initialScreen);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", state.settings.darkMode);
  }, [state.settings.darkMode]);

  const startSession = (config: SessionConfig) => {
    actions.startSession({
      ...config,
      questionTimeLimitSec:
        config.questionTimeLimitSec ?? state.settings.questionTimeLimitSec,
      sessionTimeLimitSec:
        config.sessionTimeLimitSec ?? state.settings.sessionTimeLimitSec,
      customQuestionTypes: config.customQuestionTypes ?? []
    });
  };

  const renderPage = () => {
    if (state.loading) {
      return (
        <section className="page">
          <div className="panel empty-state">
            <h3>Loading vocabulary...</h3>
            <p>Preparing your online SAT study workspace.</p>
          </div>
        </section>
      );
    }

    if (state.error && !state.vocabWords.length) {
      return (
        <section className="page">
          <div className="panel empty-state">
            <h3>Vocabulary file not ready</h3>
            <p>{state.error}</p>
            <p className="small-note">
              Expected file: `public/data/sat_vocab.csv` (or `vocab.csv` fallback)
            </p>
          </div>
        </section>
      );
    }

    if (state.activeSession) {
      return (
        <PracticePage
          session={state.activeSession}
          wordsById={wordsById}
          bookmarkedWordIds={new Set(state.appData.bookmarks)}
          onSelectChoice={actions.selectChoice}
          onSubmit={actions.submitAnswer}
          onNext={actions.moveToNextQuestion}
          onSkip={() => actions.skipQuestion(false)}
          onToggleBookmark={actions.toggleBookmark}
          onEndSession={actions.endSessionNow}
        />
      );
    }

    if (state.screen === "dashboard") {
      return (
        <DashboardPage
          words={state.vocabWords}
          appData={state.appData}
          onStartQuickSession={startSession}
        />
      );
    }

    if (state.screen === "statistics") {
      return <StatisticsPage words={state.vocabWords} appData={state.appData} />;
    }

    if (state.screen === "setup") {
      return (
        <SetupPage
          words={state.vocabWords}
          appData={state.appData}
          settings={state.settings}
          lastConfig={state.appData.lastSessionConfig}
          onStartSession={startSession}
        />
      );
    }

    if (state.screen === "results") {
      const missedCount = state.lastSummary?.struggledWords.length ?? 20;
      return (
        <ResultsPage
          summary={state.lastSummary}
          wordsById={wordsById}
          onReviewMissed={() =>
            startSession(
              quickConfig("missed_words", "missed", Math.max(10, missedCount))
            )
          }
          onRetrySession={actions.retryLastSession}
          onContinueWeakWords={() => startSession(quickConfig("weak_words", "weak", 20))}
          onReturnDashboard={() => actions.navigate("dashboard")}
        />
      );
    }

    if (state.screen === "review") {
      return (
        <ReviewPage
          words={state.vocabWords}
          appData={state.appData}
          onStartSession={startSession}
          onToggleBookmark={actions.toggleBookmark}
        />
      );
    }

    if (state.screen === "library") {
      return (
        <LibraryPage
          words={state.vocabWords}
          appData={state.appData}
          onToggleBookmark={actions.toggleBookmark}
        />
      );
    }

    if (state.screen === "settings") {
      return (
        <SettingsPage
          settings={state.settings}
          warnings={state.loadWarnings}
          isSignedIn={modeState.isSignedIn}
          userEmail={modeState.user?.email}
          onSignIn={() => void signIn("google", { callbackUrl: "/" })}
          onSignOut={() => void signOut({ callbackUrl: "/" })}
          mode={modeState.mode}
          saveStatus={modeState.syncStatus}
          onUpdate={actions.updateSettings}
          onResetProgress={actions.resetProgress}
        />
      );
    }

    return <AchievementsPage appData={state.appData} />;
  };

  const shellScreen = state.activeSession ? "practice" : state.screen;

  return (
    <AppShell
      screen={shellScreen}
      onNavigate={actions.navigate}
      mode={modeState.mode}
      saveStatus={modeState.syncStatus}
      userEmail={modeState.user?.email}
      userRole={modeState.user?.role as UserRole | undefined}
    >
      {state.transientNotice ? (
        <div className="notice-banner" role="status" onClick={actions.clearNotice}>
          {state.transientNotice}
        </div>
      ) : null}
      {renderPage()}
    </AppShell>
  );
};
