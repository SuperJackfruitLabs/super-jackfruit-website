import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { restoreVisits } from '../src/scripts/village/visits.mjs';

const projects = JSON.parse(readFileSync(new URL('../src/data/projects.json', import.meta.url), 'utf8'));
const slugs = projects.map((project) => project.slug);

test('an old completed catalogue stays complete after renaming and retirement', () => {
  const old = slugs.map((slug) => slug === 'superpipeline' ? 'kaambaan' : slug);
  old.push('agent-factory');
  assert.deepEqual(restoreVisits(JSON.stringify(old), slugs), new Set(slugs));
});

test('partial progress migrates, deduplicates, and drops unknown entries', () => {
  const saved = ['kaambaan', 'superpipeline', 'agentpod', 'agent-factory', 'unknown', null, 4];
  assert.deepEqual(restoreVisits(JSON.stringify(saved), slugs), new Set(['superpipeline', 'agentpod']));
});

test('missing, malformed, and non-array storage starts empty', () => {
  for (const saved of [null, '{broken', 'null', '{}', '"agentpod"']) {
    assert.deepEqual(restoreVisits(saved, slugs), new Set());
  }
});

test('current progress survives unchanged', () => {
  assert.deepEqual(restoreVisits('["agentpod","superpipeline"]', slugs), new Set(['agentpod', 'superpipeline']));
});
