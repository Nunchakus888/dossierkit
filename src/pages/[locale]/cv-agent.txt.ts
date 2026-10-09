import { locales, type Locale } from "../../lib/config";
import { loadProfilePack, readContentCollection } from "../../lib/profile-loader";
import { buildCvAgentView, readCvAgentConfig, renderCvAgentPlainText } from "../../lib/cv-agent";

export function getStaticPaths() {
  const pack = loadProfilePack();
  return readCvAgentConfig(pack.root)
    ? locales.map((locale) => ({ params: { locale } }))
    : [];
}

export function GET({ params, site, url }: { params: { locale?: string }; site?: URL; url: URL }) {
  const locale = params.locale as Locale;
  const pack = loadProfilePack();
  const config = readCvAgentConfig(pack.root);
  if (!config) throw new Error("Missing cv-agent configuration for the active profile.");
  const notes = locales.flatMap((language) => readContentCollection(language, "notes"));
  const view = buildCvAgentView(pack, config, notes, locale);
  return new Response(renderCvAgentPlainText(pack, view, locale, (site || url).href), {
    headers: { "content-type": "text/plain; charset=utf-8" }
  });
}
