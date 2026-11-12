import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import pt from "./pt.json";
import fr from "./fr.json";

export type Language = "en" | "pt" | "fr";

export const LANGUAGES: { code: Language; label: string }[] = [
	{ code: "en", label: "English" },
	{ code: "pt", label: "Português" },
	{ code: "fr", label: "Français" },
];

const STORAGE_KEY = "opensea-language";

// The saved choice wins; otherwise the browser language, if we speak it
function initialLanguage(): Language {
	const saved = localStorage.getItem(STORAGE_KEY);
	if (saved === "en" || saved === "pt" || saved === "fr")
		return saved;

	const browser = navigator.language.toLowerCase();
	if (browser.startsWith("pt"))
		return "pt";
	if (browser.startsWith("fr"))
		return "fr";
	return "en";
}

i18n.use(initReactI18next).init({
	resources: {
		en: { translation: en },
		pt: { translation: pt },
		fr: { translation: fr },
	},
	lng: initialLanguage(),
	fallbackLng: "en",
	interpolation: {
		escapeValue: false, // React already escapes what it draws
	},
});

export function setLanguage(language: Language) {
	localStorage.setItem(STORAGE_KEY, language);
	void i18n.changeLanguage(language);
}

export default i18n;
