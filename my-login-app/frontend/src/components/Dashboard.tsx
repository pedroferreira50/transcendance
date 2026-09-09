import React, { useState } from 'react';
import Profile from './Profile';
import dashboardBackground from '../assets/dashboard-background.gif';

type DashboardProps = {
  username: string;
  soloWins: number;
  soloLosses: number;
  multiplayerWins: number;
  multiplayerLosses: number;
  onLogout: () => void;
  onPlaySolo: () => void;
  onPlayMultiplayer: () => void;
};

const Dashboard: React.FC<DashboardProps> = ({
  username,
  soloWins,
  soloLosses,
  multiplayerWins,
  multiplayerLosses,
  onLogout,
  onPlaySolo,
  onPlayMultiplayer
}) => {
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <div style={{
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      overflow: 'hidden',
      fontSize: '2rem',
      fontFamily: 'Arial, sans-serif',
      backgroundImage: `url(${dashboardBackground})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }}>
      <h1>Welcome to Clicky!</h1>
      <button onClick={onPlaySolo} style={{ fontSize: '1rem' }}>
        Play Solo
      </button>
      <button onClick={onPlayMultiplayer} style={{ fontSize: '1rem' }}>
        Play Multiplayer
      </button>
      <button onClick={onLogout} style={{ fontSize: '1rem' }}>
        Logout
      </button>

      <button
        onClick={() => setPanelOpen((open) => !open)}
        style={{
          position: 'fixed',
          top: '50%',
          right: panelOpen ? '250px' : '0',
          transform: 'translateY(-50%)',
          fontSize: '1rem',
          padding: '0.5rem',
          transition: 'right 0.3s ease',
          zIndex: 2
        }}
      >
        {panelOpen ? '>' : '<'}
      </button>

      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        height: '100%',
        width: '250px',
        background: '#f0f0f0',
        boxShadow: '-2px 0 6px rgba(0, 0, 0, 0.2)',
        transform: panelOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1
      }}>
        <Profile
          username={username}
          soloWins={soloWins}
          soloLosses={soloLosses}
          multiplayerWins={multiplayerWins}
          multiplayerLosses={multiplayerLosses}
        />
      </div>
    </div>
  );
};

export default Dashboard;
