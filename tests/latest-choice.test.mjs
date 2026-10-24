import assert from 'node:assert/strict';
import test from 'node:test';
import { createLatestChoice } from '../src/scripts/village/latest-choice.mjs';

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test('only the most recently begun choice is current', () => {
  const choices = createLatestChoice();
  const first = choices.begin();
  const second = choices.begin();
  assert.equal(choices.isLatest(first), false);
  assert.equal(choices.isLatest(second), true);
});

test('latest model choice wins in either load completion order', async () => {
  for (const order of ['newest-first', 'oldest-first']) {
    const choices = createLatestChoice();
    const firstLoad = deferred();
    const secondLoad = deferred();
    const applied = [];
    async function choose(name, load) {
      const ticket = choices.begin();
      await load;
      if (choices.isLatest(ticket)) applied.push(name);
    }
    const first = choose('sedan', firstLoad.promise);
    const second = choose('offroad', secondLoad.promise);
    if (order === 'newest-first') {
      secondLoad.resolve();
      firstLoad.resolve();
    } else {
      firstLoad.resolve();
      secondLoad.resolve();
    }
    await Promise.all([first, second]);
    assert.deepEqual(applied, ['offroad'], order);
  }
});

test('same-model repaint invalidates an older in-flight model choice', async () => {
  const choices = createLatestChoice();
  const sedanLoad = deferred();
  const applied = [];
  async function chooseSedan() {
    const ticket = choices.begin();
    await sedanLoad.promise;
    if (choices.isLatest(ticket)) applied.push('sedan');
  }
  const pending = chooseSedan();
  const repaint = choices.begin();
  if (choices.isLatest(repaint)) applied.push('offroad repaint');
  sedanLoad.resolve();
  await pending;
  assert.deepEqual(applied, ['offroad repaint']);
});
