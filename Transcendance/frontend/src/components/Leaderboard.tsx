import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import type { LeaderboardEntry, LeaderboardResponse } from '../types/Stats';
import Screen from './Screen';
import './Leaderboard.css';

const LIMIT = 20;

type LeaderboardProps = {
  onBack: () => void;
};

const Leaderboard: React.FC<LeaderboardProps> = ({ onBack }) => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadLeaderboard() {
      try {
        const response = await api(`/leaderboard?limit=${LIMIT}`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data: LeaderboardResponse = await response.json();
        if (!cancelled)
          setEntries(data.leaderboard);
      } catch (loadError) {
        if (cancelled)
          return;
        console.error(loadError);
        setError(t('leaderboard.errors.load'));
      } finally {
        if (!cancelled)
          setLoading(false);
      }
    }

    void loadLeaderboard();

    return () => {
      cancelled = true;
    };
  }, [reloadKey, t]);

  function retry() {
    setLoading(true);
    setError('');
    setReloadKey((key) => key + 1);
  }

  return (
    <Screen title={t('leaderboard.title')} onBack={onBack}>
      <div className="leaderboard">
        <p className="leaderboard-rule">{t('leaderboard.rule')}</p>

        {loading && <p className="leaderboard-message">{t('common.loading')}</p>}

        {!loading && error && (
          <div className="leaderboard-message" role="alert">
            <p className="form-message">{error}</p>
            <button className="sea-button secondary" onClick={retry}>
              {t('common.retry')}
            </button>
          </div>
        )}

        {!loading && !error && entries.length === 0 && (
          <p className="leaderboard-message">{t('leaderboard.empty')}</p>
        )}

        {!loading && !error && entries.length > 0 && (
          <ul className="leaderboard-list">
            <li className="leaderboard-row leaderboard-head">
              <span>{t('leaderboard.rank')}</span>
              <span>{t('leaderboard.player')}</span>
              <span>{t('leaderboard.matches')}</span>
              <span>{t('leaderboard.wins')}</span>
              <span>{t('leaderboard.losses')}</span>
              <span>{t('leaderboard.draws')}</span>
              <span>{t('leaderboard.winPercent')}</span>
            </li>
            {entries.map((entry) => (
              <li className="text-box leaderboard-row" key={entry.userId}>
                <span className="leaderboard-rank">{entry.rank}</span>
                <span className="leaderboard-name">{entry.username}</span>
                <span>{entry.stats.matches}</span>
                <span>{entry.stats.wins}</span>
                <span>{entry.stats.losses}</span>
                <span>{entry.stats.draws}</span>
                <span>{entry.stats.winPercentage.toFixed(1)}%</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Screen>
  );
};

export default Leaderboard;
