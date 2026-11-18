import type { TFunction } from "i18next";
import type { BotInfo } from "./protocol";

// The name shown over a fish and on the WINNER screen: "Jogador 1" in the local mode, "BOT · DIFÍCIL" for the bot, the username otherwise
export function fishName(slot: number, username: string, local: boolean, bot: BotInfo | null, t: TFunction): string {
	if (local)
		return t("game.localPlayer", { n: slot + 1 });
	if (bot && bot.slot === slot)
		return t("bot.name", { level: t(`bot.levels.${bot.level}`) });
	return username;
}
