import Model from "./models/Grass_forest.js";

export default function ForestTile({x, y, type}) {
  return (
    <Model position={[x, 0, y]}/>
  )
}
