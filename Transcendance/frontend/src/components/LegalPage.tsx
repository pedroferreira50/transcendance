import { useTranslation } from "react-i18next";
import LanguageSwitcher from "./LanguageSwitcher";
import "./LegalPage.css";

type LegalPageProps = {
	kind: "privacy" | "terms";
};

const SECTIONS: Record<LegalPageProps["kind"], string[]> = {
	privacy: ["data", "use", "cookies", "retention", "contact"],
	terms: ["accounts", "conduct", "service", "liability", "changes", "contact"],
};

// The Privacy Policy and the Terms of Service, reachable from the footer of every screen.
// They are plain pages (not part of the OpenSea state) so they also work on a direct URL.
export default function LegalPage({ kind }: LegalPageProps) {
	const { t } = useTranslation();

	return (
		<div className="legal-page">
			<article className="legal-card">
				<a className="legal-back" href="/">← {t("legal.backHome")}</a>
				<h1>{t(`legal.${kind}Title`)}</h1>
				<p className="legal-updated">{t("legal.updated")}</p>
				<p>{t(`legal.${kind}.intro`)}</p>
				{SECTIONS[kind].map((section) => (
					<section key={section}>
						<h2>{t(`legal.${kind}.${section}Title`)}</h2>
						<p>{t(`legal.${kind}.${section}`)}</p>
					</section>
				))}
				<footer className="legal-footer">
					<a href="/privacy">{t("common.privacy")}</a>
					<a href="/terms">{t("common.terms")}</a>
					<LanguageSwitcher />
				</footer>
			</article>
		</div>
	);
}
