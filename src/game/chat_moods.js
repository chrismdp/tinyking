import { hashUnit } from "game/math";
import { personComponent } from "game/residents";

export const MOODS={guarded:"Guarded",grumbling:"Grumbling",cheerful:"Cheerful",joking:"Joking"};
const affinities={guarded:[["gloomy","timid"],["proud","cheerful"]],grumbling:[["gloomy","lazy"],["proud","cheerful"]],cheerful:[["cheerful","generous"],["gloomy"]],joking:[["cheerful","worldly"],["proud","pious"]]};
// A separate, stable taste per person and mood. Trait dispositions bias it;
// seeded variation breaks ties. Opinion seeds already travel with the person.
export function moodScore(s,id,key) {
  const p=personComponent(s,"personality",id),[likes,dislikes]=affinities[key];
  const weight=t=>Number(p.traits.includes(t))+Number(p.likes.includes(t))-Number(p.dislikes.includes(t));
  const bias=likes.reduce((v,t)=>v+weight(t),0)-dislikes.reduce((v,t)=>v+weight(t),0);
  return Math.max(-2,Math.min(2,bias)) || (hashUnit(`${p.opinionSeed??s.peopleSeed}:mood:${id}:${key}`)<.5?-1:1);
}
