import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { locales } from "../src/lib/config";
import { loadProfilePack } from "../src/lib/profile-loader";
import { agentPdfPath, readCvAgentConfig } from "../src/lib/cv-agent";

// Explicitly consumes an existing build and only writes the cv-agent namespace.
async function main() {
  const pack = loadProfilePack();
  if (!readCvAgentConfig(pack.root)) return;
  const root = path.resolve("dist");
  const artifacts = path.resolve("artifacts/cv-agent");
  for (const locale of locales) {
    assert.ok(fs.existsSync(path.join(root, locale, "cv-agent/index.html")), "Build the site before exporting the Agent CV");
  }
  fs.mkdirSync(artifacts, { recursive: true });
  const mime: Record<string, string> = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".pdf": "application/pdf", ".woff2": "font/woff2" };
  const server = http.createServer((req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url || "/", "http://localhost").pathname);
      let file = path.resolve(root, `.${pathname}`);
      if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
      res.writeHead(200, { "content-type": mime[path.extname(file)] || "application/octet-stream" });
      fs.createReadStream(file).on("error", () => res.destroy()).pipe(res);
    } catch { res.writeHead(400).end(); }
  });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  const receipt: Array<{ locale: string; path: string; pages: number; widths: number[] }> = [];
  try {
    browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {});
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    for (const locale of locales) {
      const page = await browser.newPage();
      const response = await page.goto(`http://127.0.0.1:${address.port}/${locale}/cv-agent/`, { waitUntil: "networkidle" });
      assert.equal(response?.status(), 200);
      await page.evaluate(() => document.fonts.ready);
      const widths = [320, 390, 1280];
      for (const width of widths) {
        await page.setViewportSize({ width, height: 1000 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Horizontal overflow: ${locale} at ${width}px`);
        if (width !== 320) await page.screenshot({ path: path.join(artifacts, `${locale}-${width}.png`), fullPage: true });
      }
      await page.emulateMedia({ media: "print" });
      const pdfPath = agentPdfPath(pack.resume.filename, locale);
      const output = path.join(root, pdfPath.slice(1));
      fs.mkdirSync(path.dirname(output), { recursive: true });
      const buffer = await page.pdf({ path: output, format: "A4", printBackground: true, preferCSSPageSize: true });
      const pages = (buffer.toString("latin1").match(/\/Type\s*\/Page\b/g) || []).length;
      assert.equal(pages, 2, `${locale} Agent CV should fit two A4 pages; found ${pages}`);
      fs.copyFileSync(output, path.join(artifacts, `${pack.resume.filename}-agent-${locale}.pdf`));
      receipt.push({ locale, path: pdfPath, pages, widths });
      await page.close();
    }
    fs.writeFileSync(path.join(artifacts, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n");
    console.log("Agent CV PDF and responsive checks:", JSON.stringify(receipt));
  } finally {
    await browser?.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
