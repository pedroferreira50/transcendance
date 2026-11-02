import React from 'react';
import Screen from './Screen';
import './Profile.css';

type ProfileProps = {
  username: string;
  multiplayerWins: number;
  multiplayerLosses: number;
  onBack: () => void;
  onLogout: () => void;
};

function winPercentage(wins: number, losses: number) {
  const totalGames = wins + losses;
  return totalGames === 0 ? 0 : (wins / totalGames) * 100;
}

type StatsBlockProps = {
  title: string;
  wins: number;
  losses: number;
};

// One mode: the gold badge with its name and, under it, the wins, the losses and the % of wins
const StatsBlock: React.FC<StatsBlockProps> = ({ title, wins, losses }) => (
  <section className="stats-block">
    <span className="gold-badge">{title}</span>
    <div className="stats">
      <div className="text-box stat">
        <span className="stat-name">WINS</span>
        <span className="stat-value">{wins}</span>
      </div>
      <div className="text-box stat">
        <span className="stat-name">LOSSES</span>
        <span className="stat-value">{losses}</span>
      </div>
      <div className="text-box stat">
        <span className="stat-name">WIN %</span>
        <span className="stat-value">{winPercentage(wins, losses).toFixed(1)}%</span>
      </div>
    </div>
  </section>
);

// The PROFILE screen: who is logged in, their online results and the logout.
const Profile: React.FC<ProfileProps> = ({
  username,
  multiplayerWins,
  multiplayerLosses,
  onBack,
  onLogout
}) => (
  <Screen title="PROFILE" onBack={onBack}>
    <div className="profile">
      <p className="profile-name">{username}</p>
      <StatsBlock title="ONLINE" wins={multiplayerWins} losses={multiplayerLosses} />
      <button className="sea-button" onClick={onLogout}>
        LOGOUT
      </button>
    </div>
  </Screen>
);

export default Profile;
