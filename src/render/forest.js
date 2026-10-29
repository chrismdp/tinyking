import * as THREE from "three";

// NOTE: Trees share geometry by shape, size and colour. Keep entity objects
// for UI anchors, but draw visible trees in one instanced mesh per geometry.
// Only a redraw or a discovery change uploads matrices, never an idle frame.
export function createForest() {
  const mesh = new THREE.Group();
  const groups = new Map();
  const groupOf = new Map();
  let dirty = false;

  const remove = id => {
    const group = groupOf.get(id);
    if (group) {
      group.objects.delete(id);
      groupOf.delete(id);
      dirty = true;
    }
  };

  return {
    mesh,
    add(id, object) {
      remove(id);
      if (!groups.has(object.geometry)) {
        groups.set(object.geometry, { objects: new Map(), geometry: object.geometry, material: object.material });
      }
      const group = groups.get(object.geometry);
      group.objects.set(id, object);
      groupOf.set(id, group);
      dirty = true;
    },
    remove,
    invalidate() { dirty = true; },
    update() {
      if (!dirty) {
        return;
      }
      for (const group of groups.values()) {
        if (!group.batch || group.batch.instanceMatrix.count < group.objects.size) {
          if (group.batch) {
            mesh.remove(group.batch);
            group.batch.dispose();
          }
          group.batch = new THREE.InstancedMesh(group.geometry, group.material, group.objects.size);
          group.batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
          mesh.add(group.batch);
        }
        const batch = group.batch;
        const ids = [];
        for (const [id, object] of group.objects) {
          if (object.visible) {
            object.updateMatrix();
            batch.setMatrixAt(ids.length, object.matrix);
            ids.push(id);
          }
        }
        batch.count = ids.length;
        batch.visible = ids.length > 0;
        batch.userData.entityIds = ids;
        batch.instanceMatrix.needsUpdate = true;
        batch.computeBoundingSphere();
      }
      dirty = false;
    },
    has: id => groupOf.has(id),
    dispose() {
      for (const group of groups.values()) {
        if (group.batch) {
          mesh.remove(group.batch);
          group.batch.dispose();
        }
      }
      groups.clear();
      groupOf.clear();
    }
  };
}
