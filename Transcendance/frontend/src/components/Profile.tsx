import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import type { Session } from '../types/Session';
import type { StatsResponse, UserStats } from '../types/Stats';

import type { ProgressionResponse } from '../types/Progression';

import Screen from './Screen';

type ProfileProps = {
  session: Session;
  onBack: () => void;
  onHistory: () => void;
  onLogout: () => void;
};

type StatItem = {
  label: string;
  value?: string | number; // without it, only the name (an achievement)
};

// One group: the gold badge with its name and, under it, what the group shows
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="flex flex-col items-center gap-[clamp(0.8rem,2.5vh,1.5rem)]">
    <span className="gold-badge">{title}</span>
    {children}
  </section>
);

// The boxes side by side, one per item: the name on top, the number under it
const Boxes: React.FC<{ items: StatItem[] }> = ({ items }) => (
  <div className="flex flex-wrap justify-center gap-[clamp(0.6rem,2vw,1.5rem)]">
    {items.map((item) => (
      <div className="text-box flex min-w-[6em] flex-col items-center gap-[0.3rem]" key={item.label}>
        <span>{item.label}</span>
        {item.value !== undefined && <span className="font-button text-[2em] leading-none text-sea-light">{item.value}</span>}
      </div>
    ))}
  </div>
);

// One group of numbers: the gold badge with its name and, under it, one box per total
const StatsBlock: React.FC<{ title: string; items: StatItem[] }> = ({ title, items }) => (
  <Section title={title}>
    <Boxes items={items} />
  </Section>
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
      <div className="flex flex-1 flex-col items-center justify-evenly gap-[clamp(1rem,4vh,3rem)]">
        {/* a long username breaks (wrap-anywhere) instead of going out of the screen */}
        <p className="m-0 text-center font-title text-username tracking-[0.02em] text-sea-light wrap-anywhere">{session.username}</p>

        {loading && <p className="flex flex-col items-center gap-4 text-message">{t('common.loading')}</p>}

        {!loading && error && (
          <div className="flex flex-col items-center gap-4 text-message" role="alert">
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
			<Section title={t('profile.achievements.title')}>
			  {progression.achievements.length === 0 ? (
				<p>{t('profile.achievements.empty')}</p>
			  ) : (
				<Boxes items={progression.achievements.map((achievement) => ({ label: t(`profile.achievements.${achievement.achievementKey}`) }))} />
			  )}
			</Section>
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
