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

it("keeps realm inspection read-only, hides distant detail, restores You and disposes its resources",()=>{
  const {state,renderer,events}=fixture();
  state.world.landSeed="13:0";
  state.world.hexes.push({x:1,y:0,biome:"taiga",temperature:"cold",moisture:"wet"});
  state.travel={active:"0,0",maps:{"0,0":{}},people:{one:{}}};
  state.ecs.spatial.player=state.map.centre.toPoint();
  state.weather={"0,0":{type:"rain",wind:{x:1,y:0,strength:.5}},"1,0":{type:"snow",wind:{x:0,y:1,strength:.25}}};
  renderer.domElement.setPointerCapture=()=>{};
  const selected=jest.fn();
  const view=createWorldView(renderer,state,{t:x=>x,onSelect:selected});
  view.frame();
  const coarse=view.realmTerrain.mesh, dispose=jest.spyOn(coarse.geometry,"dispose");
  const before=JSON.stringify({days:state.days,travel:state.travel,world:state.world,ecs:state.ecs});
  view.showRealm();view.frame();
  expect(view.overview).toBe(true);expect(view.following).toBe(false);
  expect(view.mapLevel.people).toBe(false);
  const scene=renderer.render.mock.calls.at(-1)[0];scene.updateMatrixWorld(true);
  expect(scene.getObjectByName("realm-wind").visible).toBe(false);
  state.ui.mapLayers={wind:true,weather:true,communities:false};view.frame();
  expect(scene.getObjectByName("realm-wind").visible).toBe(true);
  const arrow=scene.getObjectByName("realm-wind").geometry.attributes.position;
  expect(arrow.getX(1)).toBeGreaterThan(arrow.getX(0));expect(arrow.getZ(1)).toBeCloseTo(arrow.getZ(0));
  const target=view.realmTerrain.layout.reaches[1].centre;
  const p=new THREE.Vector3(target.x,view.realmTerrain.heightAt(target.x,target.y),target.y).project(view.camera);
  const clientX=(p.x+1)*renderer.domElement.clientWidth/2,clientY=(1-p.y)*renderer.domElement.clientHeight/2;
  events.pointerdown({pointerId:1,button:0,clientX,clientY});events.pointerup({pointerId:1,button:0,clientX,clientY});
  expect(state.ui.realmSelection.reachKey).toBe("1,0");expect(selected).not.toHaveBeenCalled();
  for(let i=0;i<5;i++){view.recenter();view.frame();view.showRealm();view.frame();expect(view.realmTerrain.mesh).toBe(coarse);}
  expect(JSON.stringify({days:state.days,travel:state.travel,world:state.world,ecs:state.ecs})).toBe(before);
  view.recenter();view.frame();expect(view.cameraDistance).toBe(1000);expect(view.following).toBe(true);expect(view.overview).toBe(false);
  view.dispose();expect(dispose).toHaveBeenCalledTimes(1);
});

it("keeps coast/sea depth separation at realm scale and restores local and arrival clipping",()=>{
  const {state,renderer}=fixture();state.world.landSeed="13:0";state.travel={maps:{}};
  state.world.hexes.push({x:5,y:5,biome:"grassland",temperature:"temperate"});
  const view=createWorldView(renderer,state,{t:x=>x,onSelect(){}});
  view.focusOn(state.map.centre.toPoint(),110000);view.frame();
  const depth=y=>new THREE.Vector3(view.camera.position.x,0,view.camera.position.z).setY(y).project(view.camera).z;
  expect(view.camera.near).toBeGreaterThan(1000);
  expect(Math.abs(depth(-.12)-depth(-3))).toBeGreaterThan(4/Math.pow(2,24));
  view.resize(390,664);view.frame();expect(view.camera.near).toBeGreaterThan(1000);
  view.recenter();view.frame();expect(view.camera.near).toBe(5);
  expect(view.camera.far).toBeGreaterThan(12000);
  view.focusOn(state.map.centre.toPoint(),1500);view.frame();expect(view.camera.near).toBe(5);
  view.dispose();
});

it("invalidates memoised active realm heights after a real shared-surface replacement",()=>{
  const {state,renderer,grid}=fixture(),heights={};
  state.world.landSeed="13:0";state.travel={maps:{}};
  state.ecs.walkable=Object.fromEntries(Object.keys(state.ecs.mappable).map(id=>[id,{worn:{}}]));
  for(const h of grid)for(const o of Hex().corners()){
    const p=h.toPoint();heights[Math.round((p.x+o.x)*1000)+","+Math.round((p.y+o.y)*1000)]=480;
  }
  state.map.geography={version:1,heights,routes:[]};
  const view=createWorldView(renderer,state,{t:x=>x,onSelect(){}}),p=state.map.centre.toPoint();
  expect(view.realmTerrain.heightAt(p.x,p.y)).toBe(480);
  const next={...heights};
  for(const o of Hex().corners())next[Math.round((p.x+o.x)*1000)+","+Math.round((p.y+o.y)*1000)]=490;
  state.map.geography={...state.map.geography,heights:next};
  view.frame();
  expect(view.ground.heightAt(p.x,p.y)).toBe(490);
  expect(view.realmTerrain.heightAt(p.x,p.y)).toBe(490);
  const positions=view.realmTerrain.mesh.geometry.attributes.position;
  const vertex=Array.from({length:positions.count},(_,i)=>i).find(i=>Math.abs(positions.getX(i)-p.x)<.01 && Math.abs(positions.getZ(i)-p.y)<.01);
  expect(positions.getY(vertex)).toBeCloseTo(489.88,2);
  view.focusOn(p,1000);view.frame();
  expect(view.metrics.pose.y).toBe(490);
  view.dispose();
});

it("keeps the overview readable at night without changing the calendar or close-range lighting",()=>{
  const {state,renderer}=fixture();state.world.landSeed="13:0";state.travel={maps:{}};state.days=0;
  const view=createWorldView(renderer,state,{t:x=>x,onSelect(){}});
  view.focusOn(state.map.centre.toPoint(),9000);view.frame();
  const scene=renderer.render.mock.calls.at(-1)[0],fill=scene.children.find(o=>o.isHemisphereLight);
  expect(fill.intensity).toBe(1);expect(state.days).toBe(0);
  view.recenter();view.frame();expect(fill.intensity).toBeCloseTo(.55);expect(state.days).toBe(0);
  view.dispose();
});

it("updates the existing wind buffer from a new hourly model sample and keeps layer toggles local to the view",()=>{
  const {state,renderer}=fixture();state.world.landSeed="13:0";state.travel={maps:{}};state.ui.mapLayers={wind:true};
  state.weather={"0,0":{type:"rain",wind:{x:1,y:0,strength:.5}}};
  const view=createWorldView(renderer,state,{t:x=>x,onSelect(){}});view.showRealm();view.frame();
  const wind=renderer.render.mock.calls.at(-1)[0].getObjectByName("realm-wind"),buffer=wind.geometry.attributes.position;
  expect(buffer.getX(1)).toBeGreaterThan(buffer.getX(0));
  const next={"0,0":{type:"cloudy",wind:{x:0,y:-1,strength:.7}}};state.weather=next;view.frame();
  expect(wind.geometry.attributes.position).toBe(buffer);expect(buffer.getZ(1)).toBeLessThan(buffer.getZ(0));
  state.ui.mapLayers.wind=false;view.frame();expect(wind.visible).toBe(false);expect(state.weather).toBe(next);
  view.dispose();
});
