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
        const signature = await page.evaluate(() => {
          const heading = document.querySelector<HTMLElement>(".identity h1")!;
          const identity = document.querySelector<HTMLElement>(".identity")!.getBoundingClientRect();
          const footer = document.querySelector<HTMLElement>("footer[data-cv-signature]")!;
          const slogan = footer.querySelector<HTMLElement>(".cv-agent-signature-line")!;
          const headingStyle = getComputedStyle(heading);
          const sloganStyle = getComputedStyle(slogan);
          const stats = footer.querySelector<HTMLElement>(".cv-agent-signature-stats");
          const count = stats?.querySelector<HTMLElement>(".view-count");
          return {
            headingLeftDelta: Math.abs(heading.getBoundingClientRect().left - identity.left),
            sloganRightDelta: Math.abs(slogan.getBoundingClientRect().right - identity.right),
            footerRightDelta: Math.abs(footer.getBoundingClientRect().right - identity.right),
            fontMatch: sloganStyle.fontFamily === headingStyle.fontFamily,
            colorMatch: sloganStyle.color === headingStyle.color,
            sizeRatio: parseFloat(sloganStyle.fontSize) / parseFloat(headingStyle.fontSize),
            transform: sloganStyle.transform,
            statsAligned: count ? Math.abs(count.getBoundingClientRect().right - identity.right) <= 1 : true
          };
        });
        assert.ok(signature.headingLeftDelta <= 1, `CV heading not flush-left: ${locale} ${width}px`);
        assert.ok(signature.sloganRightDelta <= 1 && signature.footerRightDelta <= 1,
          `CV footer/slogan not flush-right: ${locale} ${width}px`);
        assert.ok(signature.fontMatch && signature.colorMatch && signature.transform === "none",
          `CV name and slogan style mismatch: ${locale} ${width}px`);
        assert.ok(signature.sizeRatio > 0.3 && signature.sizeRatio < 0.6,
          `CV slogan should be notably smaller than name: ${locale} ${width}px`);
        assert.ok(signature.statsAligned, `CV view counter not flush-right: ${locale} ${width}px`);
        // Artwork should align with the content edge while its invisible hit area remains 44px.
        const chrome = await page.evaluate(() => {
          const identity = document.querySelector<HTMLElement>(".identity")!.getBoundingClientRect();
          const contactIcons = Array.from(document.querySelectorAll<HTMLElement>(".contact-links .contact-link"));
          const utilityIcons = Array.from(document.querySelectorAll<HTMLElement>(".utilities .icon-action"));
          const isMobile = matchMedia("(max-width: 700px)").matches;
          const first = contactIcons[0].getBoundingClientRect();
          const last = contactIcons.at(-1)!.getBoundingClientRect();
          const lastUtility = utilityIcons.at(-1)!.getBoundingClientRect();
          const controls = [...contactIcons, ...utilityIcons].map((element) => {
            const bounds = element.getBoundingClientRect();
            const centerX = bounds.left + bounds.width / 2;
            const centerY = bounds.top + bounds.height / 2;
            const points = [
              [centerX - 12, centerY], [centerX + 12, centerY],
              [centerX, centerY - 12], [centerX, centerY + 12]
            ];
            const hit = points.every(([x, y]) => {
              const target = document.elementFromPoint(x, y);
              return target === element || (target != null && element.contains(target));
            });
            return { width: bounds.width, height: bounds.height, hit };
          });
          return {
            isMobile,
            alignContact: isMobile ? Math.abs(first.left - identity.left) : Math.abs(last.right - identity.right),
            alignUtilities: Math.abs(lastUtility.right - identity.right),
            controls
          };
        });
        assert.ok(chrome.alignContact <= 1, `Contact icons not edge-aligned: ${locale} ${width}px`);
        assert.ok(chrome.alignUtilities <= 1, `Utility icons not edge-aligned: ${locale} ${width}px`);
        assert.ok(chrome.controls.length >= 5, `Missing icon controls: ${locale} ${width}px`);
        for (const control of chrome.controls) {
          assert.ok(control.width <= 24 && control.height <= 24, `Visible icon container too padded: ${locale} ${width}px`);
          assert.ok(control.hit, `Invisible 44px hit target is blocked: ${locale} ${width}px`);
        }
        if (width === 390) {
          for (const selector of [".contact-link[data-cv-contact=github]", ".utilities .icon-action"]) {
            const icon = page.locator(selector).first();
            await icon.hover();
            const background = await icon.evaluate((element) => getComputedStyle(element).backgroundColor);
            assert.ok(background === "rgba(0, 0, 0, 0)" || background === "transparent", `Icon hover background must stay transparent: ${selector}`);
          }
        }
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
      const footer = page.locator("footer[data-cv-signature]");
      assert.equal(await footer.count(), 1, `Missing signature: ${locale}`);
      assert.match(await footer.innerText(), /Flux to Everything/);
      assert.equal(await footer.evaluate((el) => getComputedStyle(el).display !== "none"), true, `Signature hidden in PDF: ${locale}`);
      const printSignature = await footer.evaluate((element) => {
        const slogan = element.querySelector<HTMLElement>(".cv-agent-signature-line")!;
        const name = document.querySelector<HTMLElement>(".identity h1")!;
        const identity = document.querySelector<HTMLElement>(".identity")!.getBoundingClientRect();
        return {
          delta: Math.abs(slogan.getBoundingClientRect().right - identity.right),
          color: getComputedStyle(slogan).color,
          nameColor: getComputedStyle(name).color,
          small: parseFloat(getComputedStyle(slogan).fontSize) < parseFloat(getComputedStyle(name).fontSize) * .6
        };
      });
      assert.ok(printSignature.delta <= 1 && printSignature.color === printSignature.nameColor && printSignature.small,
        `Printed footer must echo the name on the far right: ${locale}`);
      const stats = footer.locator(".cv-agent-signature-stats");
      if (await stats.count()) {
        assert.equal(await stats.evaluate((el) => getComputedStyle(el).display), "none", `Web-only view stats visible in PDF: ${locale}`);
      }
      const contactTypes = ["email", ...(pack.profile.links.github ? ["github"] : []), "online"];
      for (const kind of contactTypes) {
        const anchor = page.locator(`a[data-cv-contact="${kind}"]`);
        assert.equal(await anchor.count(), 1, `Printable ${kind} link is missing`);
        assert.ok(await anchor.evaluate((element) => getComputedStyle(element).display !== "none"), `${kind} contact link is hidden in print`);
        assert.equal(await anchor.locator("svg").count(), 1, `${kind} contact icon is missing`);
        assert.equal((await anchor.textContent())?.trim(), "", `${kind} should display an icon only`);
        assert.ok((await anchor.getAttribute("aria-label"))?.trim(), `${kind} needs an accessible label`);
        const bounds = await anchor.boundingBox();
        assert.ok(bounds && bounds.width >= 20 && bounds.height >= 20, `${kind} PDF clickable area is too small`);
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
