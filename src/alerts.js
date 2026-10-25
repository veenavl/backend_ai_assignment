// Temperature alerts: notify everyone whose group can see the shipment.

export function groupsForShipment(store, shipment) {
  return store.groups.filter(
    (g) => !g.deleted && (g.all_tags || g.tags.some((tag) => shipment.tags.includes(tag))),
  );
}

export function usersToNotify(store, shipmentId) {
  const shipment = store.shipments.find((s) => s.id === shipmentId);
  if (!shipment) return [];

  const groupIds = new Set(groupsForShipment(store, shipment).map((g) => g.id));
  const users = store.assignments.filter((a) => !a.deleted && groupIds.has(a.group_id)).map((a) => a.user_id);
  return [...new Set(users)].sort();
}
