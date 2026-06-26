import { generateLlmsText } from "../lib/generate-llms";
import { loadProfilePack } from "../lib/profile-loader";

export function GET() {
  const pack = loadProfilePack();
  return new Response(generateLlmsText(pack), {
    headers: {
      "content-type": "text/plain; charset=utf-8"
    }
  });
}
