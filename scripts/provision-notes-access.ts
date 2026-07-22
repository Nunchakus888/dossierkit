import { appendFile } from "node:fs/promises";

type ApiEnvelope<T> = {
  success: boolean;
  result: T;
  errors?: Array<{ code?: number; message?: string }>;
};

type ZeroTrustOrganization = {
  auth_domain: string;
};

type IdentityProvider = {
  id: string;
  name: string;
  type: string;
};

type AccessApplication = Record<string, unknown> & {
  id: string;
  aud: string;
  domain?: string;
  name?: string;
  type?: string;
};

const pagesApiToken = required("CLOUDFLARE_PAGES_API_TOKEN");
const accessApiToken = required("CLOUDFLARE_ACCESS_API_TOKEN");
const accountId = required("CLOUDFLARE_ACCOUNT_ID");
const ownerEmail = required("NOTES_ACCESS_EMAIL").toLowerCase();
const projectName = process.env.NOTES_MCP_PROJECT_NAME || "dossierkit-notes-mcp";
const applicationName = "DossierKit Notes MCP";
const domain = `${projectName}.pages.dev`;

await ensurePagesProject();
const organization = await ensureZeroTrustOrganization();
const identityProvider = await ensureOneTimePin();
const application = await ensureAccessApplication(identityProvider.id);

const issuer = `https://${organization.auth_domain}`;
const mcpUrl = `https://${domain}/api/mcp`;
await writeOutputs({ access_aud: application.aud, access_issuer: issuer, mcp_url: mcpUrl, project_name: projectName });

console.log(`Cloudflare Access Managed OAuth is ready for ${mcpUrl}.`);

async function ensurePagesProject() {
  const existing = await request<Record<string, unknown>>(pagesApiToken, `/pages/projects/${projectName}`, {
    allowNotFound: true
  });
  if (existing) return existing;

  return request<Record<string, unknown>>(pagesApiToken, "/pages/projects", {
    method: "POST",
    body: { name: projectName, production_branch: "main" }
  });
}

async function ensureZeroTrustOrganization() {
  const existing = await request<ZeroTrustOrganization | ZeroTrustOrganization[]>(accessApiToken, "/access/organizations", {
    allowNotFound: true
  });
  const organization = Array.isArray(existing) ? existing[0] : existing;
  if (organization?.auth_domain) return organization;

  const authDomain = `dossierkit-${accountId.slice(0, 8)}.cloudflareaccess.com`;
  return request<ZeroTrustOrganization>(accessApiToken, "/access/organizations", {
    method: "POST",
    body: {
      auth_domain: authDomain,
      name: "DossierKit Notes",
      session_duration: "24h"
    }
  });
}

async function ensureOneTimePin() {
  const providers = await request<IdentityProvider[]>(accessApiToken, "/access/identity_providers");
  const existing = providers.find((provider) => provider.type === "onetimepin");
  if (existing) return existing;

  return request<IdentityProvider>(accessApiToken, "/access/identity_providers", {
    method: "POST",
    body: { name: "One-time PIN login", type: "onetimepin", config: {} }
  });
}

async function ensureAccessApplication(identityProviderId: string) {
  const applications = await request<AccessApplication[]>(accessApiToken, "/access/apps");
  const existing = applications.find((application) =>
    application.name === applicationName || application.domain === domain
  );
  const oauthConfiguration = {
    enabled: true,
    dynamic_client_registration: {
      enabled: true,
      allow_any_on_localhost: false,
      allow_any_on_loopback: false,
      allowed_uris: [
        "https://chatgpt.com/connector/oauth/*",
        "https://chatgpt.com/connector_platform_oauth_redirect"
      ]
    },
    grant: {
      access_token_lifetime: "15m",
      session_duration: "336h"
    }
  };

  if (existing) {
    const current = await request<AccessApplication>(accessApiToken, `/access/apps/${existing.id}`);
    if (managedOAuthMatches(current.oauth_configuration, oauthConfiguration)) return current;
    return request<AccessApplication>(accessApiToken, `/access/apps/${existing.id}`, {
      method: "PUT",
      body: { ...current, oauth_configuration: oauthConfiguration }
    });
  }

  return request<AccessApplication>(accessApiToken, "/access/apps", {
    method: "POST",
    body: {
      name: applicationName,
      type: "mcp",
      domain,
      session_duration: "24h",
      app_launcher_visible: false,
      options_preflight_bypass: true,
      allowed_idps: [identityProviderId],
      auto_redirect_to_identity: true,
      policies: [
        {
          name: "Allow DossierKit Notes owner",
          decision: "allow",
          include: [{ email: { email: ownerEmail } }],
          exclude: [],
          require: []
        }
      ],
      oauth_configuration: oauthConfiguration
    }
  });
}

function managedOAuthMatches(current: unknown, expected: unknown): boolean {
  if (!current || !expected || typeof current !== "object" || typeof expected !== "object") return false;
  return Object.entries(expected).every(([key, expectedValue]) => {
    const currentValue = (current as Record<string, unknown>)[key];
    if (Array.isArray(expectedValue)) {
      return Array.isArray(currentValue) && expectedValue.every((value) => currentValue.includes(value));
    }
    if (expectedValue && typeof expectedValue === "object") {
      return managedOAuthMatches(currentValue, expectedValue);
    }
    return currentValue === expectedValue;
  });
}

function request<T>(
  apiToken: string,
  path: string,
  options: { method?: string; body?: unknown; allowNotFound: true }
): Promise<T | undefined>;
function request<T>(
  apiToken: string,
  path: string,
  options?: { method?: string; body?: unknown; allowNotFound?: false }
): Promise<T>;
async function request<T>(
  apiToken: string,
  path: string,
  options: { method?: string; body?: unknown; allowNotFound?: boolean } = {}
): Promise<T | undefined> {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json"
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) })
  });

  if (options.allowNotFound && response.status === 404) return undefined;

  const payload = await response.json() as ApiEnvelope<T>;
  if (!response.ok || !payload.success) {
    const details = payload.errors?.map((error) => error.message || `code ${error.code}`).join("; ");
    throw new Error(`Cloudflare API ${options.method || "GET"} ${path} failed (${response.status}): ${details || response.statusText}`);
  }
  return payload.result;
}

async function writeOutputs(outputs: Record<string, string>) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (!outputFile) return;
  await appendFile(outputFile, Object.entries(outputs).map(([key, value]) => `${key}=${value}\n`).join(""));
}

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
