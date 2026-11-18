import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import type { Session } from '../types/Session';
import type { StatsResponse, UserStats } from '../types/Stats';

import type { ProgressionResponse } from '../types/Progression';

import Screen from './Screen';
import './Profile.css';

type ProfileProps = {
  session: Session;
  onBack: () => void;
  onHistory: () => void;
  onLogout: () => void;
};

type StatItem = {
  label: string;
  value: string | number;
};

type StatsBlockProps = {
  title: string;
  items: StatItem[];
};

// One group of numbers: the gold badge with its name and, under it, one box per total
const StatsBlock: React.FC<StatsBlockProps> = ({ title, items }) => (
  <section className="stats-block">
    <span className="gold-badge">{title}</span>
    <div className="stats">
      {items.map((item) => (
        <div className="text-box stat" key={item.label}>
          <span className="stat-name">{item.label}</span>
          <span className="stat-value">{item.value}</span>
        </div>
      ))}
    </div>
  </section>
);

// The PROFILE screen: who is logged in, the totals calculated from their match
// records (not the old counters), the way to the history and the logout.
const Profile: React.FC<ProfileProps> = ({ session, onBack, onHistory, onLogout }) => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [progression, setProgression] = useState<ProgressionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

  async function loadStats() {
      try {
        const [statsResponse, progressionResponse] = await Promise.all([
          api(`/users/${session.id}/stats`),
          api('/progression')
        ]);

        if (!statsResponse.ok) {
          throw new Error(`HTTP ${statsResponse.status}`);
        }
        if (!progressionResponse.ok) {
          throw new Error(`HTTP ${progressionResponse.status}`);
        }

        const data: StatsResponse = await statsResponse.json();
        const progressionData: ProgressionResponse = await progressionResponse.json();

        if (!cancelled) {
          setStats(data.stats);
          setProgression(progressionData);
        }
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        console.error(loadError);
        setError(t('profile.errors.load'));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }    
    void loadStats();

    return () => {
      cancelled = true;
    };
  }, [reloadKey, session.id, t]);

  function retry() {
    setLoading(true);
    setError('');
    setReloadKey((key) => key + 1);
  }

  return (
    <Screen title={t('profile.title')} onBack={onBack}>
      <div className="profile">
        <p className="profile-name">{session.username}</p>

        {loading && <p className="profile-message">{t('common.loading')}</p>}

        {!loading && error && (
          <div className="profile-message" role="alert">
            <p className="form-message">{error}</p>
            <button className="sea-button secondary" onClick={retry}>
              {t('common.retry')}
            </button>
          </div>
        )}

        {!loading && !error && stats && progression && (
          <>
              <StatsBlock
              title={t('profile.progression')}
              items={[
                { label: t('profile.xp'), value: progression.totalXp },
                { label: t('profile.level'), value: progression.level },
				{ label: t('profile.onlineWins'), value: progression.multiplayerWins },
				{ label: t('profile.winsUntilTen'), value: progression.winsUntilTen }
              ]}
            />
			<section className="stats-block">
			  <span className="gold-badge">{t('profile.achievements.title')}</span>

			  {progression.achievements.length === 0 ? (
				<p>{t('profile.achievements.empty')}</p>
			  ) : (
				<div className="stats">
				  {progression.achievements.map((achievement) => (
					<div className="text-box stat" key={achievement.achievementKey}>
					  <span className="stat-name">
						{t(`profile.achievements.${achievement.achievementKey}`)}
					  </span>
					</div>
				  ))}
				</div>
			  )}
			</section>
            <StatsBlock
              title={t('profile.online')}
              items={[
                { label: t('profile.matches'), value: stats.matches },
                { label: t('profile.wins'), value: stats.wins },
                { label: t('profile.losses'), value: stats.losses },
                { label: t('profile.draws'), value: stats.draws },
                { label: t('profile.forfeits'), value: stats.forfeits },
                { label: t('profile.winPercent'), value: `${stats.winPercentage.toFixed(1)}%` }
              ]}
            />
            <StatsBlock
              title={t('profile.totals')}
              items={[
                { label: t('profile.diamonds'), value: stats.diamonds },
                { label: t('profile.moves'), value: stats.moves },
                { label: t('profile.deaths'), value: stats.deaths },
                { label: t('profile.powerUps'), value: stats.powerUpsUsed }
              ]}
            />
            <button className="sea-button secondary" onClick={onHistory}>
              {t('profile.history')}
            </button>
          </>
        )}

        <button className="sea-button" onClick={onLogout}>
          {t('profile.logout')}
        </button>
      </div>
    </Screen>
  );
};

export default Profile;
