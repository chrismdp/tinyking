// NOTE: Three is ESM; use Node's native require(esm) outside Jest's CJS loader.
jest.mock("three", () => process.getBuiltinModule("module")._load(process.cwd() + "/node_modules/three/build/three.module.js"));

jest.mock("render/labels", () => ({ label: (text, options = {}) => {
  const THREE = require("three"), sprite = new THREE.Sprite(new THREE.SpriteMaterial());
  const height = options.height || 15;
  sprite.scale.set(text.length * height * .6, height, 1);
  return sprite;
} }));

import * as THREE from "three";
import { Hex, Grid } from "game/hex";
import { createWorldView } from "render/world_view";

const fixture = () => {
  const centre = Hex(22, 22);
  const grid = Grid.hexagon({ center: centre, radius: 22 });
  const state = {
    ecs: { spatial: {}, mappable: {}, playable: { player: { known: [] } }, personable: {}, interior: {}, good: {}, building: {} },
    map: { seed: 13, radius: 22, centre, playerStartTile: centre },
    world: { home: { x: 0, y: 0 }, hexes: [{ x: 0, y: 0, biome: "grassland", temperature: "temperate", moisture: "normal", morality: "neutral" }] },
    ui: { playerId: "player" }, redraws: [], space: {}, days: 0.375
  };
  grid.forEach((h, i) => {
    const id = String(i + 1);
    state.ecs.spatial[id] = h.toPoint();
    state.ecs.mappable[id] = { terrain: "grassland" };
    state.space[h] = [id];
  });
  const events = {};
  const domElement = {
    clientWidth: 1280, clientHeight: 800, style: {},
    addEventListener(key, fn) { events[key] = fn; }, removeEventListener() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 800 })
  };
  const renderer = { domElement, render: jest.fn(), setSize() {} };
  return { state, renderer, grid, events };
};

beforeEach(() => { global.window = { addEventListener() {}, removeEventListener() {} }; });
afterEach(() => { delete global.window; });

it("refreshes a selected village area as discovery, current actor and reveal mode change",()=>{
  const {state,renderer}=fixture(),centre=Hex(state.map.centre),next=Hex(centre.x+1,centre.y);
  state.ecs.spatial.site=centre.toPoint();state.ecs.building.site={entrance:1,rooms:[]};state.ecs.controllable={site:{controllerId:"site"}};state.ecs.village={site:{villageId:"v"}};
  state.villages={v:{id:"v",houses:["site"],sharedPlaces:[],origin:{day:0}}};state.ui.selected="site";
  const view=createWorldView(renderer,state,{t:x=>x,onSelect(){}});
  const count=()=>{view.frame();return renderer.render.mock.calls.at(-1)[0].getObjectByName("village-area").children.length;};
  expect(count()).toBe(0);
  state.ecs.playable.player.known.push({x:centre.x,y:centre.y});expect(count()).toBe(1);
  state.ecs.playable.player.known.push({x:next.x,y:next.y});expect(count()).toBe(2);
  state.ecs.playable.other={known:[{x:next.x,y:next.y}]};state.ui.playerId="other";expect(count()).toBe(1);
  view.showWholeMap();expect(count()).toBe(7);
  view.dispose();
});

it("fits the larger map and its edge wall in the whole-map view, including portrait windows", () => {
  const { state, renderer, grid } = fixture();
  const view = createWorldView(renderer, state, { t: x => x, onSelect() {} });
  for (const [width, height] of [[1280, 800], [640, 960]]) {
    renderer.domElement.clientWidth = width;
    renderer.domElement.clientHeight = height;
    view.resize(width, height);
    view.showWholeMap();
    view.frame();
    for (const h of grid.filter(h => Hex(state.map.centre).distance(h) == 22)) {
      const centre = h.toPoint();
      for (const c of Hex().corners()) for (const elevation of [-45, 150]) {
        const p = new THREE.Vector3(centre.x + c.x, elevation, centre.y + c.y).project(view.camera);
        expect(Math.abs(p.x)).toBeLessThan(1);
        expect(Math.abs(p.y)).toBeLessThan(1);
        expect(p.z).toBeLessThan(1);
      }
    }
  }
  view.dispose();
});

it("refreshes terrain, picking and cached grounding after a real pad changes shared heights",()=>{
  const {state,renderer,grid}=fixture(), heights={};
  state.ecs.walkable=Object.fromEntries(Object.keys(state.ecs.mappable).map(id=>[id,{worn:{}}]));
  for(const h of grid) for(const o of Hex().corners()) {
    const p=h.toPoint();heights[Math.round((p.x+o.x)*1000)+","+Math.round((p.y+o.y)*1000)]=480;
  }
  state.map.geography={version:1,heights,routes:[]};
  const view=createWorldView(renderer,state,{t:x=>x,onSelect(){}}), oldMesh=view.terrain.mesh;
  const centre=Hex(state.map.centre),p=centre.toPoint(), id=state.space[centre][0];
  const changed={...heights};
  for(const o of Hex().corners()) changed[Math.round((p.x+o.x)*1000)+","+Math.round((p.y+o.y)*1000)]=490;
  state.map.geography={...state.map.geography,heights:changed};
  view.showWholeMap();view.focusOn(p,1200);view.frame();
  expect(view.terrain.mesh).not.toBe(oldMesh);
  expect(view.ground.hex(p).centre).toBe(490);
  const position=view.terrain.mesh.geometry.attributes.position;
  expect(position.getY(Object.keys(state.ecs.mappable).indexOf(id)*18)).toBe(490);
  const screen=view.screenPosition(id);
  expect(view.pick(screen.x,screen.y)).toBe(id);
  view.dispose();
});

it("hides overhead labels when a real house blocks the person, and restores them when the person is visible", () => {
  const {personLabelVisible}=require("render/world_view");
  const camera=new THREE.PerspectiveCamera(40,1,5,12000);
  camera.position.set(0,100,200);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const roof=new THREE.Mesh(new THREE.BoxGeometry(80,40,80),new THREE.MeshBasicMaterial());
  roof.position.set(0,40,40);roof.updateMatrixWorld();
  expect(personLabelVisible(camera,new THREE.Vector3(0,0,0),36,[roof])).toBe(false);
  expect(personLabelVisible(camera,new THREE.Vector3(100,0,0),36,[roof])).toBe(true);
  expect(personLabelVisible(camera,new THREE.Vector3(0,0,150),36,[roof])).toBe(true);
  roof.geometry.dispose();roof.material.dispose();
});

it.each([[390, 664], [1280, 800]])("projects a known name and real activity into separate readable screen lanes at %sx%s", (width, height) => {
  const { state, renderer, events } = fixture();
  const p = state.map.centre.toPoint();
  state.ecs.spatial.player = { ...p, id: "player" };
  state.ecs.personable.player = { size: 20, body: 0x998877, hair: 1 };
  state.redraws.push("player");
  state.ecs.controllable = { player: { controllerId: "player" } };
  state.ecs.nameable = { player: { nickname: "Will Ashdown" } };
  state.ecs.planner = { player: { task: ["chop_tree"], world: { feeling: {} } } };
  renderer.domElement.clientWidth = width; renderer.domElement.clientHeight = height;
  const view = createWorldView(renderer, state, { t: () => "Chopping", onSelect() {} });
  view.showWholeMap(); view.focusOn(p, 1300);
  for (const angle of [0, 1.239, 2.5]) {
    // Exercise the real frame/layout at local camera angles, with actual sprites.
    events.wheel({ deltaX: angle / .005, deltaY: 0, preventDefault() {} });
    view.frame();
    const scene = renderer.render.mock.calls.at(-1)[0];
    const object = scene.children.find(o => o.userData.entityId == "player");
    const name = object.getObjectByName("person-name"), activity = object.getObjectByName("activity");
    expect(name.visible).toBe(true); expect(activity.visible).toBe(true);
    const bounds = sprite => {
      const point = sprite.getWorldPosition(new THREE.Vector3());
      const depth = -point.clone().applyMatrix4(view.camera.matrixWorldInverse).z;
      const centre = point.project(view.camera);
      return { y: (1-centre.y)*height/2, h: sprite.scale.y*view.camera.projectionMatrix.elements[5]/depth*height/2 };
    };
    const n = bounds(name), a = bounds(activity);
    expect(n.h).toBeGreaterThanOrEqual(19.9); expect(a.h).toBeGreaterThanOrEqual(19.9);
    expect(a.y+a.h/2).toBeLessThan(n.y-n.h/2-1);

  }
  state.ui.debug = true;
  state.ecs.planner.player.task = ["wait_for", 1];
  state.redraws.push("player"); view.frame();
  const object = renderer.render.mock.calls.at(-1)[0].children.find(o => o.userData.entityId == "player");
  expect(object.getObjectByName("person-name").visible).toBe(true);
  expect(object.getObjectByName("activity").visible).toBe(true);
  state.ui.debug = false; state.redraws.push("player"); view.frame();
  const idle = renderer.render.mock.calls.at(-1)[0].children.find(o => o.userData.entityId == "player");
  expect(idle.getObjectByName("person-name").visible).toBe(true);
  expect(idle.getObjectByName("activity")).toBeUndefined();
  view.dispose();
});
