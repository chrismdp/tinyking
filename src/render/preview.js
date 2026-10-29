import * as THREE from "three";

import { Grid, Hex } from "game/map";
import { fullEntity } from "game/entities";

import * as models from "render/models";
import { COLOURS, PLAYER_REALM, SELECTED } from "render/colours";
import { label } from "render/labels";

const ground = models.FLAT_GROUND;

// NOTE: The little 3D scene in the "Start new game" window: the player's
// villager on their home hex, ringed by six neighbouring towns. Clicking the
// villager or a town calls back so the window can switch tab. It only
// redraws when told to.
export function createPreview(container, { width, height, onPickPerson, onPickNeighbour }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xDDE8FF, 0x4A4030, 1.5));
  const sun = new THREE.DirectionalLight(0xFFFFFF, 2.6);
  sun.position.set(-0.45, 1, 0.6);
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(35, width / height, 5, 3000);
  camera.position.set(0, 470, 400);
  camera.lookAt(0, 0, 25);

  const hexes = Grid.spiral({ center: { x: 0, y: 0 }, radius: 1 }).map(hex => Hex(hex).toPoint());
  const tiles = hexes.map((point, index) => {
    const tile = models.hexTile(ground, point, COLOURS.grassland);
    tile.userData.neighbour = index;
    scene.add(tile);
    return tile;
  });

  let dynamic = new THREE.Group();
  scene.add(dynamic);

  const pick = e => {
    const rect = renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      (e.clientX - rect.left) / rect.width * 2 - 1,
      -(e.clientY - rect.top) / rect.height * 2 + 1);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, camera);
    for (const hit of raycaster.intersectObjects([...tiles, dynamic], true)) {
      for (let o = hit.object; o; o = o.parent) {
        if (o.userData.person) {
          onPickPerson();
          return;
        }
        if (o.userData.neighbour != null) {
          if (o.userData.neighbour > 0) {
            onPickNeighbour(o.userData.neighbour - 1);
          }
          return;
        }
      }
    }
  };

  let down = null;
  const onDown = e => { down = { x: e.clientX, y: e.clientY }; };
  const onUp = e => {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) {
      pick(e);
    }
    down = null;
  };
  renderer.domElement.addEventListener("pointerdown", onDown);
  renderer.domElement.addEventListener("pointerup", onUp);

  return {
    update(state, { playerId, personSelected, selectedNeighbour }, t) {
      scene.remove(dynamic);
      models.disposeObject(dynamic);
      dynamic = new THREE.Group();

      hexes.forEach((point, index) => {
        if (index > 0) {
          const town = models.house(ground, point.x, point.y, (index + 3) % 6, {
            playerOwned: false,
            selected: selectedNeighbour + 1 == index
          });
          town.userData.neighbour = index;
          const name = label("Town", { background: "rgba(93, 112, 132, 0.85)" });
          name.position.set(0, 70, 0);
          town.add(name);
          dynamic.add(town);
          if (selectedNeighbour + 1 == index) {
            dynamic.add(models.hexOutline(ground, point, SELECTED));
          }
        }
      });

      const entity = playerId && fullEntity(state.ecs, playerId);
      if (entity && entity.spatial && entity.personable) {
        const figure = models.person(state, entity, t, { realm: PLAYER_REALM, selected: personSelected });
        figure.userData.person = true;
        figure.scale.setScalar(1.6);
        dynamic.add(figure);
      }

      scene.add(dynamic);
      renderer.render(scene, camera);
    },
    dispose() {
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      models.disposeObject(scene);
      renderer.dispose();
      renderer.forceContextLoss();
      container.removeChild(renderer.domElement);
    }
  };
}
