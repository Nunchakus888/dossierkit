import fs from "node:fs";
import path from "node:path";
import { listProfileAssets } from "../../lib/profile-loader";

const contentTypes: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf"
};

export function getStaticPaths() {
  return listProfileAssets().map((asset) => ({
    params: { asset: `${asset.profileId}/${asset.relativePath}` },
    props: { fullPath: asset.fullPath }
  }));
}

export function GET({ props }: { props: { fullPath: string } }) {
  const ext = path.extname(props.fullPath).toLowerCase();
  const file = fs.readFileSync(props.fullPath);
  return new Response(file, {
    headers: {
      "content-type": contentTypes[ext] || "application/octet-stream"
    }
  });
}
