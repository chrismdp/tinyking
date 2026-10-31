import * as THREE from "three";
import { occupiedHomes } from "game/home";
import { hour_of_day } from "game/time";
import { skyAt } from "render/sky";
import { animateHome } from "render/models";

export const MAX_FIRE_LIGHTS = 2;

// Follow the same dusk/night curve as the sun. Dawn finishes at sunrise;
// the lingering morning sky tint must not turn lamps on during the day.
export function nightLightStrength(days) {
  const sky = skyAt(days);
  return Math.min(1, sky.night * 2 + (hour_of_day(days) >= 18 ? sky.sunset * .45 : 0));
}

const visible = object => {
  for (let node = object; node; node = node.parent) if (!node.visible) return false;
  return true;
};
const flicker = (seconds, phase) => 1 + .045 * Math.sin(seconds * 6.7 + phase) + .025 * Math.sin(seconds * 11.3 + phase * 2);

// A shared, tiny falloff texture; no canvas, shadow map or postprocessing pass.
function falloffTexture() {
  const size = 32, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const r = Math.hypot((x + .5) / size * 2 - 1, (y + .5) / size * 2 - 1);
    const alpha = Math.max(0, 1 - r * r);
    const i = (y * size + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = 255;
    data[i + 3] = Math.round(alpha * alpha * alpha * 255);
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function createNightLights(ground) {
  const mesh = new THREE.Group(); mesh.name = "night-lights";
  const sources = new Map(), texture = falloffTexture();
  const lights = Array.from({ length: MAX_FIRE_LIGHTS }, () => {
    const light = new THREE.PointLight(0xFFC176, 0, 190, 2);
    light.castShadow = false; light.visible = false; mesh.add(light);
    return light;
  });
  const pool = (centre, rx, rz, angle, name) => {
    // Static draped geometry avoids both a floating disc and per-frame uploads.
    const geometry = new THREE.PlaneGeometry(rx * 2, rz * 2, 12, 12);
    geometry.rotateX(-Math.PI / 2); geometry.rotateY(angle);
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = centre.x + positions.getX(i), z = centre.z + positions.getZ(i);
      positions.setXYZ(i, x, ground.heightAt(x, z) + .8, z);
    }
    geometry.computeBoundingSphere();
    const material = new THREE.MeshBasicMaterial({ map: texture, color: 0xFFB45F, transparent: true,
      opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const glow = new THREE.Mesh(geometry, material); glow.name = name; glow.visible = false;
    glow.raycast = () => {}; mesh.add(glow);
    return glow;
  };
  const remove = id => {
    const source = sources.get(id);
    if (!source) return;
    mesh.remove(source.glow); source.glow.geometry.dispose(); source.glow.material.dispose();
    sources.delete(id);
  };
  return {
    mesh, remove,
    add(id, model) {
      remove(id);
      const fire = model.getObjectByName("campfire"), windows = model.getObjectByName("home-windows"), smoke = model.getObjectByName("smoke");
      if (!fire && !windows && !smoke) return;
      model.updateMatrixWorld(true);
      let centre, angle = 0, kind;
      if (fire) { centre = fire.getWorldPosition(new THREE.Vector3()); kind = "fire"; }
      else if (windows) {
        centre = windows.children.reduce((sum, pane) => sum.add(pane.getWorldPosition(new THREE.Vector3())), new THREE.Vector3()).divideScalar(windows.children.length);
        const direction = new THREE.Vector3(0, 0, 1).transformDirection(windows.matrixWorld);
        centre.addScaledVector(direction, 16); angle = Math.atan2(direction.x, direction.z); kind = "home";
      } else {
        // Existing working ovens/forges share the smoke's real burning state.
        centre = model.localToWorld(smoke.userData.hearth.clone()); kind = "hearth";
      }
      const glow = pool(centre, kind == "home" ? 46 : 72, kind == "home" ? 32 : 72, angle, kind == "home" ? "home-spill" : "fire-spill");
      sources.set(id, { model, fire, windows, smoke, centre, kind, glow, phase: centre.x * .17 + centre.z * .11 });
    },
    update(state, focus, seconds, fade = 1) {
      const strength = nightLightStrength(state.days) * fade, occupied = occupiedHomes(state), candidates = [];
      for (const [id, source] of sources) {
        const { model, windows, fire, smoke, kind, glow, centre, phase } = source;
        const on = strength > 0 && visible(model) && (kind == "home" ? occupied.has(id) : fire ? visible(fire) : smoke.visible);
        const amount = on ? strength * (kind == "home" ? 1 : flicker(seconds, phase) * (fire ? fire.scale.x : 1)) : 0;
        if (windows) animateHome(model, on, strength);
        glow.visible = amount > 0;
        glow.material.opacity = amount * (kind == "home" ? .22 : .32);
        if (amount > 0 && kind != "home") {
          const distance = (centre.x - focus.x) ** 2 + (centre.z - focus.y) ** 2;
          if (distance < 900 ** 2) candidates.push({ source, amount, distance });
        }
      }
      candidates.sort((a, b) => a.distance - b.distance);
      for (const [i, light] of lights.entries()) {
        const candidate = candidates[i];
        light.visible = !!candidate;
        light.intensity = candidate ? 3200 * candidate.amount : 0;
        if (candidate) {
          const p = candidate.source.centre;
          light.position.set(p.x, ground.heightAt(p.x, p.z) + 20, p.z);
        }
      }
    },
    get metrics() { return { pointLights: lights.filter(l => l.visible && l.intensity > 0).length, maxPointLights: MAX_FIRE_LIGHTS, pools: sources.size }; },
    dispose() {
      for (const id of sources.keys()) remove(id);
      for (const light of lights) { mesh.remove(light); light.dispose(); }
      texture.dispose();
    }
  };
}
