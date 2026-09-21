"""Prepare only sunionpeaks' aggregate counter; no token changes or secret exports."""
import json
import os
import secrets
import subprocess
import sys
from pathlib import Path
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
SETTINGS = json.loads((ROOT / 'src/lib/view-counter/settings.json').read_text())
REPORT = {'databaseName': SETTINGS['databaseName'], 'binding': SETTINGS['binding'], 'ready': False}
ACCOUNT = os.environ.get('CLOUDFLARE_ACCOUNT_ID', '')
PAGES_TOKEN = os.environ.get('CLOUDFLARE_API_TOKEN', '')
D1_TOKEN = os.environ.get('CLOUDFLARE_D1_API_TOKEN') or PAGES_TOKEN
BASE = 'https://api.cloudflare.com/client/v4/accounts/' + ACCOUNT

class ApiError(Exception):
    pass

def api(path, method='GET', body=None):
    token = D1_TOKEN if path.startswith('/d1/') else PAGES_TOKEN
    req = urllib.request.Request(BASE + path, method=method,
        data=None if body is None else json.dumps(body).encode(),
        headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            result = json.load(response)
    except urllib.error.HTTPError as error:
        # Error metadata is sufficient; never emit request headers or returned configs.
        raise ApiError(f'{method} {path.split("?")[0]} returned HTTP {error.code}') from None
    if not result.get('success'):
        raise ApiError(f'{method} {path.split("?")[0]} was rejected')
    return result['result']

def provision():
    if not ACCOUNT or not PAGES_TOKEN or not D1_TOKEN:
        raise ApiError('Cloudflare credentials are not configured')
    project_path = '/pages/projects/sunionpeaks'
    project = api(project_path)
    if project.get('name') != 'sunionpeaks':
        raise ApiError('Unexpected Pages project')
    production = project.get('deployment_configs', {}).get('production', {})
    bindings = production.get('d1_databases') or {}
    database = None
    for page in range(1, 51):
        rows = api(f'/d1/database?per_page=100&page={page}')
        database = next((row for row in rows if row.get('name') == SETTINGS['databaseName']), None)
        if database or len(rows) < 100:
            break
    else:
        raise ApiError('D1 list pagination limit reached')
    if database is None:
        # Do not retry an ambiguous create response. The next CI run will list first.
        database = api('/d1/database', 'POST', {'name': SETTINGS['databaseName']})
        REPORT['created'] = True
    database_id = database['uuid']
    existing = bindings.get(SETTINGS['binding'])
    if existing and existing.get('id') != database_id:
        raise ApiError('VIEWS_DB points to another database; not overwritten')
    # Every migration is additive and idempotent; v1 counters never get reset.
    REPORT['migrations'] = []
    for migration in sorted((ROOT / 'migrations/views').glob('*.sql')):
        result = api(f'/d1/database/{database_id}/query', 'POST', {'sql': migration.read_text(), 'params': []})
        if any(item.get('success') is False for item in result):
            raise ApiError('Counter schema initialization failed')
        REPORT['migrations'].append(migration.name)
    # Runtime-only application HMAC secret. Never export or log the value.
    if 'VIEWS_HASH_SECRET' not in (production.get('env_vars') or {}):
        result = subprocess.run(['pnpm', 'exec', 'wrangler', 'pages', 'secret', 'put',
            'VIEWS_HASH_SECRET', '--project-name=sunionpeaks'],
            input=secrets.token_urlsafe(48), text=True, capture_output=True, timeout=60, cwd=ROOT)
        if result.returncode:
            raise ApiError('Could not provision the runtime HMAC binding')
        REPORT['hashSecretCreated'] = True
    check = api(f'/d1/database/{database_id}/query', 'POST', {
        'sql': "SELECT key, views, started_at FROM view_totals WHERE key = 'site:total'", 'params': []})
    if not check or len(check[0].get('results', [])) != 1:
        raise ApiError('Counter initialization could not be verified')
    if not existing:
        api(project_path, 'PATCH', {'deployment_configs': {'production': {'d1_databases': {
            **bindings, SETTINGS['binding']: {'id': database_id}
        }}}})
    after = api(project_path).get('deployment_configs', {}).get('production', {})
    if after.get('d1_databases', {}).get(SETTINGS['binding'], {}).get('id') != database_id:
        raise ApiError('Production binding could not be verified')
    if set((after.get('env_vars') or {}).keys()) != set((production.get('env_vars') or {}).keys()) | {'VIEWS_HASH_SECRET'}:
        raise ApiError('Unexpected environment binding change')
    REPORT.update(ready=True, schemaVersion=2, hashSecretBound=True, databaseId=database_id,
        since=check[0]['results'][0]['started_at'], timeZone=SETTINGS['timeZone'])

try:
    provision()
except Exception as error:
    REPORT['reason'] = str(error) if isinstance(error, ApiError) else type(error).__name__
    REPORT['requiredAction'] = 'Check D1 Write and Pages Edit permissions, preserve VIEWS_HASH_SECRET, then rerun CI. Existing production is not replaced by a failed upgrade.'
    print('::error::Counter upgrade could not be prepared; stopping before production deployment.')
finally:
    directory = ROOT / 'artifacts/views'
    directory.mkdir(parents=True, exist_ok=True)
    (directory / 'infrastructure.json').write_text(json.dumps(REPORT, indent=2) + '\n')
    if os.environ.get('GITHUB_ENV'):
        with open(os.environ['GITHUB_ENV'], 'a') as output:
            output.write('PUBLIC_VIEWS_ENABLED=' + str(REPORT['ready']).lower() + '\n')
    print(json.dumps(REPORT, indent=2))

if not REPORT["ready"]:
    sys.exit(1)
