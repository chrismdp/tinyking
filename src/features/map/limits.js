import { ring } from "./hex"

const limitRange = (tileInfo, key) => {
  const { min, max } = minMax(Object.values(tileInfo).map(t => ((t.limits || {})[key] || 0)));
  return max - min;
};

const minMax = (array) => array.reduce((memo, h) => ({
  max: Math.max(h, memo.max),
  min: Math.min(h, memo.min)
}), { max: Number.MIN_SAFE_INTEGER, min: Number.MAX_SAFE_INTEGER});


const allLimitValues = (tileInfo) => Object.keys(Object.values(tileInfo).reduce((memo, t) => ({...memo, ...t.limits}), {}));

export const limits = (terrainInfo, tileInfo, tiles, tile) => allLimitValues(terrainInfo).reduce((memo, key) => ({
  ...memo,
  [key]: limitsForKey({ terrainInfo, tileInfo, tiles, tile, key })
}), {});

const readLimit = (tile, key) => (tile.limits || {})[key] || 0;

const limitsForKey = ({ terrainInfo, tileInfo, tiles, tile, key }) => {
  const values = [...Array(limitRange(terrainInfo, key)).keys()].flatMap(radius =>
    minMax(ring(tile, radius + 1)
      .filter(hex => tiles[hex.toString()])
      .map(hex => readLimit(terrainInfo[tileInfo[tiles[hex.toString()].type].terrain], key))
    ))
  const result = values.reduce((memo, { min, max }, i) => ({
    max: Math.max(memo.max, max - i),
    min: Math.min(memo.min, min + i)
  }), { max: Number.MIN_SAFE_INTEGER, min: Number.MAX_SAFE_INTEGER});
  return { max: result.min + 1, min: result.max - 1 };
}

export const limitRules = (tileInfo, tile) => allLimitValues(tileInfo).reduce((memo, key) => ({
  ...memo,
  [`limits.${key}.max`]: { greaterEq: readLimit(tileInfo[tile], key) },
  [`limits.${key}.min`]: { lessEq: readLimit(tileInfo[tile], key) },
}), {});

