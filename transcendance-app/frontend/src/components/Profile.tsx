import React from 'react';
import profileBackground from '../assets/profile-background.gif';

type ProfileProps = {
  username: string;
  soloWins?: number;
  soloLosses?: number;
  multiplayerWins?: number;
  multiplayerLosses?: number;
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

const StatsBlock: React.FC<StatsBlockProps> = ({ title, wins, losses }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
    <h3 style={{ color: 'purple', margin: 0, fontSize: '1rem' }}>{title}</h3>

    <span style={{ color: 'green', fontWeight: 'bold' }}>
      {wins} WINS
    </span>

    <span style={{ color: 'red', fontWeight: 'bold' }}>
      {losses} LOSSES
    </span>

    <span style={{ color: 'orange', fontWeight: 'bold' }}>
      Win %: {winPercentage(wins, losses).toFixed(1)}%
    </span>
  </div>
);

const Profile: React.FC<ProfileProps> = ({
  username,
  soloWins = 0,
  soloLosses = 0,
  multiplayerWins = 0,
  multiplayerLosses = 0
}) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '1rem',
      fontFamily: 'Arial, sans-serif',
      height: '100%',
      width: '100%',
      boxSizing: 'border-box',
      backgroundImage: `url(${profileBackground})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }}>
      <h2 style={{ color: 'black', margin: 0 }}>Profile</h2>
      <span style={{ color: 'black', fontSize: '1.25rem' }}>{username}</span>

      <StatsBlock title="Solo" wins={soloWins} losses={soloLosses} />
      <StatsBlock title="Multiplayer" wins={multiplayerWins} losses={multiplayerLosses} />
    </div>
  );
};

export default Profile;
