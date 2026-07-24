export type PublicContentKind = "cases" | "lab" | "writing" | "notes";

const unfinishedWording = [
  /\bto be filled\b/i,
  /待补/
];

const portfolioInternalWording = [
  /\bdemos?\b/i,
  /\bexamples?\b/i,
  /\bnot a demo\b/i,
  /后续/,
  /短板/,
  /面试官/,
  /不需要/,
  /不作为/
];

export function findPublicContentViolation(kind: PublicContentKind, content: string) {
  const patterns = kind === "notes"
    ? unfinishedWording
    : [...unfinishedWording, ...portfolioInternalWording];
  return patterns.find((pattern) => pattern.test(content));
}
