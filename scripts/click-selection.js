/* eslint-disable no-undef */
// Browser-side selection observes actual drawn targets and never changes game state.
function browserClickPoint(id) {
    const s = window.tinyking;
    const at = s.ecs.spatial[id];
    if (!at) {
      return null;
    }
    const camera = s.renderer.camera;
    const canvas = document.querySelector("#world canvas");
    const project = (x, y, z) => {
      const v = camera.matrixWorldInverse.elements;
      const p = camera.projectionMatrix.elements;
      const e = [x, y, z, 1];
      const view = [0, 1, 2, 3].map(r => v[r] * e[0] + v[4 + r] * e[1] + v[8 + r] * e[2] + v[12 + r] * e[3]);
      const clip = [0, 1, 2, 3].map(r => p[r] * view[0] + p[4 + r] * view[1] + p[8 + r] * view[2] + p[12 + r] * view[3]);
      return { x: (clip[0] / clip[3] + 1) / 2 * canvas.clientWidth, y: (1 - clip[1] / clip[3]) / 2 * canvas.clientHeight };
    };
    const ground = s.renderer.ground;
    let points;
    if (s.ecs.mappable[id]) {
      // NOTE: the centre, then halfway out towards each corner
      points = [[0, 0], [30, 0], [15, 26], [-15, 26], [-30, 0], [-15, -26], [15, -26]]
        .map(([dx, dy]) => project(at.x + dx, ground.heightAt(at.x + dx, at.y + dy) + 0.5, at.y + dy));
    } else {
      const object = s.renderer.objectOf(id);
      const top = object ? object.userData.anchorHeight || 10 : 10;
      points = [0.6, 0.3, 0.9].map(f => project(at.x, ground.heightAt(at.x, at.y) + top * f, at.y));
      if (s.ecs.tree?.[id] && object?.geometry) {
        object.geometry.computeBoundingBox?.();
        const box=object.geometry.boundingBox;
        object.updateMatrixWorld(true);
        for(const x of [.2,.5,.8])for(const y of [.2,.4,.6,.8])for(const z of [.2,.5,.8]) {
          const point=object.position.clone().set(box.min.x+(box.max.x-box.min.x)*x,box.min.y+(box.max.y-box.min.y)*y,box.min.z+(box.max.z-box.min.z)*z);
          object.localToWorld(point);
          points.push(project(point.x,point.y,point.z));
        }
      }
    }
    return points
      .filter(p => p.x > 20 && p.x < canvas.clientWidth - 20 && p.y > 20 && p.y < canvas.clientHeight - 120)
      .find(p => s.renderer.pick(p.x, p.y) == id && document.elementFromPoint(p.x, p.y) == canvas) || null;
}
module.exports={browserClickPoint};
