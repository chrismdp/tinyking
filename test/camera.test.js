jest.mock("three", () => process.getBuiltinModule("module")._load(process.cwd() + "/node_modules/three/build/three.module.js"));
import * as THREE from "three";
import { createCameraRig } from "render/camera";

it("pans with one touch, pinches to zoom, twists to rotate, taps to select and ignores cancelled touches", () => {
  jest.useFakeTimers();
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
  // The browser still dispatches a compatibility click after pointerup. Open
  // the menu afterwards so that click cannot activate a button under the tap.
  expect(onClick).not.toHaveBeenCalled();
  jest.runOnlyPendingTimers();
  expect(onClick).toHaveBeenCalledTimes(1);
  rig.dispose();
  delete global.window;
  jest.useRealTimers();
});

it("frames an off-map arrival without clamping it, and blocks camera controls until handover", () => {
  global.window = new EventTarget();
  const dom = new EventTarget();
  Object.assign(dom, { clientWidth: 390, clientHeight: 664, setPointerCapture() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 664 }) });
  const camera = new THREE.PerspectiveCamera(40, 390 / 664, 5, 12000);
  let enabled = false;
  const onClick = jest.fn();
  const rig = createCameraRig(camera, dom, { bounds: { centre: { x: 0, y: 0 }, apothem: 100 }, groundHeight: () => 0, onClick, enabled: () => enabled });
  rig.shot({ x: 220, z: 0, y: 12, distance: 400, yaw: 0.8, pitch: 0.8 });
  const before = camera.position.clone();
  const point = new THREE.Vector3(220, 12, 0).project(camera);
  expect(Math.abs(point.x)).toBeLessThan(0.01);
  expect(Math.abs(point.y)).toBeLessThan(0.01);
  const pointer = type => { const e = new Event(type); Object.assign(e, { pointerId: 1, pointerType: "mouse", button: 0, clientX: 100, clientY: 100 }); dom.dispatchEvent(e); };
  pointer("pointerdown"); pointer("pointerup");
  expect(onClick).not.toHaveBeenCalled();
  expect(camera.position.distanceTo(before)).toBe(0);
  enabled = true;
  pointer("pointerdown"); pointer("pointerup");
  expect(onClick).toHaveBeenCalledTimes(1);
  rig.dispose();
  delete global.window;
});

it.each([[1440, 900], [390, 664], [664, 390]])("keeps the traveller and camp in the arrival frame at %i×%i", (width, height) => {
  const { arrivalShot } = require("render/camera");
  const camp = { x: 50, y: 30 };
  const intro = { points: [{ x: -250, y: -100 }], elapsed: 0, active: true };
  const camera = new THREE.PerspectiveCamera(40, width / height, 5, 12000);
  for (const [elapsed, spatial] of [[0, intro.points[0]], [3.3, { x: -100, y: 0 }], [10.4, { x: 25, y: 54 }]]) {
    intro.elapsed = elapsed;
    const shot = arrivalShot(intro, spatial, camp, camera.aspect, () => 0);
    camera.position.set(shot.x + Math.sin(shot.yaw) * Math.cos(shot.pitch) * shot.distance, shot.y + Math.sin(shot.pitch) * shot.distance, shot.z + Math.cos(shot.yaw) * Math.cos(shot.pitch) * shot.distance);
    camera.lookAt(shot.x, shot.y, shot.z);
    camera.updateMatrixWorld();
    const p = new THREE.Vector3(spatial.x, 20, spatial.y).project(camera);
    expect(Math.abs(p.x)).toBeLessThan(0.8);
    expect(Math.abs(p.y)).toBeLessThan(0.8);
    if (elapsed > 9) {
      const fire = new THREE.Vector3(camp.x - 25, 10, camp.y - 10).project(camera);
      expect(Math.abs(fire.x)).toBeLessThan(0.8);
      expect(Math.abs(fire.y)).toBeLessThan(0.8);
    }
  }
});
