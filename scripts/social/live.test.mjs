import test from 'node:test';
import assert from 'node:assert/strict';
import { countCloudflareBeacons } from '../verify-live-publication.mjs';

test('analytics inspection counts actual beacon script origins, not text or lookalike domains', () => {
  const beacon = '<script defer src="https://static.cloudflareinsights.com/beacon.min.js/v123"></script>';
  assert.equal(countCloudflareBeacons(beacon), 1);
  assert.equal(countCloudflareBeacons(beacon + beacon), 2);
  assert.equal(countCloudflareBeacons('<p>cloudflareinsights.com/beacon</p>'), 0);
  assert.equal(countCloudflareBeacons('<script src="https://static.cloudflareinsights.com.evil.example/beacon.min.js"></script>'), 0);
  assert.equal(countCloudflareBeacons('<script src="/local-script.js"></script>'), 0);
});
