import { ProgressBar } from "../components/ProgressBar";
import { AppData } from "../types";

interface AchievementsPageProps {
  appData: AppData;
}

export const AchievementsPage = ({ appData }: AchievementsPageProps) => {
  const achievements = Object.values(appData.achievements);
  const unlocked = achievements.filter((item) => item.unlockedAt);

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h2>Achievements</h2>
          <p>Study-focused milestones designed to reinforce consistency and recall quality.</p>
        </div>
      </header>

      <div className="panel achievements-summary">
        <p>
          <strong>{unlocked.length}</strong> of <strong>{achievements.length}</strong> unlocked
        </p>
      </div>

      <div className="achievements-grid">
        {achievements.map((achievement) => (
          <article key={achievement.id} className={`panel achievement-card ${achievement.unlockedAt ? "unlocked" : ""}`}>
            <h3>{achievement.title}</h3>
            <p>{achievement.description}</p>
            <ProgressBar
              value={achievement.progress}
              max={achievement.target}
              label={`${achievement.progress}/${achievement.target}`}
            />
            <p className="small-note">
              {achievement.unlockedAt
                ? `Unlocked ${new Date(achievement.unlockedAt).toLocaleDateString()}`
                : "In progress"}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
};
