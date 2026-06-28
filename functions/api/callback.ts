export const onRequestGet = async ({ request, env }: any) => {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const error = requestUrl.searchParams.get("error");

  if (error) {
    return oauthError(`GitHub OAuth error: ${error}`);
  }

  if (!code || !state) {
    return oauthError("Missing GitHub OAuth code or state.");
  }

  const expectedState = parseCookie(request.headers.get("Cookie") || "").cms_oauth_state;
  if (!expectedState || expectedState !== state) {
    console.log(
      JSON.stringify({
        event: "cms_oauth_state_invalid",
        provider: "github",
        hasExpectedState: Boolean(expectedState)
      })
    );
    return oauthError("Invalid GitHub OAuth state.");
  }

  const clientId = env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret = env.GITHUB_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return oauthError("Missing GitHub OAuth client configuration.");
  }

  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "dossierkit-decap-cms"
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: `${requestUrl.origin}/api/callback`
    })
  });

  const tokenPayload = (await tokenResponse.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!tokenResponse.ok || !tokenPayload.access_token) {
    console.log(
      JSON.stringify({
        event: "cms_oauth_token_exchange_failed",
        provider: "github",
        status: tokenResponse.status,
        error: tokenPayload.error || "missing_access_token"
      })
    );
    return oauthError(
      tokenPayload.error_description || tokenPayload.error || "GitHub token exchange failed."
    );
  }

  console.log(
    JSON.stringify({
      event: "cms_oauth_token_exchange_succeeded",
      provider: "github"
    })
  );

  return oauthResult("success", { token: tokenPayload.access_token, provider: "github" }, true);
};

function oauthError(message: string) {
  return oauthResult("error", { error: message, provider: "github" });
}

function oauthResult(status: "success" | "error", payload: unknown, clearCookie = false) {
  const message = `authorization:github:${status}:${JSON.stringify(payload)}`;
  const title = status === "success" ? "Authorized" : "Authorization failed";
  const body = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
  </head>
  <body>
    <p>${title}. You can close this window.</p>
    <script>
      (function () {
        var provider = "github";
        var origin = window.location.origin;
        var handshake = "authorizing:" + provider;
        var result = ${JSON.stringify(message)};
        var closed = false;
        var interval;
        var timeout;

        function finish() {
          if (closed) return;
          closed = true;
          clearInterval(interval);
          clearTimeout(timeout);
          if (window.opener) {
            window.opener.postMessage(result, origin);
          }
          window.setTimeout(function () {
            window.close();
          }, 100);
        }

        if (!window.opener) {
          return;
        }

        window.addEventListener("message", function (event) {
          if (event.origin !== origin || event.data !== handshake) return;
          finish();
        });

        window.opener.postMessage(handshake, origin);
        interval = window.setInterval(function () {
          if (!closed && window.opener) {
            window.opener.postMessage(handshake, origin);
          }
        }, 250);
        timeout = window.setTimeout(finish, 4000);
      })();
    </script>
  </body>
</html>`;

  const headers: Record<string, string> = {
    "Content-Type": "text/html; charset=utf-8"
  };
  if (clearCookie) {
    headers["Set-Cookie"] = "cms_oauth_state=; Path=/api; Max-Age=0; HttpOnly; Secure; SameSite=Lax";
  }

  return new Response(body, {
    status: status === "success" ? 200 : 400,
    headers
  });
}

function parseCookie(header: string) {
  return header.split(";").reduce<Record<string, string>>((acc, item) => {
    const [rawKey, ...rawValue] = item.trim().split("=");
    if (!rawKey) return acc;
    acc[rawKey] = decodeURIComponent(rawValue.join("="));
    return acc;
  }, {});
}
