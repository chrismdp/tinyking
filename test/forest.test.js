// NOTE: Three is ESM; use Node's native require(esm) outside Jest's CJS loader.
jest.mock("three", () => process.getBuiltinModule("module")._load(process.cwd() + "/node_modules/three/build/three.module.js"));

import * as THREE from "three";
import { createForest } from "render/forest";

it("batches equal trees, excludes fogged trees and preserves instance picking after felling", () => {
  const forest = createForest();
  const geometry = new THREE.BoxGeometry(2, 4, 2);
  const material = new THREE.MeshBasicMaterial();
  const trees = Array.from({ length: 100 }, (_, i) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(i * 4, 0, 0);
    mesh.visible = i < 20;
    forest.add(String(i), mesh);
    return mesh;
  });
  forest.update();
  expect(forest.mesh.children.length).toBe(1);
  const batch = forest.mesh.children[0];
  expect(batch.isInstancedMesh).toBe(true);
  expect(batch.count).toBe(20);
  const raycaster = new THREE.Raycaster(new THREE.Vector3(12, 0, 10), new THREE.Vector3(0, 0, -1));
  forest.mesh.updateMatrixWorld(true);
  const hit = raycaster.intersectObject(forest.mesh, true)[0];
  expect(batch.userData.entityIds[hit.instanceId]).toBe("3");
  const dirty = jest.spyOn(batch, "setMatrixAt");
  forest.update();
  expect(dirty).not.toHaveBeenCalled();
  forest.remove("3");
  trees[30].visible = true;
  forest.invalidate();
  forest.update();
  expect(batch.count).toBe(20);
  expect(batch.userData.entityIds).not.toContain("3");
  expect(batch.userData.entityIds).toContain("30");
  const disposed = jest.fn();
  batch.addEventListener("dispose", disposed);
  forest.dispose();
  expect(disposed).toHaveBeenCalledTimes(1);
  expect(forest.mesh.children.length).toBe(0);
});
