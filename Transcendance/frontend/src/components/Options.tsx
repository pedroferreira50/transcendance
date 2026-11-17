import { useState } from "react";
import { useTranslation } from "react-i18next";
import { POWER_UPS, SHARK_SPEEDS, TIME_CHANGE_MS, TIMES } from "../game/options";
import type { MatchOptions, PowerUpType } from "../game/protocol";
import Screen from "./Screen";
import "./Options.css";

type OptionsProps = {
	initial: MatchOptions; // what is chosen when the screen opens
	confirmLabel: string; // already translated: t("options.create"), t("options.save"), t("options.next")
	message?: string; // the answer of the server when it refuses ("You are already in a lobby.")
	onChoose: (options: MatchOptions) => void;
	onBack: () => void;
};

// -60000 -> "-1", 120000 -> "+2": the minutes a time adds to the map, with the sign
function minutes(ms: number): string {
	const value = ms / 60_000;
	return value > 0 ? `+${value}` : String(value);
}

// The rules of the match, after the map: the time, the speed of the sharks and the power-ups that can appear
export default function Options({ initial, confirmLabel, message, onChoose, onBack }: OptionsProps) {
	const { t } = useTranslation();
	const [options, setOptions] = useState<MatchOptions>(initial);

	// on/off; the list stays in the order of POWER_UPS, whatever the order of the clicks
	function toggle(type: PowerUpType) {
		const on = options.powerUps.includes(type);
		const powerUps = POWER_UPS.filter((other) => (other === type ? !on : options.powerUps.includes(other)));
		setOptions({ ...options, powerUps });
	}

	return (
		<Screen title={t("options.title")} onBack={onBack}>
			<div className="options">
				<div className="option-rows">
					<div className="option-row">
						<span className="option-name">{t("options.time")}</span>
						<div className="option-choices" role="group" aria-label={t("options.time")}>
							{TIMES.map((time) => (
								<button
									key={time}
									className={options.time === time ? "option-choice chosen" : "option-choice"}
									aria-pressed={options.time === time}
									onClick={() => setOptions({ ...options, time })}
								>
									{t(`options.times.${time}`)}
									{TIME_CHANGE_MS[time] !== 0 && (
										<span className="option-hint">{t("options.minutes", { value: minutes(TIME_CHANGE_MS[time]) })}</span>
									)}
								</button>
							))}
						</div>
					</div>

					<div className="option-row">
						<span className="option-name">{t("options.sharks")}</span>
						<div className="option-choices" role="group" aria-label={t("options.sharks")}>
							{SHARK_SPEEDS.map((sharks) => (
								<button
									key={sharks}
									className={options.sharks === sharks ? "option-choice chosen" : "option-choice"}
									aria-pressed={options.sharks === sharks}
									onClick={() => setOptions({ ...options, sharks })}
								>
									{t(`options.sharkSpeeds.${sharks}`)}
								</button>
							))}
						</div>
					</div>

					<div className="option-row">
						<span className="option-name">{t("options.powerUps")}</span>
						<div className="option-choices power-up-choices" role="group" aria-label={t("options.powerUps")}>
							{POWER_UPS.map((type) => (
								<button
									key={type}
									className={options.powerUps.includes(type) ? "power-up-choice on" : "power-up-choice"}
									aria-pressed={options.powerUps.includes(type)}
									onClick={() => toggle(type)}
								>
									<img src={`/art/bubbles/${type}.webp`} alt="" />
									<span className="power-up-name">{t(`options.powerUpNames.${type}`)}</span>
								</button>
							))}
						</div>
					</div>
				</div>

				<div className="button-row">
					<button className="sea-button" onClick={() => onChoose(options)}>
						{confirmLabel}
					</button>
				</div>

				<p className="form-message" role="status">{message}</p>
			</div>
		</Screen>
	);
}
