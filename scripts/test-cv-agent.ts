import assert from "node:assert/strict";
import { locales } from "../src/lib/config";
import { loadProfilePack, readContentCollection } from "../src/lib/profile-loader";
import { agentPdfFileName, agentPdfPath, buildCvAgentView, cvAgentSchema, readCvAgentConfig, renderCvAgentPlainText } from "../src/lib/cv-agent";

const pack = loadProfilePack();
const config = readCvAgentConfig(pack.root);
if (!config) {
  console.log("CV Agent: active profile has no opt-in configuration; skipped.");
} else {
  const before = JSON.stringify(pack);
  const notes = locales.flatMap((locale) => readContentCollection(locale, "notes"));
  for (const locale of locales) {
    const view = buildCvAgentView(pack, config, notes, locale);
    assert.equal(view.experiences.length, config.experiences.length);
    for (const item of view.experiences) {
      const source = pack.experience.experiences.find((entry) => entry.company.en === item.company.en)!;
      assert.deepEqual(item.period, source.period);
      assert.deepEqual(item.role, source.role);
    }
    const base = config.pdfFilenameBase || pack.resume.filename;
    assert.equal(view.pdfDownloadFilename, agentPdfFileName(base, locale));
    assert.equal(view.pdfHref, agentPdfPath(base, locale));
    assert.ok(decodeURIComponent(view.pdfHref).endsWith(`/${view.pdfDownloadFilename}`));
    assert.notEqual(view.pdfHref, `/resumes/${pack.resume.filename}-${locale}.pdf`);
    assert.match(view.pdfHref, /^\/resumes\/cv-agent\/.+-(zh|en)\.pdf$/);
    assert.ok(view.research.every((item) => item.sources.every((source) => notes.some((note) => source.href === `/${note.locale}/notes/${note.slug}/`))));
    const plainText = renderCvAgentPlainText(pack, view, locale, "https://cv.example/");
    assert.ok(plainText.includes(`Email: ${pack.profile.links.email}`));
    assert.ok(!plainText.includes(locale === "zh" ? "[已实现]" : "[Implemented]"));
    assert.ok(!plainText.includes(locale === "zh" ? "[设计方向]" : "[Designed]"));
    assert.ok(plainText.includes("https://cv.example/zh/notes/"));
  }
  assert.equal(JSON.stringify(pack), before, "Variant must not mutate the legacy ProfilePack");
  assert.equal(cvAgentSchema.safeParse({ ...config, experiences: [...config.experiences, config.experiences[0]] }).success, false);
  assert.equal(cvAgentSchema.safeParse({ ...config, architecture: { ...config.architecture, points: [{ ...config.architecture.points[0], status: "unknown" }, ...config.architecture.points.slice(1)] } }).success, false);
  assert.throws(() => buildCvAgentView(pack, { ...config, experiences: [{ ...config.experiences[0], sourceCompany: "missing-company" }] }, notes, "zh"), /expected one experience/);
  assert.throws(() => buildCvAgentView(pack, config, [], "zh"), /unresolved note/);
  assert.throws(() => agentPdfPath("../../legacy", "zh"), /Unsafe/);
  assert.throws(() => agentPdfPath("oops\\bad", "en"), /Unsafe/);
  assert.throws(() => agentPdfPath("..", "zh"), /Unsafe/);
  if (config.pdfFilenameBase) {
    assert.equal(agentPdfFileName(config.pdfFilenameBase, "zh"), `${config.pdfFilenameBase}-zh.pdf`);
    assert.equal(agentPdfFileName(config.pdfFilenameBase, "en"), `${config.pdfFilenameBase}-en.pdf`);
  }
  const onlyChinese = notes.filter((note) => note.locale === "zh");
  if (config.research.every((item) => item.sources.every((source) => source.noteRef.startsWith("zh/")))) {
    const fallback = buildCvAgentView(pack, config, onlyChinese, "en");
    assert.ok(fallback.research.every((item) => item.sources.every((source) => source.sourceLocale === "zh" && source.href.startsWith("/zh/notes/"))));
  }
  console.log("CV Agent: selectors, bilingual references, fallbacks, PDF namespace and non-mutation passed.");
}
