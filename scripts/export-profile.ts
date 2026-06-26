import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { activeProfile } from "../src/lib/config";

export async function main(args = process.argv.slice(2)) {
  const profileId = args[0] || activeProfile;
  const profileDir = path.join(process.cwd(), "profiles", profileId);

  if (!fs.existsSync(profileDir)) {
    throw new Error(`Profile does not exist: ${profileDir}`);
  }

  const outDir = path.join(process.cwd(), "exports");
  const outFile = path.join(outDir, `${profileId}-profile-pack.tgz`);
  fs.mkdirSync(outDir, { recursive: true });

  const result = spawnSync("tar", ["-czf", outFile, "-C", path.join(process.cwd(), "profiles"), profileId], {
    stdio: "inherit"
  });

  if (result.status !== 0) {
    throw new Error("Profile export failed.");
  }

  console.log(`Exported ${outFile}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
