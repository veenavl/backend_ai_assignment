import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/store.js';
import { moveUsers, ownerCount } from '../src/members.js';
import { activeAssignment } from '../src/permissions.js';

test('bulk move reports a result per user', () => {
  const store = createStore();
  const results = moveUsers(store, { actorId: 'bob', orgId: 'acme', groupId: 'acme:eu-ops', userIds: ['erin', 'max', 'nobody'] });
  assert.deepEqual(results, [
    { userId: 'erin', ok: true },
    { userId: 'max', ok: true },
    { userId: 'nobody', ok: false, error: 'not_found' },
  ]);
  assert.equal(activeAssignment(store, 'erin', 'acme').group_id, 'acme:eu-ops');
});

test('bulk move keeps the last owner', () => {
  const store = createStore();
  const results = moveUsers(store, { actorId: 'gus', orgId: 'globex', groupId: 'globex:admin', userIds: ['gus'] });
  assert.deepEqual(results, [{ userId: 'gus', ok: false, error: 'last_owner' }]);
  assert.equal(ownerCount(store, 'globex'), 1);
});

test('admins cannot bulk move users into owner', () => {
  const store = createStore();
  assert.throws(
    () => moveUsers(store, { actorId: 'bob', orgId: 'acme', groupId: 'acme:owner', userIds: ['cara'] }),
    { code: 'forbidden' },
  );
});
