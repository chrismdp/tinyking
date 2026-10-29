import React from "react";
import PropTypes from "prop-types";

import { WorldHex as Hex, HEX_SIZE } from "game/hex";
import { homeOf, BIOMES } from "game/overworld";
import { BIOME_COLOURS } from "render/biomes";

const css = colour => "#" + colour.toString(16).padStart(6, "0");

// NOTE: dark text on light ground, light text on dark
const ink = colour => {
  const r = (colour >> 16) & 255;
  const g = (colour >> 8) & 255;
  const b = colour & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 140 ? "#1d1a17" : "#f4efe6";
};

const OCEAN_COLOUR = 0x286b9b;
const colourOf = h => h.ocean ? OCEAN_COLOUR : BIOME_COLOURS[h.biome];
const labelOf = h => h.ocean ? "ocean" : h.biome;

const MORALITY_MARK = { good: "#f2c14e", evil: "#7a3fa0" };

// NOTE: The world of world hexes, seen from above: each coloured by its
// biome, marked gold (good) or purple (evil), and with labels its three
// axis values. The world hex being played is outlined.
export function Overworld({ world, size, labels, weather }) {
  const home = homeOf(world);
  const scale = size / HEX_SIZE;
  const corners = Hex().corners().map(c => (c.x * scale).toFixed(1) + "," + (c.y * scale).toFixed(1)).join(" ");
  const placed = world.hexes.map(h => ({ ...h, at: Hex(h.x, h.y).toPoint() }));
  const xs = placed.map(h => h.at.x * scale);
  const ys = placed.map(h => h.at.y * scale);
  const left = Math.min(...xs) - size - 4;
  const top = Math.min(...ys) - size - 4;
  const width = Math.max(...xs) - left + size + 4;
  const height = Math.max(...ys) - top + size + 4;
  const line = size * 0.27;

  const hex = (h, isHome) => (
    <g key={h.x + "," + h.y} transform={"translate(" + (h.at.x * scale).toFixed(1) + "," + (h.at.y * scale).toFixed(1) + ")"}
      className={isHome ? "home" : ""}>
      <title>{labelOf(h) + ": " + h.morality + ", " + h.temperature + ", " + h.moisture + (isHome ? " (you are here)" : "")}</title>
      <polygon points={corners} fill={isHome ? "none" : css(colourOf(h))}
        stroke={isHome ? "#d93b30" : "rgba(0, 0, 0, 0.35)"} strokeWidth={isHome ? 3 : 1}/>
      { !isHome && !h.ocean && MORALITY_MARK[h.morality] &&
        <circle cx={0} cy={-size * 0.62} r={size * 0.1} fill={MORALITY_MARK[h.morality]} stroke="rgba(0, 0, 0, 0.4)"/> }
      { !isHome && !weather && (labels || h.ocean) &&
        <text textAnchor="middle" fontSize={line * 0.95} fill={ink(colourOf(h))}>
          { h.ocean ? <>
            <tspan x={0} y={labels ? -line * 0.6 : line * 0.3}>ocean</tspan>
            { labels && <>
              <tspan x={0} y={line * 0.45} fontSize={line * 0.75}>{h.morality}</tspan>
              <tspan x={0} y={line * 1.5} fontSize={line * 0.75}>{h.temperature + " / " + h.moisture}</tspan>
            </> }
          </> : <>
            <tspan x={0} y={-line * 0.6}>{h.morality}</tspan>
            <tspan x={0} y={line * 0.45}>{h.temperature}</tspan>
            <tspan x={0} y={line * 1.5}>{h.moisture}</tspan>
          </> }
        </text> }
      { !isHome && weather && weather[h.x + "," + h.y] && (() => {
        const w = weather[h.x + "," + h.y];
        const length = size * (0.22 + Math.min(1, w.wind.strength) * 0.23);
        return <>
          <text textAnchor="middle" y={-size * 0.05} fontSize={line * 1.05} fill={ink(colourOf(h))}>
            {w.type[0].toUpperCase() + w.type.slice(1)}
          </text>
          <g transform={"translate(0," + size * 0.38 + ")"}>
            <path className="wind-arrow" transform={"rotate(" + w.wind.direction * 180 / Math.PI + ")"}
              d={"M " + -length + " 0 H " + length + " m -4 -3 l 4 3 -4 3"}
              fill="none" stroke={ink(colourOf(h))} strokeWidth={1.4} opacity={w.wind.strength > 0.01 ? 1 : 0.25}/>
          </g>
        </>;
      })() }
    </g>
  );

  return (
    <svg className="overworld" width={width} height={height} viewBox={[left, top, width, height].join(" ")}>
      { placed.map(h => hex(h, false)) }
      { hex(placed.find(h => h.x == home.x && h.y == home.y), true) }
    </svg>
  );
}

Overworld.propTypes = {
  world: PropTypes.object.isRequired,
  size: PropTypes.number.isRequired,
  labels: PropTypes.bool,
  weather: PropTypes.object
};

export function BiomeKey() {
  return (
    <ul className="biome-key">
      <li><span className="swatch" style={{ background: css(OCEAN_COLOUR) }}/>ocean</li>
      { Object.keys(BIOMES).map(b => (
        <li key={b}><span className="swatch" style={{ background: css(BIOME_COLOURS[b]) }}/>{b}</li>
      )) }
    </ul>
  );
}

// NOTE: Shared by the debug world and the new-game seed preview.
export function WeatherMap({ world, weather, size, labels }) {
  const [showWeather, setShowWeather] = React.useState(false);
  return <div>
    <label><input type="checkbox" checked={showWeather} onChange={e => setShowWeather(e.target.checked)}/> Weather and wind</label>
    <Overworld world={world} size={size} labels={labels} weather={showWeather ? weather : undefined}/>
  </div>;
}

WeatherMap.propTypes = Overworld.propTypes;
