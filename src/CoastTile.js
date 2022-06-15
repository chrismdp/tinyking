import Model from "./models/Water.js";

export default function CoastTile({x, y, type}) {
  return (
    <Model position={[x, 0, y]}/>
  )
}
