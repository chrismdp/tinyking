import * as THREE from "three";

// NOTE: Three fixed buffers, animated in the vertex shader. Only uniforms
// change on a frame; none of the particles are entities or pickable objects.
export function createWeatherView(ground = { heightAt: () => 0 }) {
  const mesh = new THREE.Group();
  const direction = new THREE.Vector3();
  const centre = new THREE.Vector3();
  const uniforms = {
    weatherTime: { value: 0 }, wind: { value: new THREE.Vector2() },
    centre: { value: centre }, span: { value: 1200 }
  };
  const make = (kind, count) => {
    const rain = kind == "rain";
    const dust = kind == "dust";
    const positions = [];
    const tails = [];
    // NOTE: stable, evenly scattered particles without Math.random or textures.
    for (let i = 0; i < count; i++) {
      const x = (i * 0.754877666) % 1;
      const y = (i * 0.569840296 + 0.13) % 1;
      const z = (i * 0.438579113 + 0.37) % 1;
      for (let end = 0; end < (rain ? 2 : 1); end++) {
        positions.push(x, y, z);
        tails.push(end);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("tail", new THREE.Float32BufferAttribute(tails, 1));
    const material = new THREE.ShaderMaterial({
      uniforms,
      transparent: true, depthWrite: false,
      vertexShader: `
        uniform float weatherTime;
        uniform vec2 wind;
        uniform vec3 centre;
        uniform float span;
        attribute float tail;
        void main() {
          float height = ${dust ? "65.0" : "500.0"};
          float speed = ${rain ? "350.0" : dust ? "-6.0" : "32.0"};
          float drift = ${rain ? "65.0" : dust ? "180.0" : "45.0"};
          vec3 p;
          p.x = mod(position.x * span + wind.x * weatherTime * drift, span) - span * 0.5;
          p.z = mod(position.z * span + wind.y * weatherTime * drift, span) - span * 0.5;
          p.y = mod(position.y * height - weatherTime * speed, height);
          ${rain ? "p += vec3(-wind.x * 8.0, 18.0, -wind.y * 8.0) * tail;" :
    "p.x += sin(weatherTime * 1.4 + position.z * 32.0) * 7.0;"}
          vec4 mv = modelViewMatrix * vec4(p + centre, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(${dust ? "2400.0" : "2000.0"} / max(1.0, -mv.z), 1.3, 4.0);
        }`,
      fragmentShader: rain ? `
        void main() { gl_FragColor = vec4(0.68, 0.79, 0.9, 0.38); }
      ` : `
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float alpha = 1.0 - smoothstep(0.15, 0.5, d);
          gl_FragColor = vec4(${dust ? "0.63, 0.47, 0.22, alpha * 0.6" : "0.93, 0.97, 1.0, alpha * 0.85"});
        }`
    });
    const particles = rain ? new THREE.LineSegments(geometry, material) : new THREE.Points(geometry, material);
    particles.name = kind;
    particles.frustumCulled = false;
    particles.visible = false;
    mesh.add(particles);
    return particles;
  };
  const rain = make("rain", 650);
  const snow = make("snow", 420);
  const dust = make("dust", 160);
  return {
    mesh,
    update(weather, camera, seconds, plains, cold = weather?.type == "snow") {
      const type = weather && weather.type;
      const wetStorm = type == "storm" && (weather.moisture === undefined || weather.moisture >= 0.46);
      rain.visible = (["rain","snow"].includes(type) || wetStorm) && !cold;
      snow.visible = (["rain","snow"].includes(type) || wetStorm) && cold;
      dust.visible = type == "storm" && plains;
      if (!rain.visible && !snow.visible && !dust.visible) return;
      camera.getWorldDirection(direction);
      const distance = camera.position.y / Math.max(0.15, -direction.y);
      centre.copy(camera.position).addScaledVector(direction, distance);
      centre.y = ground.heightAt(centre.x, centre.z) + 3;
      uniforms.span.value = Math.max(500, Math.min(6000, distance * 1.6));
      uniforms.weatherTime.value = seconds;
      uniforms.wind.value.set(weather.wind.x, weather.wind.y).multiplyScalar(Math.min(1.5, weather.wind.strength));
    },
    dispose() {
      for (const child of mesh.children) {
        child.geometry.dispose();
        child.material.dispose();
      }
      mesh.clear();
    }
  };
}
