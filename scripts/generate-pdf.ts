import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright";
import { activeProfile, locales } from "../src/lib/config";
import { loadProfilePack } from "../src/lib/profile-loader";

const contentTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8"
};

export async function main(args = process.argv.slice(2)) {
  const skipBuild = args.includes("--skip-build");
  const dist = path.join(process.cwd(), "dist");

  if (!skipBuild || !fs.existsSync(dist)) {
    const result = spawnSync("pnpm", ["build"], { stdio: "inherit" });
    if (result.status !== 0) {
      throw new Error("Build failed; cannot generate PDF.");
    }
  }

  const pack = loadProfilePack(activeProfile);
  const server = await startStaticServer(dist);
  const browser = await launchBrowser();

  try {
    for (const locale of locales) {
      const page = await browser.newPage({ viewport: { width: 1200, height: 1600 } });
      await page.goto(`${server.url}/${locale}/cv/`, { waitUntil: "networkidle" });
      await page.evaluate(async () => {
        if ("fonts" in document) await document.fonts.ready;
      });
      await page.emulateMedia({ media: "print" });

      const fileName = `${pack.resume.filename}-${locale}.pdf`;
      const publicOut = path.join(process.cwd(), "public", "resumes", fileName);
      const distOut = path.join(dist, "resumes", fileName);

      fs.mkdirSync(path.dirname(publicOut), { recursive: true });
      fs.mkdirSync(path.dirname(distOut), { recursive: true });

      await page.pdf({
        path: publicOut,
        format: "A4",
        printBackground: true,
        margin: {
          top: "16mm",
          right: "15mm",
          bottom: "17mm",
          left: "15mm"
        }
      });

      fs.copyFileSync(publicOut, distOut);
      await page.close();
      console.log(`Generated ${publicOut}`);
    }
  } finally {
    await browser.close();
    await new Promise<void>((resolve) => server.instance.close(() => resolve()));
  }
}

async function launchBrowser() {
  try {
    return await chromium.launch();
  } catch (error) {
    const executablePath = findSystemBrowser();
    if (!executablePath) {
      throw error;
    }

    console.warn(`Playwright browser cache is not installed. Falling back to ${executablePath}`);
    return chromium.launch({ executablePath });
  }
}

function findSystemBrowser() {
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
  ];

  return candidates.find((candidate) => fs.existsSync(candidate));
}

async function startStaticServer(root: string) {
  const instance = http.createServer((req, res) => {
    const requestUrl = new URL(req.url || "/", "http://127.0.0.1");
    const safePath = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, "");
    let filePath = path.join(root, safePath);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    if (!fs.existsSync(filePath)) {
      const htmlPath = path.join(root, safePath, "index.html");
      filePath = fs.existsSync(htmlPath) ? htmlPath : filePath;
    }

    if (!fs.existsSync(filePath) || !filePath.startsWith(root)) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "content-type": contentTypes[ext] || "application/octet-stream" });
    fs.createReadStream(filePath).pipe(res);
  });

  await new Promise<void>((resolve) => instance.listen(0, "127.0.0.1", () => resolve()));
  const address = instance.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not start static server.");
  }

  return {
    instance,
    url: `http://127.0.0.1:${address.port}`
  };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
