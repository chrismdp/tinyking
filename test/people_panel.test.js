import React from "react";
import { I18n } from "react-polyglot";
import messages from "../src/data/messages.json";
import { renderToStaticMarkup } from "react-dom/server";
import { PersonPanel } from "../src/components/person_panel";
import { GameState } from "../src/components/contexts";
import { peopleWorld } from "./support/people";

jest.mock("components/contexts", () => require("../src/components/contexts"), { virtual: true });
jest.mock("game/name", () => ({ name: n => n.nickname }));
const render = (state, view) => renderToStaticMarkup(<I18n locale="en" messages={messages}><GameState.Provider value={state}>{view}</GameState.Provider></I18n>);

// The component computes visible traits inline. Keep this disclosure rule
// until it can be tested through a model function without changing src/.
it("never labels independently known people as kin or grants traits merely for trust",()=>{
  const {state:s,player:p,person:n,parent,sibling}=peopleWorld();
  s.ecs.relationships[n].known[p]={ring:"personal",goodwill:36};
  s.knowledge={[p]:{people:Object.fromEntries([n,parent,sibling].map(id=>[id,{traits:[],conversation:{day:s.days}}])),feelings:{}}};
  let html=render(s,<PersonPanel entityId={n}/>);
  expect(html).not.toContain('class="kin">Mother');expect(html).not.toContain('class="kin">Sister');
  expect(html).not.toContain('>Generous<');expect(html).not.toContain('>Proud<');
  expect(html).toContain("Household heir: Not yet learned");
  s.knowledge[p].kinLinks={[`${n}:${sibling}:sibling`]:{speaker_id:n,relative_id:sibling,kinship:"sibling"}};
  s.knowledge[p].people[n].traits=["brave"];
  html=render(s,<PersonPanel entityId={n}/>);
  expect(html).toContain('class="kin">Sister');expect(html).toContain('>Brave<');
  expect(html).not.toContain('class="kin">Mother');
});
