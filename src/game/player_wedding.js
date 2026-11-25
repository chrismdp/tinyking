import { knownEvents } from "game/events";
import { personLabel } from "game/knowledge";
import { name } from "game/name";

// Use the wedding's home, rather than a later address, for lasting memories.
export function playerWeddings(s,actor=s.ui.playerId) {
  return knownEvents(s,actor).filter(e=>e.type=="marriage"&&e.people.includes(actor)).map(event=>{
    const named=event.people.map(id=>personLabel(s,id,s.personName,actor));
    const house=s.ecs.nameable?.[event.houseId];
    const village=s.villages?.[event.villageId]?.name;
    const home=house?name(house)+(village?" in "+village:""):village||"our shared home";
    return {...event,text:`${named.join(" and ")} married. Our home is ${home}. Our families celebrated with us.`};
  });
}
