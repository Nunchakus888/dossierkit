import fs from "node:fs";
import path from "node:path";
import { parse, stringify } from "yaml";

export async function main(args = process.argv.slice(2)) {
  const profileId = args[0];
  const fromIndex = args.indexOf("--from");
  const sourceProfile = fromIndex >= 0 ? args[fromIndex + 1] : "default";

  if (!profileId) {
    throw new Error("Usage: pnpm dossier create-profile <profileId> [--from default]");
  }

  const source = path.join(process.cwd(), "profiles", sourceProfile);
  const target = path.join(process.cwd(), "profiles", profileId);

  if (!fs.existsSync(source)) {
    throw new Error(`Source profile does not exist: ${source}`);
  }

  if (fs.existsSync(target)) {
    throw new Error(`Target profile already exists: ${target}`);
  }

  fs.cpSync(source, target, { recursive: true });

  const profilePath = path.join(target, "profile.yaml");
  const profile = parse(fs.readFileSync(profilePath, "utf8"));
  profile.id = profileId;
  fs.writeFileSync(profilePath, stringify(profile), "utf8");

  console.log(`Created profile pack: profiles/${profileId}`);
  console.log(`Build with ACTIVE_PROFILE=${profileId} pnpm build`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
