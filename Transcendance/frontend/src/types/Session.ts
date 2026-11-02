// Who is logged in, as the server answers in /login and /me
export type Session = {
	username: string;
	wins: number;
	losses: number;
	multiplayerWins: number;
	multiplayerLosses: number;
};
