import { mkdir, rm, writeFile } from "node:fs/promises";

const outputDirectory = new URL("../dist-mcp/", import.meta.url);

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
await writeFile(
  new URL("index.html", outputDirectory),
  "<!doctype html><html lang=\"en\"><meta charset=\"utf-8\"><meta name=\"robots\" content=\"noindex\"><title>DossierKit Notes MCP</title><body>DossierKit Notes MCP</body></html>\n"
);

console.log("Built the isolated Notes MCP artifact.");
