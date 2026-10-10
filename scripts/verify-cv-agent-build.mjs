import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { parse as parseYaml } from "yaml";

const root = path.resolve("dist");
const profileRoot = path.join("profiles", process.env.ACTIVE_PROFILE || "default");
const enabled = fs.existsSync(path.join(profileRoot, "cv-agent.yaml"));
const cvConfig = enabled ? parseYaml(fs.readFileSync(path.join(profileRoot, "cv-agent.yaml"), "utf8")) : null;
const oldPdfStem = enabled ? parseYaml(fs.readFileSync(path.join(profileRoot, "resume.yaml"), "utf8")).filename : null;
const requirePdf = process.argv.includes("--require-pdf");
const isAgentPath = (pathname) => /^\/(zh|en)\/cv-agent(?:\/|\.txt$|$)/.test(pathname) || pathname.startsWith("/resumes/cv-agent/");
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file); else if (entry.isFile()) files.push(file);
  }
}
walk(root);
for (const locale of ["zh", "en"]) {
  const file = path.join(root, locale, "cv-agent/index.html");
  if (!enabled) { assert.ok(!fs.existsSync(file)); continue; }
  const html = fs.readFileSync(file, "utf8");
  assert.match(html, /<meta\b[^>]*name="robots"[^>]*content="[^"]*noindex/);
  assert.match(html, /<meta\b[^>]*name="referrer"[^>]*content="no-referrer"/);
  assert.match(html, /data-pagefind-ignore="all"/);
  assert.ok(!html.includes("data-pagefind-body"));
  assert.ok(!html.includes("dossierkit:page-ref"), "Unlisted CV must not advertise a public page-ref meta tag");
  assert.ok(!/<nav\b/i.test(html), "No global site navigation on the sharing CV");
  assert.ok(!/待补|后续补|当前短板|to be filled|not a demo/i.test(html));
  assert.match(html, /data-claim-status="implemented"/);
  assert.match(html, /data-claim-status="designed"/);
  assert.ok(!html.includes('class="contact-data"'));
  assert.ok(!html.includes('class="claim-status"'));
  assert.match(html, /<footer[^>]*data-cv-signature[^>]*>/, 'Missing signature footer');
  const mainNav = parseYaml(fs.readFileSync(path.join(profileRoot, "navigation.yaml"), "utf8"));
  const mainMotto = mainNav.footer?.tagline?.[locale];
  assert.ok(mainMotto && html.includes(mainMotto), "CV and main site must share one slogan");
  assert.ok(!html.includes('cv-agent-signature-web') && !html.includes('cv-agent-signature-print'),
    'Remove divergent print/web slogan branches');
  assert.match(html, /class="cv-agent-print-page-2"/, 'Missing dedicated PDF last-page frame');
  const signature = html.match(/<footer[^>]*data-cv-signature[^>]*>[\s\S]*?<\/footer>/)?.[0] || '';
  assert.ok(signature.includes(mainMotto), 'Single footer slogan must match navigation config');
  assert.ok(!html.includes('data-pagefind-body'));
  const viewManifest = JSON.parse(fs.readFileSync("src/lib/view-counter/manifest.json", "utf8"));
  assert.ok(Object.hasOwn(viewManifest.pages, `/${locale}/cv-agent`), "Unlisted CV missing from server-only counter allowlist");
  assert.match(html, new RegExp(`<link\\s+rel="alternate"\\s+type="text/plain"\\s+href="/${locale}/cv-agent\\.txt"`));
  const plainText = fs.readFileSync(path.join(root, locale, "cv-agent.txt"), "utf8");
  assert.ok(plainText.includes(`Email: ${parseYaml(fs.readFileSync(path.join(profileRoot, "profile.yaml"), "utf8")).links.email}`));
  assert.ok(!plainText.includes(locale === "zh" ? "[已实现]" : "[Implemented]"));
  assert.ok(!plainText.includes(locale === "zh" ? "[设计方向]" : "[Designed]"));
  assert.match(html, new RegExp(`href="/${locale === "zh" ? "en" : "zh"}/cv-agent/"`));
  for (const match of html.matchAll(/href="([^"#]+)"/g)) {
    const url = new URL(match[1].replaceAll("&amp;", "&"), "https://cv.invalid/");
    if (url.origin !== "https://cv.invalid") continue;
    if (url.pathname.endsWith(".pdf")) {
      if (requirePdf) {
        const pdf = fs.readFileSync(path.join(root, decodeURIComponent(url.pathname.slice(1))));
        assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
      }
      continue;
    }
    const target = path.join(root, url.pathname.slice(1));
    assert.ok(fs.existsSync(target), `Broken local link: ${url.pathname}`);
  }
  for (const kind of ["email", "github", "online"]) {
    assert.match(html, new RegExp(`data-cv-contact="${kind}"`), `Missing ${kind} link in CV`);
  }
  if (requirePdf) {
    assert.match(html, /href="\/resumes\/cv-agent\/[^"]+\.pdf"/);
    const expectedName = `${cvConfig.pdfFilenameBase || oldPdfStem}-${locale}.pdf`;
    assert.ok(html.includes(`download="${expectedName}"`), `Wrong PDF download filename: ${expectedName}`);
    const previous = path.join(root, "resumes", "cv-agent", `${oldPdfStem}-${locale}.pdf`);
    assert.ok(fs.existsSync(previous), `Previously shared Agent CV PDF path missing: ${previous}`);
  }
  const legacy = fs.readFileSync(path.join(root, locale, "cv/index.html"), "utf8");
  assert.ok(!legacy.includes("cv-agent"), "Legacy CV must have no Agent CV entry point");
}
let fragments = 0;
for (const file of files) {
  const relative = path.relative(root, file).split(path.sep).join("/");
  if (/^(zh|en)\/cv-agent(?:\/|\.txt$)/.test(relative) || relative.startsWith("resumes/cv-agent/")) continue;
  if (file.endsWith(".html")) {
    const html = fs.readFileSync(file, "utf8");
    for (const match of html.matchAll(/(?:href|src|action)="([^"]+)"/g)) {
      const url = new URL(match[1].replaceAll("&amp;", "&"), `https://cv.invalid/${relative}`);
      assert.ok(!isAgentPath(url.pathname), `Public inbound link in ${relative}`);
    }
  } else if (/\.(?:xml|json|txt)$/.test(file)) {
    const source = fs.readFileSync(file, "utf8");
    assert.ok(!/\/(?:zh|en)\/cv-agent(?:\/|\.txt|["<\s])|\/resumes\/cv-agent\//.test(source), `Public index exposes the Agent CV: ${relative}`);
  } else if (file.endsWith(".pf_fragment")) {
    const buffer = fs.readFileSync(file);
    const decoded = buffer[0] === 0x1f && buffer[1] === 0x8b ? gunzipSync(buffer) : buffer;
    assert.ok(!decoded.toString("utf8").includes("/cv-agent/"), `Pagefind fragment exposes the Agent CV: ${relative}`);
    fragments++;
  }
}
if (enabled) {
  const headers = fs.readFileSync(path.join(root, "_headers"), "utf8");
  for (const route of ["/zh/cv-agent*", "/en/cv-agent*", "/resumes/cv-agent/*"]) assert.ok(headers.includes(`${route}\n  X-Robots-Tag: noindex`));
}
console.log(`Agent CV isolation verified: ${files.length} output files, ${fragments} Pagefind fragments; enabled=${enabled}.`);
