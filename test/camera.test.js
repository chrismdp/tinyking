jest.mock("three", () => process.getBuiltinModule("module")._load(process.cwd() + "/node_modules/three/build/three.module.js"));
import * as THREE from "three";
import { createCameraRig } from "render/camera";

it("pans with one touch, pinches to zoom, twists to rotate, taps to select and ignores cancelled touches", () => {
  global.window = new EventTarget();
  const dom = new EventTarget();
  Object.assign(dom, { clientWidth: 390, clientHeight: 844, setPointerCapture() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 844 }) });
  const camera = new THREE.PerspectiveCamera(40, 390 / 844, 5, 12000);
  const onClick = jest.fn();
  const rig = createCameraRig(camera, dom, { bounds: { centre: { x: 0, y: 0 }, apothem: 5000 }, groundHeight: () => 0, onClick });
  const pointer = (type, id, x, y) => {
    const e = new Event(type);
    Object.assign(e, { pointerId: id, pointerType: "touch", button: 0, clientX: x, clientY: y });
    dom.dispatchEvent(e);
    rig.update(0);
  };
  rig.update(0);
  const before = camera.position.clone();
  pointer("pointerdown", 1, 100, 300);
  pointer("pointermove", 1, 140, 320);
  expect(camera.position.distanceTo(before)).toBeGreaterThan(1);
  pointer("pointerup", 1, 140, 320);
  expect(onClick).not.toHaveBeenCalled();
  pointer("pointerdown", 1, 100, 300);
  pointer("pointerdown", 2, 200, 300);
  const distance = rig.distance;
  pointer("pointermove", 2, 250, 300);
  expect(rig.distance).toBeLessThan(distance);
  const quaternion = camera.quaternion.clone();
  pointer("pointermove", 2, 100, 450);
  expect(camera.quaternion.angleTo(quaternion)).toBeGreaterThan(0.5);
  pointer("pointerup", 2, 100, 450);
  pointer("pointerup", 1, 100, 300);
  expect(onClick).not.toHaveBeenCalled();
  pointer("pointerdown", 1, 100, 300);
  pointer("pointercancel", 1, 100, 300);
  expect(onClick).not.toHaveBeenCalled();
  pointer("pointerdown", 1, 100, 300);
  pointer("pointerup", 1, 100, 300);
  expect(onClick).toHaveBeenCalledTimes(1);
  rig.dispose();
  delete global.window;
});
