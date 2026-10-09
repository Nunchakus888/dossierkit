import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { locales } from "../src/lib/config";
import { loadProfilePack } from "../src/lib/profile-loader";
import { agentPdfFileName, agentPdfPath, readCvAgentConfig } from "../src/lib/cv-agent";

// Explicitly consumes an existing build and only writes the cv-agent namespace.
async function main() {
  const pack = loadProfilePack();
  const config = readCvAgentConfig(pack.root);
  if (!config) return;
  const pdfBase = config.pdfFilenameBase || pack.resume.filename;
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
  const receipt: Array<{ locale: string; path: string; fileName: string; previousPath: string; pages: number; widths: number[]; links: string[] }> = [];
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
      // Chromium otherwise embeds the temporary local server in PDF link annotations.
      const links = await page.evaluate(() => {
        const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
        if (!canonical?.href) throw new Error("A public canonical URL is required for PDF references");
        const base = new URL(canonical.href);
        if (!/^https?:$/.test(base.protocol) || ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) {
          throw new Error("PDF references require a non-local public site URL");
        }
        return Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]")).map((link) => {
          link.href = new URL(link.getAttribute("href")!, base).href;
          return link.href;
        });
      });
      assert.ok(links.every((href) => !/^https?:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::|\/)/.test(href)), "PDF contains local build references");
      await page.emulateMedia({ media: "print" });
      const contactTypes = ["email", ...(pack.profile.links.github ? ["github"] : []), "online"];
      for (const kind of contactTypes) {
        const anchor = page.locator(`a[data-cv-contact="${kind}"]`);
        assert.equal(await anchor.count(), 1, `Printable ${kind} link is missing`);
        assert.ok(await anchor.evaluate((element) => getComputedStyle(element).display !== "none"), `${kind} contact link is hidden in print`);
        assert.equal(await anchor.locator("svg").count(), 1, `${kind} contact icon is missing`);
      }
      const pdfPath = agentPdfPath(pdfBase, locale);
      const output = path.join(root, decodeURIComponent(pdfPath.slice(1)));
      fs.mkdirSync(path.dirname(output), { recursive: true });
      const buffer = await page.pdf({ path: output, format: "A4", printBackground: true, preferCSSPageSize: true });
      const pdfText = buffer.toString("latin1");
      const pages = (pdfText.match(/\/Type\s*\/Page\b/g) || []).length;
      assert.equal(pages, 2, `${locale} Agent CV should fit two A4 pages; found ${pages}`);
      assert.ok(!/\/URI\s*\(https?:\/\/(?:127\.0\.0\.1|localhost)/.test(pdfText), "PDF annotation exposes the temporary build server");
      const contactDestinations = [
        `mailto:${pack.profile.links.email}`,
        ...(pack.profile.links.github ? [pack.profile.links.github] : []),
        new URL(`/${locale}/cv-agent/`, process.env.PUBLIC_SITE_URL || "https://sunionpeaks.pages.dev").href
      ];
      for (const destination of contactDestinations) {
        assert.ok(links.includes(destination), `PDF HTML does not link to ${destination}`);
        assert.ok(pdfText.includes(`/URI (${destination})`), `PDF annotation is missing: ${destination}`);
      }
      // Previously shared URLs continue working; the new download uses the complete descriptive name.
      const previousPath = agentPdfPath(pack.resume.filename, locale);
      if (previousPath !== pdfPath) {
        const alias = path.join(root, decodeURIComponent(previousPath.slice(1)));
        fs.mkdirSync(path.dirname(alias), { recursive: true });
        fs.copyFileSync(output, alias);
      }
      const fileName = agentPdfFileName(pdfBase, locale);
      fs.copyFileSync(output, path.join(artifacts, fileName));
      receipt.push({ locale, path: pdfPath, fileName, previousPath, pages, widths, links });
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
