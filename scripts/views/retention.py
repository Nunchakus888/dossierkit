"""Prune only expired counter receipts and pseudonymous sightings; preserve PV."""
import datetime as dt
import json
import os
import urllib.request
from zoneinfo import ZoneInfo
account = os.environ['CLOUDFLARE_ACCOUNT_ID']
token = os.environ.get('CLOUDFLARE_D1_API_TOKEN') or os.environ['CLOUDFLARE_API_TOKEN']
base = f'https://api.cloudflare.com/client/v4/accounts/{account}/d1'
def api(path, body=None):
    req = urllib.request.Request(base+path, data=None if body is None else json.dumps(body).encode(),
        headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'})
    with urllib.request.urlopen(req, timeout=40) as response:
        data = json.load(response)
    if not data.get('success'):
        raise RuntimeError('D1 retention request rejected')
    return data['result']
database = None
for page in range(1,51):
    rows = api(f'/database?per_page=100&page={page}')
    database = next((r for r in rows if r.get('name') == 'sunionpeaks-views'), None)
    if database or len(rows) < 100:
        break
if database is None:
    raise RuntimeError('Counter database not found; no resources changed')
now = dt.datetime.now(dt.timezone.utc)
cutoff = (now.astimezone(ZoneInfo('Asia/Shanghai')).date() - dt.timedelta(days=89)).isoformat()
for sql, params in [
    ('DELETE FROM view_events WHERE expires_at <= ?', [int(now.timestamp()*1000)]),
    ('DELETE FROM view_visitors WHERE day < ?', [cutoff])
]:
    result = api(f'/database/{database["uuid"]}/query', {'sql':sql,'params':params})
    if any(r.get('success') is False for r in result):
        raise RuntimeError('Retention query failed')
print(json.dumps({'status':'ok','checkedAt':now.isoformat(),'uvWindowStart':cutoff,
    'preserved':['view_totals','view_daily','view_sources_daily'],'privateRowsExported':0}))
