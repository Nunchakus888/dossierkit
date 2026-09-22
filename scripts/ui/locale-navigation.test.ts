import assert from 'node:assert/strict';
import { test } from 'node:test';
import { matchTranslation, localeTarget } from '../../src/lib/locale-navigation';
import { loadProfilePack } from '../../src/lib/profile-loader';

test('translation keys connect different slugs, never arbitrary or draft targets',()=>{
  const source={slug:'original',data:{translationKey:'one'}};
  const target={slug:'translated',data:{translationKey:'one'}};
  assert.equal(matchTranslation(source,[target]),target);
  assert.equal(matchTranslation(source,[{slug:'other',data:{translationKey:'two'}}]),undefined);
  assert.equal(matchTranslation(source,[{...target,data:{translationKey:'one',translationStatus:'draft'}}]),undefined);
  assert.equal(matchTranslation(source,[target,{slug:'ambiguous',data:{translationKey:'one'}}]),undefined);
  const same={slug:'original',data:{}};
  assert.equal(matchTranslation(source,[same]),same);
  assert.equal(matchTranslation(undefined,[same]),undefined);
});
test('known static pages switch directly while absent notes use a real index',()=>{
  const pack=loadProfilePack();
  assert.deepEqual(localeTarget('/zh/cv/','zh',pack).href,'/en/cv/');
  assert.ok(localeTarget('/zh/cv/','zh',pack).available);
  assert.equal(localeTarget('/en/','en',pack).href,'/zh/');
  const missing=localeTarget('/zh/notes/github-copilot-agent-runtime-rust-ffi-harness-ai/','zh',pack);
  assert.equal(missing.available,false);assert.equal(missing.href,'/en/notes/');
  assert.equal(localeTarget('/en/notes/config-enhancer-semantic-guardrails/','en',pack).href,'/zh/notes/');
  assert.equal(localeTarget('/plugins/dossierkit-notes/','zh',pack).href,'/en/');
  assert.equal(localeTarget('/zh/work/enterprise-agent-platform/','zh',pack).href,'/en/work/enterprise-agent-platform/');
  assert.ok(localeTarget('/zh/for/agent-platform/','zh',pack).available);
});
