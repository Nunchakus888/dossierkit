import { loadProfilePack } from "../lib/profile-loader";
import { generateProfileJson } from "../lib/generate-profile-json";

export function GET() {
  const pack = loadProfilePack();
  return new Response(JSON.stringify(generateProfileJson(pack), null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  });
}
