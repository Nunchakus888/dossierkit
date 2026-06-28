export const onRequestGet = async ({ request, env }: any) => {
  const clientId = env.GITHUB_OAUTH_CLIENT_ID;
  if (!clientId) {
    return htmlResponse(errorPage("Missing GITHUB_OAUTH_CLIENT_ID."), 500);
  }

  const requestUrl = new URL(request.url);
  const state = crypto.randomUUID();
  const scope = requestUrl.searchParams.get("scope") || "repo";
  const redirectUri = `${requestUrl.origin}/api/callback`;
  const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", scope);
  authorizeUrl.searchParams.set("state", state);

  console.log(
    JSON.stringify({
      event: "cms_oauth_authorize_redirect",
      provider: "github",
      scope,
      redirectUri
    })
  );

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl.toString(),
      "Set-Cookie": cookie("cms_oauth_state", state, 600)
    }
  });
};

function cookie(name: string, value: string, maxAge: number) {
  return `${name}=${encodeURIComponent(value)}; Path=/api; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function errorPage(message: string) {
  return `<!doctype html><meta charset="utf-8"><title>CMS Auth Error</title><p>${escapeHtml(message)}</p>`;
}

function htmlResponse(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return entities[char] || char;
  });
}
