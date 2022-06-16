import Model from "./models/Grass.js";

export default function GrassTile({x, y, type, ...props}) {
  return (
    <Model position={[x, 0, y]} {...props}/>
  )
}
