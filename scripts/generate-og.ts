import fs from "node:fs";
import path from "node:path";
import { activeProfile } from "../src/lib/config";
import { localize } from "../src/lib/i18n";
import { loadProfilePack } from "../src/lib/profile-loader";

export async function main() {
  const pack = loadProfilePack(activeProfile);
  const outDir = path.join(process.cwd(), "profiles", pack.id, "assets", "og");
  fs.mkdirSync(outDir, { recursive: true });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${pack.theme.colors.background}"/>
  <rect x="72" y="72" width="1056" height="486" rx="8" fill="${pack.theme.colors.surface}" stroke="${pack.theme.colors.border}"/>
  <text x="120" y="190" font-family="Inter, system-ui" font-size="34" font-weight="700" fill="${pack.theme.colors.accent}">DossierKit</text>
  <text x="120" y="300" font-family="Inter, system-ui" font-size="58" font-weight="700" fill="${pack.theme.colors.foreground}">${escapeSvg(localize(pack.profile.name, "en"))}</text>
  <text x="120" y="380" font-family="Inter, system-ui" font-size="34" fill="${pack.theme.colors.muted}">${escapeSvg(localize(pack.profile.headline, "en"))}</text>
</svg>`;

  const out = path.join(outDir, "default-og.svg");
  fs.writeFileSync(out, svg, "utf8");
  console.log(`Generated ${out}`);
}

function escapeSvg(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
