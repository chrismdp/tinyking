// NOTE: For some reason the default water material included in the models
// isn't the right colour - create our own one
export function WaterMaterial() {
  return (<meshStandardMaterial color={[0, 0.7, 1]}/>);
}
