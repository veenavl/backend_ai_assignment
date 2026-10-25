// Moving users between groups. See docs/DOMAIN.md.
import { withTransaction, forbidden, notFound, conflict } from './store.js';
import { resolvePermissions, can, membership, activeAssignment, getGroup } from './permissions.js';

export function ownerCount(store, orgId) {
  const owner = store.groups.find((g) => g.org_id === orgId && g.system_key === 'owner' && !g.deleted);
  return store.assignments.filter((a) => a.org_id === orgId && !a.deleted && a.group_id === owner?.id).length;
}

// Moves userId into groupId (or adds them if they have no group yet).
export function changeGroup(store, { actorId, orgId, groupId, userId }) {
  const actor = resolvePermissions(store, actorId, orgId);
  if (!can(actor, 'groups.manage')) throw forbidden('You cannot change groups in this org.');

  const target = getGroup(store, orgId, groupId);
  if (!target) throw notFound('Group not found.');
  if (!membership(store, userId, orgId)) throw notFound('User is not a member of this org.');

  if (target.system_key === 'owner' && actor.systemKey !== 'owner') {
    throw forbidden('Only owners can make someone an owner.');
  }

  return withTransaction(store, () => {
    const current = activeAssignment(store, userId, orgId);
    if (current?.group_id === groupId) return current;

    if (current) {
      const currentGroup = getGroup(store, orgId, current.group_id);
      if (currentGroup?.system_key === 'owner' && ownerCount(store, orgId) <= 1) {
        throw conflict('last_owner', 'An org must keep at least one owner.');
      }
      current.deleted = true;
    }

    const assignment = { org_id: orgId, user_id: userId, group_id: groupId, deleted: false, created_by: actorId };
    store.assignments.push(assignment);
    store.audit_log.push({
      org_id: orgId,
      actor_id: actorId,
      user_id: userId,
      from: current?.group_id ?? null,
      to: groupId,
    });
    return assignment;
  });
}

// Moves several users into groupId in one request ("Move selected" in the UI).
// Returns a result per user so the UI can show partial failures.
export function moveUsers(store, { actorId, orgId, groupId, userIds }) {
  const actor = resolvePermissions(store, actorId, orgId);
  if (!can(actor, 'groups.manage')) throw forbidden('You cannot change groups in this org.');

  const target = getGroup(store, orgId, groupId);
  if (!target) throw notFound('Group not found.');
  if (target.system_key === 'owner' && actor.systemKey !== 'owner') {
    throw forbidden('Only owners can make someone an owner.');
  }

  const owners = ownerCount(store, orgId);
  const results = [];

  for (const userId of new Set(userIds)) {
    if (!membership(store, userId, orgId)) {
      results.push({ userId, ok: false, error: 'not_found' });
      continue;
    }
    const current = activeAssignment(store, userId, orgId);
    if (current?.group_id === groupId) {
      results.push({ userId, ok: true });
      continue;
    }
    if (current) {
      const currentGroup = getGroup(store, orgId, current.group_id);
      if (currentGroup?.system_key === 'owner' && owners <= 1) {
        results.push({ userId, ok: false, error: 'last_owner' });
        continue;
      }
      current.deleted = true;
    }
    store.assignments.push({ org_id: orgId, user_id: userId, group_id: groupId, deleted: false, created_by: actorId });
    results.push({ userId, ok: true });
  }

  store.audit_log.push({ org_id: orgId, actor_id: actorId, action: 'bulk_move', to: groupId, results });
  return results;
}
