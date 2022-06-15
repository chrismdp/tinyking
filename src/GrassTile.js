import Model from "./models/Grass.js";

export default function GrassTile({x, y, type}) {
  return (
    <Model position={[x, 0, y]}/>
  )
}
