export type UserAchievement = {
    achievementKey: string;
    unlockedAt: string;
};

export type ProgressionResponse = {
    totalXp: number;
    level: number;
    achievements: UserAchievement[];
    multiplayerWins: number;
    winsUntilTen: number;
};
