import { useTranslation } from "react-i18next";
import { LANGUAGES, setLanguage, type Language } from "../i18n";

// Language choice in the footer: saved in the browser, so it survives a reload
export default function LanguageSwitcher() {
	const { i18n, t } = useTranslation();
	const current = (i18n.resolvedLanguage ?? "en") as Language;

	return (
		<label className="language-switcher">
			<span className="visually-hidden">{t("common.language")}</span>
			<select
				value={current}
				onChange={(event) => setLanguage(event.target.value as Language)}
			>
				{LANGUAGES.map((language) => (
					<option key={language.code} value={language.code}>
						{language.label}
					</option>
				))}
			</select>
		</label>
	);
}
