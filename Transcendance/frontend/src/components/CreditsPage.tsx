import { useTranslation } from "react-i18next";
import LanguageSwitcher from "./LanguageSwitcher";
import "./LegalPage.css";

// The members of the team: the names do not change with the language, the role is a translation key
const TEAM = [
	{ name: "Duarte", login: "duandrad", role: "pm" },
	{ name: "Guilherme", login: "gufreire", role: "dev" },
	{ name: "Luiz", login: "luiz-dos", role: "lead" },
	{ name: "Pedro", login: "pviegas-", role: "po" },
];

const TECHNOLOGIES = [
	"React", "TypeScript", "Vite", "Tailwind CSS", "HTML5 Canvas", "Node.js", "Express",
	"Socket.IO", "Prisma", "SQLite", "i18next", "Vitest", "nginx", "Docker",
];

// The credits: the team, where the art comes from (Magnific asks for "Designed by Magnific"
// with a link in the credits of a game), the technologies and the thanks.
// Like the legal pages, it is a plain page with its own URL (/credits) and the same look.
export default function CreditsPage() {
	const { t } = useTranslation();

	return (
		<div className="legal-page">
			<article className="legal-card">
				<a className="legal-back" href="/">← {t("legal.backHome")}</a>
				<h1>{t("credits.title")}</h1>
				<p>{t("credits.intro")} {t("credits.madeAt")}</p>

				<section>
					<h2>{t("credits.teamTitle")}</h2>
					<ul>
						{TEAM.map((member) => (
							<li key={member.login}>
								{member.name} ({member.login}): {t(`credits.${member.role}`)}
							</li>
						))}
					</ul>
				</section>

				<section>
					<h2>{t("credits.artTitle")}</h2>
					<p>{t("credits.artIntro")}</p>
					<ul>
						<li>
							{t("credits.fish")} <a href="https://www.magnific.com" target="_blank" rel="noreferrer">Designed by Magnific</a>
						</li>
						<li>
							{t("credits.elements")} <a href="https://www.canva.com" target="_blank" rel="noreferrer">Canva</a>.
						</li>
					</ul>
					<p>{t("credits.ai")}</p>
				</section>

				<section>
					<h2>{t("credits.techTitle")}</h2>
					<p>{TECHNOLOGIES.join(", ")}</p>
				</section>

				<section>
					<h2>{t("credits.thanksTitle")}</h2>
					<p>{t("credits.thanks")}</p>
				</section>

				<footer className="legal-footer">
					<a href="/privacy">{t("common.privacy")}</a>
					<a href="/terms">{t("common.terms")}</a>
					<a href="/credits">{t("common.credits")}</a>
					<LanguageSwitcher />
				</footer>
			</article>
		</div>
	);
}
