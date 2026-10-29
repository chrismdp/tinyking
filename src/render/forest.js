import * as THREE from "three";

// NOTE: At whole-map distances a canopy is only a few pixels wide. Keep
// its bounds and leaf colour, with eight faces instead of every branch.
function distantCanopy(geometry) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const canopy = new THREE.OctahedronGeometry(1, 0);
  canopy.scale(size.x / 2, size.y * 0.35, size.z / 2);
  canopy.translate(centre.x, box.min.y + size.y * 0.65, centre.z);
  const positions = geometry.attributes.position;
  const colours = geometry.attributes.color;
  const leaves = new THREE.Color(0, 0, 0);
  let count = 0;
  for (let i = 0; i < positions.count; i++) {
    if (positions.getY(i) >= centre.y) {
      leaves.r += colours.getX(i);
      leaves.g += colours.getY(i);
      leaves.b += colours.getZ(i);
      count++;
    }
  }
  leaves.multiplyScalar(1 / count);
  const values = [];
  for (let i = 0; i < canopy.attributes.position.count; i++) {
    values.push(leaves.r, leaves.g, leaves.b);
  }
  canopy.setAttribute("color", new THREE.Float32BufferAttribute(values, 3));
  return canopy;
}

// NOTE: Trees share geometry by shape, size and colour. Keep entity objects
// for UI anchors, but draw visible trees in one instanced mesh per geometry.
// Only a redraw or a discovery change uploads matrices, never an idle frame.
export function createForest() {
  const mesh = new THREE.Group();
  const groups = new Map();
  const groupOf = new Map();
  let dirty = false;
  let distant = false;

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
    setDistant(value) {
      if (distant != value) {
        distant = value;
        dirty = true;
      }
    },
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
        if (distant && !group.canopy) {
          group.canopy = distantCanopy(group.geometry);
        }
        batch.geometry = distant ? group.canopy : group.geometry;
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
        if (group.canopy) {
          group.canopy.dispose();
        }
      }
      groups.clear();
      groupOf.clear();
    }
  };
}
