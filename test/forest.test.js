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

it("uses at most eight triangles per distant tree and restores close-up geometry", () => {
  const forest = createForest();
  const geometry = new THREE.IcosahedronGeometry(12, 1);
  geometry.translate(0, 20, 0);
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(
    Array.from({ length: geometry.attributes.position.count * 3 }, () => 0.4), 3));
  const tree = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true }));
  tree.position.set(70, 3, 20);
  forest.add("tree", tree);
  forest.update();
  const batch = forest.mesh.children[0];
  expect(batch.geometry).toBe(geometry);
  forest.setDistant(true);
  forest.update();
  expect(batch.geometry.attributes.position.count / 3).toBeLessThanOrEqual(8);
  expect(batch.userData.entityIds).toEqual(["tree"]);
  const matrix = new THREE.Matrix4();
  batch.getMatrixAt(0, matrix);
  expect(new THREE.Vector3().setFromMatrixPosition(matrix)).toEqual(tree.position);
  forest.setDistant(false);
  forest.update();
  expect(batch.geometry).toBe(geometry);
  forest.dispose();
});
