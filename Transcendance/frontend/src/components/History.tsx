import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { mapLabel } from '../game/maps';
import type { MatchHistoryItem, MatchHistoryResponse } from '../types/Stats';
import Screen from './Screen';
import './History.css';

const PAGE_SIZE = 10;

type HistoryProps = {
  userId: number;
  onBack: () => void;
};

// The player's online matches, newest first. The server enforces that userId is
// the logged-in user, so this screen only has to show what it receives.
const History: React.FC<HistoryProps> = ({ userId, onBack }) => {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<MatchHistoryResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      try {
        const response = await api(`/users/${userId}/matches?page=${page}&pageSize=${PAGE_SIZE}`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const history: MatchHistoryResponse = await response.json();
        if (!cancelled)
          setData(history);
      } catch (loadError) {
        if (cancelled)
          return;
        console.error(loadError);
        setError(t('history.errors.load'));
      } finally {
        if (!cancelled)
          setLoading(false);
      }
    }

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [page, reloadKey, t, userId]);

  function changePage(next: number) {
    setLoading(true);
    setError('');
    setPage(next);
  }

  function retry() {
    setLoading(true);
    setError('');
    setReloadKey((key) => key + 1);
  }

  const dateFormat = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  function formatDate(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : dateFormat.format(date);
  }

  function resultLabel(result: MatchHistoryItem['result']) {
    return t(`history.results.${result}`);
  }

  return (
    <Screen title={t('history.title')} onBack={onBack}>
      <div className="history">
        {loading && <p className="history-message">{t('common.loading')}</p>}

        {!loading && error && (
          <div className="history-message" role="alert">
            <p className="form-message">{error}</p>
            <button className="sea-button secondary" onClick={retry}>
              {t('common.retry')}
            </button>
          </div>
        )}

        {!loading && !error && data && data.matches.length === 0 && (
          <p className="history-message">{t('history.empty')}</p>
        )}

        {!loading && !error && data && data.matches.length > 0 && (
          <>
            <ul className="history-list">
              {data.matches.map((match) => (
                <li className="text-box history-row" key={match.id}>
                  <span className="history-date">{formatDate(match.endedAt)}</span>
                  <span className="history-map">{mapLabel(match.mapName, t)}</span>
                  <span className="history-character">
                    {t(`fishNames.${match.character}`, { defaultValue: match.character })}
                  </span>
                  <span className="history-opponents">
                    {match.opponents.map((opponent) => opponent.username).join(', ')}
                  </span>
                  <span className={`history-result history-result-${match.result}`}>
                    {resultLabel(match.result)}
                  </span>
                  <span className="history-stat">
                    <span aria-hidden="true">◆</span> {match.diamonds}
                  </span>
                  <span className="history-stat">
                    <span aria-hidden="true">☠</span> {match.deaths}
                  </span>
                </li>
              ))}
            </ul>

            <div className="history-pager">
              <button
                className="sea-button secondary"
                disabled={page <= 1}
                onClick={() => changePage(page - 1)}
              >
                {t('history.previous')}
              </button>
              <span className="history-page">
                {t('history.page', { page: data.page, pages: data.totalPages })}
              </span>
              <button
                className="sea-button secondary"
                disabled={page >= data.totalPages}
                onClick={() => changePage(page + 1)}
              >
                {t('history.next')}
              </button>
            </div>
          </>
        )}
      </div>
    </Screen>
  );
};

export default History;
