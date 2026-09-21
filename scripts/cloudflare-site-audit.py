"""Read-only Cloudflare audit. Never export API tokens or environment values."""
import datetime as dt
import json
import os
from pathlib import Path
import re
import urllib.error
import urllib.request

TOKEN = os.environ["CLOUDFLARE_API_TOKEN"]
ACCOUNT = os.environ["CLOUDFLARE_ACCOUNT_ID"]
NOW = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)

def api(path, body=None):
    request = urllib.request.Request(
        "https://api.cloudflare.com/client/v4" + path,
        data=None if body is None else json.dumps(body).encode(),
        headers={"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=40) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        try:
            details = json.load(error).get("errors", [])
        except Exception:
            details = []
        return {"success": False, "http_status": error.code, "errors": details}
    except Exception as error:
        return {"success": False, "error": type(error).__name__}

def collect(path):
    rows = []
    for page in range(1, 51):
        result = api(path + ("&" if "?" in path else "?") + f"per_page=10&page={page}")
        if result.get("success") is False:
            return {"error": result, "partial_count": len(rows)}
        batch = result.get("result", [])
        if not isinstance(batch, list):
            return {"error": "Unexpected list response"}
        rows.extend(batch)
        info = result.get("result_info") or {}
        if len(batch) < 10 or (info.get("total_pages") and page >= info["total_pages"]):
            return rows
    return {"error": "Pagination limit reached", "partial_count": len(rows)}

def gql(query):
    return api("/graphql", {"query": query, "variables": {}})

def stamp(value):
    return value.isoformat().replace("+00:00", "Z")

def groups(start, end, dimensions, host=None, extra_filter="", dataset="rumPageloadEventsAdaptiveGroups", fields=None):
    filters = ["datetime_geq:" + json.dumps(stamp(start)), "datetime_lt:" + json.dumps(stamp(end))]
    if host:
        filters.append("requestHost:" + json.dumps(host))
    if extra_filter:
        filters.append(extra_filter)
    fields = fields or "count sum{visits} avg{sampleInterval}"
    query = "{viewer{accounts(filter:{accountTag:" + json.dumps(ACCOUNT) + "}){" + dataset + "(limit:500,filter:{" + ",".join(filters) + "}){" + fields + " dimensions{" + dimensions + "}}}}}"
    result = gql(query)
    if result.get("errors") or result.get("success") is False:
        return {"errors": result.get("errors", result)}
    try:
        return result["data"]["viewer"]["accounts"][0][dataset]
    except (KeyError, IndexError, TypeError):
        return {"error": "Unexpected GraphQL result"}

report = {"generated_at": stamp(NOW), "read_only": True, "pages": [], "analytics": {}, "http": []}
projects = collect(f"/accounts/{ACCOUNT}/pages/projects")
if isinstance(projects, list):
    for project in projects:
        prod = (project.get("deployment_configs") or {}).get("production") or {}
        build = project.get("build_config") or {}
        deployment = project.get("canonical_deployment") or {}
        source = project.get("source") or {}
        source_config = source.get("config") or {}
        report["pages"].append({
            "name": project.get("name"), "subdomain": project.get("subdomain"),
            "domains": project.get("domains"), "production_branch": project.get("production_branch"),
            "source_type": source.get("type"), "source_repository": source_config.get("repo_name"),
            "source_owner": source_config.get("owner"),
            "production_deployments_enabled": source_config.get("production_deployments_enabled"),
            "production_deployment_id": deployment.get("id"),
            "production_created_on": deployment.get("created_on"),
            "production_stage": deployment.get("latest_stage"),
            "analytics_site_tag": build.get("web_analytics_tag"),
            "analytics_configured": bool(build.get("web_analytics_tag") or build.get("web_analytics_token")),
            "binding_names": list((prod.get("env_vars") or {}).keys()),
        })
else:
    report["pages_error"] = projects
sites = collect(f"/accounts/{ACCOUNT}/rum/site_info/list")
report["analytics_sites"] = ([{key: site.get(key) for key in ["site_tag", "created", "auto_install", "ruleset", "rules"]} for site in sites] if isinstance(sites, list) else sites)
zones = collect(f"/zones?account.id={ACCOUNT}")
report["zones"] = ([{"name": zone.get("name"), "status": zone.get("status")} for zone in zones] if isinstance(zones, list) else zones)

# Ask the authenticated schema for field names instead of guessing browser/OS names.
schema = {}
for suffix in ["Dimensions", "Avg"]:
    name = "AccountRumPageloadEventsAdaptiveGroups" + suffix
    result = gql("{__type(name:" + json.dumps(name) + "){fields{name description}}}")
    fields = ((result.get("data") or {}).get("__type") or {}).get("fields") or []
    schema[suffix] = fields
report["pageload_schema"] = schema
known = {field["name"] for field in schema["Dimensions"]}
dimensions = ["requestHost", "date", "refererHost", "requestPath", "countryName", "deviceType"]
dimensions += [field for field in ["userAgentBrowser", "userAgentOS", "bot", "siteTag"] if field in known]
for host in ["sunionpeaks.pages.dev", "dossierkit.pages.dev"]:
    report["analytics"][host] = {}
    for days in [7, 30]:
        start = NOW - dt.timedelta(days=days)
        report["analytics"][host][f"{days}d"] = {
            "from_utc": stamp(start), "to_utc": stamp(NOW),
            "breakdowns": {dimension: groups(start, NOW, dimension, host) for dimension in dimensions},
        }
    report["analytics"][host]["source_landing_7d"] = groups(NOW - dt.timedelta(days=7), NOW, "refererHost requestPath countryName deviceType", host)
report["all_hosts_7d"] = groups(NOW - dt.timedelta(days=7), NOW, "requestHost")
report["all_hosts_30d"] = groups(NOW - dt.timedelta(days=30), NOW, "requestHost")

# Capture available Web Vitals quantiles and their schema-defined units.
vitals_type = gql('{__type(name:"AccountRumWebVitalsEventsAdaptiveGroupsQuantiles"){fields{name description}}}')
vital_fields = (((vitals_type.get("data") or {}).get("__type") or {}).get("fields") or [])
report["web_vitals_schema"] = vital_fields
selected = [field["name"] for field in vital_fields if any(word in field["name"].lower() for word in ["largestcontentfulpaint", "interactiontonextpaint", "cumulativelayoutshift", "timetofirstbyte"]) and "75" in field["name"]]
if selected:
    report["web_vitals_7d"] = groups(NOW-dt.timedelta(days=7), NOW, "deviceType", "sunionpeaks.pages.dev", dataset="rumWebVitalsEventsAdaptiveGroups", fields="count avg{sampleInterval} quantiles{" + " ".join(selected) + "}")

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None
opener = urllib.request.build_opener(NoRedirect())
paths = ["/", "/?utm_source=audit&utm_medium=verification", "/zh/", "/en/", "/robots.txt", "/sitemap-index.xml", "/sitemap-0.xml", "/__audit_missing_page_20260921", "/zh/notes/cloudflare-computer-agent-runtime-durable-objects-virtual-filesystem-exe/"]
urls = ["https://sunionpeaks.pages.dev" + path for path in paths] + ["https://dossierkit.pages.dev" + path for path in ["/", "/?utm_source=legacy_test", "/zh/", "/robots.txt"]]
for url in urls:
    try:
        try:
            response = opener.open(urllib.request.Request(url, headers={"User-Agent": "DossierKit-Deployment-Audit/1.0"}), timeout=30)
        except urllib.error.HTTPError as error:
            response = error
        text = response.read(1500000).decode("utf-8", "replace")
        content_type = response.headers.get("Content-Type", "")
        report["http"].append({"url": url, "status": response.code, "content_type": content_type, "location": response.headers.get("Location"), "meta_refresh": bool(re.search(r'<meta[^>]+http-equiv=[\"\x27]refresh', text, re.I)), "open_dossierkit": "Open DossierKit" in text, "beacon_count": len(re.findall(r'<script[^>]+src=[\"\x27][^\"\x27]*cloudflareinsights.com/beacon', text)), "canonical": re.findall(r'<link[^>]+rel=[\"\x27]canonical[\"\x27][^>]*>', text), "robots_body": text if url.endswith("/robots.txt") and content_type.startswith("text/plain") and len(text) < 2000 else None})
    except Exception as error:
        report["http"].append({"url": url, "error": type(error).__name__})
Path("audit").mkdir(exist_ok=True)
Path("audit/cloudflare-site-audit.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(json.dumps({"generated_at": report["generated_at"], "pages": report["pages"], "pages_error": report.get("pages_error"), "all_hosts_7d": report["all_hosts_7d"], "http": report["http"]}, ensure_ascii=False, indent=2))
with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as summary:
    summary.write("## Read-only Cloudflare audit\n\nFull attribution, sampling rates and HTTP checks are stored in the private audit artifact. No credentials were exported and no Cloudflare resources were changed.\n")
