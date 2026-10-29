import * as THREE from "three";

const PAN_KEYS = {
  KeyW: [0, 1], ArrowUp: [0, 1],
  KeyS: [0, -1], ArrowDown: [0, -1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};
const ROTATE_KEYS = { KeyQ: 1, KeyE: -1 };

const CLICK_SLOP = 6;
const MIN_DISTANCE = 120;
const MAX_DISTANCE = 3200;
const MIN_PITCH = 0.3;
const MAX_PITCH = 1.45;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const typingInto = target => target && (
  target.tagName == "INPUT" || target.tagName == "TEXTAREA" || target.isContentEditable);

// NOTE: An orbiting camera over the map. Drag (or WASD / arrows) pans, the
// wheel or a pinch zooms towards the pointer, right-drag or Q/E rotates and
// right-drag up and down tilts. A press that does not move is a click.
export function createCameraRig(camera, dom, { bounds, groundHeight, onClick }) {
  const rig = { x: bounds.width / 2, z: bounds.height / 2, y: 0, yaw: 0, pitch: 0.95, distance: 900 };
  const keys = new Set();
  const pointers = new Map();
  let press = null;
  let pinch = null;

  const raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  const right = () => new THREE.Vector3(Math.cos(rig.yaw), 0, -Math.sin(rig.yaw));
  const forward = () => new THREE.Vector3(-Math.sin(rig.yaw), 0, -Math.cos(rig.yaw));

  const keepInBounds = () => {
    rig.x = clamp(rig.x, 0, bounds.width);
    rig.z = clamp(rig.z, 0, bounds.height);
    rig.distance = clamp(rig.distance, MIN_DISTANCE, MAX_DISTANCE);
    rig.pitch = clamp(rig.pitch, MIN_PITCH, MAX_PITCH);
  };

  const worldPerPixel = () =>
    2 * rig.distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.max(1, dom.clientHeight);

  const pan = (dx, dy) => {
    const scale = worldPerPixel();
    const r = right();
    const f = forward();
    rig.x += (-r.x * dx + f.x * dy / Math.sin(rig.pitch)) * scale;
    rig.z += (-r.z * dx + f.z * dy / Math.sin(rig.pitch)) * scale;
    keepInBounds();
  };

  const groundUnder = (clientX, clientY) => {
    const rect = dom.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      (clientX - rect.left) / rect.width * 2 - 1,
      -(clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    plane.constant = -rig.y;
    return raycaster.ray.intersectPlane(plane, new THREE.Vector3());
  };

  const zoomTowards = (factor, clientX, clientY) => {
    const next = clamp(rig.distance * factor, MIN_DISTANCE, MAX_DISTANCE);
    const point = clientX == null ? null : groundUnder(clientX, clientY);
    if (point) {
      const k = 1 - next / rig.distance;
      rig.x += (point.x - rig.x) * k;
      rig.z += (point.z - rig.z) * k;
    }
    rig.distance = next;
    keepInBounds();
  };

  const place = () => {
    const c = Math.cos(rig.pitch);
    camera.position.set(
      rig.x + Math.sin(rig.yaw) * c * rig.distance,
      rig.y + Math.sin(rig.pitch) * rig.distance,
      rig.z + Math.cos(rig.yaw) * c * rig.distance);
    camera.lookAt(rig.x, rig.y, rig.z);
    camera.updateMatrixWorld();
  };

  const onPointerDown = e => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dom.setPointerCapture(e.pointerId);
    if (pointers.size == 2) {
      const [a, b] = [...pointers.values()];
      pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y) };
      press = null;
    } else if (pointers.size == 1) {
      press = { id: e.pointerId, button: e.button, x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, moved: false };
    }
  };

  const onPointerMove = e => {
    if (!pointers.has(e.pointerId)) {
      return;
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size == 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d > 0 && pinch.distance > 0) {
        zoomTowards(pinch.distance / d, (a.x + b.x) / 2, (a.y + b.y) / 2);
      }
      pinch.distance = d;
      return;
    }
    if (!press || press.id != e.pointerId) {
      return;
    }
    if (!press.moved && Math.hypot(e.clientX - press.x, e.clientY - press.y) > CLICK_SLOP) {
      press.moved = true;
    }
    if (press.moved) {
      const dx = e.clientX - press.lastX;
      const dy = e.clientY - press.lastY;
      if (press.button == 2) {
        rig.yaw -= dx * 0.006;
        rig.pitch += dy * 0.005;
        keepInBounds();
      } else {
        pan(dx, dy);
      }
    }
    press.lastX = e.clientX;
    press.lastY = e.clientY;
  };

  const onPointerUp = e => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) {
      pinch = null;
    }
    if (press && press.id == e.pointerId) {
      if (!press.moved && press.button == 0) {
        onClick(e);
      }
      press = null;
    }
  };

  const onWheel = e => {
    e.preventDefault();
    zoomTowards(Math.exp(e.deltaY * 0.0012), e.clientX, e.clientY);
  };

  const onKeyDown = e => {
    if (!typingInto(e.target) && (PAN_KEYS[e.code] || ROTATE_KEYS[e.code])) {
      keys.add(e.code);
    }
  };
  const onKeyUp = e => keys.delete(e.code);
  const onBlur = () => keys.clear();
  const noMenu = e => e.preventDefault();

  dom.addEventListener("pointerdown", onPointerDown);
  dom.addEventListener("pointermove", onPointerMove);
  dom.addEventListener("pointerup", onPointerUp);
  dom.addEventListener("pointercancel", onPointerUp);
  dom.addEventListener("wheel", onWheel, { passive: false });
  dom.addEventListener("contextmenu", noMenu);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);

  return {
    lookAt(x, z, distance) {
      rig.x = x;
      rig.z = z;
      if (distance) {
        rig.distance = distance;
      }
      keepInBounds();
      rig.y = groundHeight(rig.x, rig.z);
      place();
    },
    tilt(pitch) {
      rig.pitch = pitch;
      keepInBounds();
    },
    zoomBy(factor) {
      zoomTowards(factor);
    },
    update(dt) {
      let px = 0;
      let pz = 0;
      let turn = 0;
      for (const code of keys) {
        if (PAN_KEYS[code]) {
          px += PAN_KEYS[code][0];
          pz += PAN_KEYS[code][1];
        }
        turn += ROTATE_KEYS[code] || 0;
      }
      if (px || pz) {
        const speed = rig.distance * 0.9 * dt;
        const r = right();
        const f = forward();
        rig.x += (r.x * px + f.x * pz) * speed;
        rig.z += (r.z * px + f.z * pz) * speed;
      }
      rig.yaw += turn * 1.6 * dt;
      keepInBounds();

      // NOTE: ease the orbit height towards the ground so hills do not jolt
      const target = groundHeight(rig.x, rig.z);
      rig.y += (target - rig.y) * Math.min(1, dt * 4);
      place();
    },
    dispose() {
      dom.removeEventListener("pointerdown", onPointerDown);
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerup", onPointerUp);
      dom.removeEventListener("pointercancel", onPointerUp);
      dom.removeEventListener("wheel", onWheel);
      dom.removeEventListener("contextmenu", noMenu);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    }
  };
}
