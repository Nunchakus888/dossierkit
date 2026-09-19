import { spawnSync } from "node:child_process";

const command = process.argv[2];
const args = process.argv.slice(3);
const scripts: Record<string, string> = {
  "create-profile": "scripts/create-profile.ts",
  validate: "scripts/validate-profile.ts",
  "generate-admin-config": "scripts/generate-cms.ts",
  "generate-pdf": "scripts/generate-pdf.ts",
  "export-profile": "scripts/export-profile.ts",
  "generate-og": "scripts/generate-og.ts"
};

if (!command || !(command in scripts)) {
  console.error(`Usage: pnpm dossier <${Object.keys(scripts).join("|")}>`);
  process.exit(1);
}

const result = spawnSync("pnpm", ["tsx", scripts[command], ...args], { stdio: "inherit" });
process.exit(result.status ?? 1);
