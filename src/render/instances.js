import * as THREE from "three";

// One draw call per shared geometry/material, including parts of compound props.
// Static groups upload only when rebuilt/discovered; animals dirty their own group.
export function createInstances() {
  const mesh = new THREE.Group();
  const groups = new Map();
  const memberships = new Map();
  const remove = id => {
    for (const group of memberships.get(id) || []) {
      group.entries = group.entries.filter(entry => entry.id != id);
      group.dirty = true;
      if (!group.entries.length) {
        if (group.batch) { mesh.remove(group.batch); group.batch.dispose(); }
        groups.delete(group.key);
      }
    }
    memberships.delete(id);
  };
  const invalidate = id => {
    for (const group of id ? memberships.get(id) || [] : groups.values()) group.dirty = true;
  };
  return {
    mesh, remove, invalidate,
    has: id => memberships.has(id),
    add(id, object) {
      remove(id);
      const members = new Set();
      object.traverse(child => {
        if (!child.isMesh) return;
        const key = child.geometry.uuid + ":" + child.material.uuid;
        if (!groups.has(key)) groups.set(key, { key, geometry: child.geometry, material: child.material, entries: [], dirty: true });
        const group = groups.get(key);
        group.entries.push({ id, root: object, child });
        group.dirty = true;
        members.add(group);
      });
      memberships.set(id, members);
    },
    update() {
      for (const group of groups.values()) {
        if (!group.dirty) continue;
        if (!group.batch || group.batch.instanceMatrix.count < group.entries.length) {
          if (group.batch) { mesh.remove(group.batch); group.batch.dispose(); }
          group.batch = new THREE.InstancedMesh(group.geometry, group.material, group.entries.length);
          group.batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
          mesh.add(group.batch);
        }
        const ids = [];
        const roots = new Set();
        for (const { id, root, child } of group.entries) {
          let visible = root.visible;
          for (let node = child; node && node != root; node = node.parent) visible = visible && node.visible;
          if (!visible) continue;
          if (!roots.has(root)) { root.updateMatrixWorld(true); roots.add(root); }
          group.batch.setMatrixAt(ids.length, child.matrixWorld);
          ids.push(id);
        }
        group.batch.count = ids.length;
        group.batch.visible = ids.length > 0;
        group.batch.userData.entityIds = ids;
        group.batch.instanceMatrix.needsUpdate = true;
        group.batch.computeBoundingSphere();
        group.dirty = false;
      }
    },
    dispose() {
      for (const group of groups.values()) if (group.batch) { mesh.remove(group.batch); group.batch.dispose(); }
      groups.clear(); memberships.clear();
    }
  };
}
