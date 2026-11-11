import { useState } from "react";
import { POWER_UPS, SHARK_SPEEDS, TIME_CHANGE, TIMES } from "../game/options";
import type { MatchOptions, PowerUpType } from "../game/protocol";
import Screen from "./Screen";
import "./Options.css";

type OptionsProps = {
	initial: MatchOptions; // what is chosen when the screen opens
	confirmLabel: string; // "CREATE", "SAVE", "NEXT"
	message?: string; // the answer of the server when it refuses ("You are already in a lobby.")
	onChoose: (options: MatchOptions) => void;
	onBack: () => void;
};

// The rules of the match, after the map: the time, the speed of the sharks and the power-ups that can appear
export default function Options({ initial, confirmLabel, message, onChoose, onBack }: OptionsProps) {
	const [options, setOptions] = useState<MatchOptions>(initial);

	// on/off; the list stays in the order of POWER_UPS, whatever the order of the clicks
	function toggle(type: PowerUpType) {
		const on = options.powerUps.includes(type);
		const powerUps = POWER_UPS.filter((other) => (other === type ? !on : options.powerUps.includes(other)));
		setOptions({ ...options, powerUps });
	}

	return (
		<Screen title="OPTIONS" onBack={onBack}>
			<div className="options">
				<div className="option-rows">
					<div className="option-row">
						<span className="option-name">TIME</span>
						<div className="option-choices" role="group" aria-label="Time">
							{TIMES.map((time) => (
								<button
									key={time}
									className={options.time === time ? "option-choice chosen" : "option-choice"}
									aria-pressed={options.time === time}
									onClick={() => setOptions({ ...options, time })}
								>
									{time.toUpperCase()}
									{TIME_CHANGE[time] && <span className="option-hint">{TIME_CHANGE[time]}</span>}
								</button>
							))}
						</div>
					</div>

					<div className="option-row">
						<span className="option-name">SHARKS</span>
						<div className="option-choices" role="group" aria-label="Sharks">
							{SHARK_SPEEDS.map((sharks) => (
								<button
									key={sharks}
									className={options.sharks === sharks ? "option-choice chosen" : "option-choice"}
									aria-pressed={options.sharks === sharks}
									onClick={() => setOptions({ ...options, sharks })}
								>
									{sharks.toUpperCase()}
								</button>
							))}
						</div>
					</div>

					<div className="option-row">
						<span className="option-name">POWER-UPS</span>
						<div className="option-choices" role="group" aria-label="Power-ups">
							{POWER_UPS.map((type) => (
								<button
									key={type}
									className={options.powerUps.includes(type) ? "power-up-choice on" : "power-up-choice"}
									aria-pressed={options.powerUps.includes(type)}
									onClick={() => toggle(type)}
								>
									<img src={`/art/bubbles/${type}.webp`} alt="" />
									<span className="power-up-name">{type}</span>
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
