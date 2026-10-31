import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WeddingNotice } from "../src/components/wedding_notice";
import { GameState } from "../src/components/contexts";
jest.mock("components/contexts", () => require("../src/components/contexts"), { virtual: true });

it("can dismiss the current notice while paused without losing the wedding or family facts",()=>{
  const event={id:"w",type:"marriage",people:["a","b"]};
  const s={days:1,game_speed:"paused",wedding:{eventId:"w",until:2,people:["a","b"]},events:[event],ecs:{kinship:{a:{spouse:"b"},b:{spouse:"a"}}},ui:{actions:{end_turn:jest.fn()}}};
  const facts=JSON.stringify({events:s.events,kinship:s.ecs.kinship,wedding:s.wedding});
  const render=()=>renderToStaticMarkup(<GameState.Provider value={s}><WeddingNotice/></GameState.Provider>);
  expect(render()).toContain('aria-label="Dismiss wedding notice"');
  const context=jest.spyOn(React,"useContext").mockReturnValue(s);
  try {
    WeddingNotice().props.children[0].props.onClick();
    expect(WeddingNotice()).toBeNull();
    expect(s.ui.actions.end_turn).toHaveBeenCalledTimes(1);
    expect(s.days).toBe(1);expect(s.game_speed).toBe("paused");
    expect(JSON.stringify({events:s.events,kinship:s.ecs.kinship,wedding:s.wedding})).toBe(facts);
    s.wedding={...s.wedding,eventId:"later-wedding"};
    expect(WeddingNotice()).not.toBeNull();
    s.days=2;expect(WeddingNotice()).toBeNull();
  } finally {context.mockRestore();}
});
