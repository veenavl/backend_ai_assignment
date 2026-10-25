import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/store.js';
import { usersToNotify } from '../src/alerts.js';

test('EU shipment alert reaches EU Ops and all-tags groups', () => {
  const users = usersToNotify(createStore(), 'shp-2');
  assert.ok(users.includes('cara'));
  assert.ok(users.includes('alice'));
  assert.ok(users.includes('bob'));
});

test('2-8C shipment alert does not reach EU Ops', () => {
  const users = usersToNotify(createStore(), 'shp-1');
  assert.ok(users.includes('alice'));
  assert.ok(!users.includes('cara'));
});

test('unknown shipment notifies nobody', () => {
  assert.deepEqual(usersToNotify(createStore(), 'nope'), []);
});
