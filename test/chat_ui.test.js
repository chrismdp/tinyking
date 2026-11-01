/* global jest, it, expect, afterEach, require */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GameState } from "../src/components/contexts";
import { ChatChoice, ChatPanel } from "../src/components/chat_panel";
import { createChatPlayback, presentChoices, explainIcon } from "../src/components/chat_presentation";
import { peopleWorld } from "./support/people";
import { openChat, speakLine, chatChoices } from "game/chat";
import { recordEvent } from "game/events";
jest.mock("components/contexts",()=>require("../src/components/contexts"),{virtual:true});
jest.mock("game/name",()=>({name:n=>n?.nickname||"?"}));
const topic=key=>({kind:"topic",key});
function setup(){
  const w=peopleWorld(),s=w.state;
  s.ui.actions={};s.ecs.spatial[w.player]={...s.ecs.spatial[w.person],x:s.ecs.spatial[w.person].x-45};
  openChat(s,w.player,w.person);return w;
}
afterEach(()=>jest.useRealTimers());
it("stages each speaker for a second, drops, pops, then offers the next turn",()=>{
  jest.useFakeTimers();const seen=[];
  const play=createChatPlayback(frame=>seen.push(frame));
  const before={row:[topic("family")],regard:10,learned:{}};
  const after={row:[],regard:11,learned:{topicTastes:{family:1}}};
  const player={speaker:"player",text:"Family",icons:[topic("family")],pops:[{...topic("family"),amount:1}],presentation:{before,after}};
  const npc={speaker:"npc",text:"The fields",icons:[topic("harvest")],pops:[],presentation:{before:after,after:{...after,row:[topic("harvest")]}}};
  play.enqueue([player,npc]);expect(seen.at(-1)).toMatchObject({phase:"stage",line:player,view:before,busy:true});
  jest.advanceTimersByTime(1099);expect(seen.at(-1).phase).toBe("stage");
  jest.advanceTimersByTime(1);expect(seen.at(-1).phase).toBe("drop");expect(seen.at(-1).view).toEqual(before);
  jest.advanceTimersByTime(350);expect(seen.at(-1)).toMatchObject({phase:"pop",line:player});
  jest.advanceTimersByTime(600);expect(seen.at(-1)).toMatchObject({phase:"settle",view:after});
  jest.advanceTimersByTime(250);expect(seen.at(-1)).toMatchObject({phase:"stage",line:npc});
  jest.runAllTimers();expect(seen.at(-1)).toMatchObject({busy:false,view:npc.presentation.after});
  play.dispose();
});
it("cancels playback on close so a pending turn cannot update another chat",()=>{
  jest.useFakeTimers();const update=jest.fn(),play=createChatPlayback(update);
  play.enqueue([{speaker:"npc",text:"Hello",icons:[topic("village")],pops:[]}]);play.dispose();
  const count=update.mock.calls.length;jest.runAllTimers();expect(update).toHaveBeenCalledTimes(count);
});
it("records row, regard and learned tastes before each spoken line",()=>{
  const {state:s,player:p,person:n}=setup();s.chat.active.row=[topic("family")];
  const before=s.ecs.relationships[n].known[p]?.goodwill||0;
  speakLine(s,{id:"ui-pair",useKey:"ui-pair",family:"test",speaker:"player",text:"Family",icons:[topic("family")],tags:{},effects:[]});
  expect(s.chat.active.transcript.at(-1).presentation).toMatchObject({before:{row:[topic("family")],regard:before},after:{row:[],regard:before+1,learned:{topicTastes:{family:1}}}});
});
it("puts every direct answer before unrelated choices and marks the speaker correctly",()=>{
  const {state:s}=setup();s.chat.active.expectation="name";
  const choices=presentChoices(s,chatChoices(s));
  expect(choices[0].answer).toBe("Answers what she said");
  expect(choices.findIndex(l=>!l.answer)).toBeGreaterThan(0);
  const html=renderToStaticMarkup(<GameState.Provider value={s}><ChatPanel/></GameState.Provider>);
  expect(html.indexOf("Answers what she said")).toBeLessThan(html.indexOf("Other subjects"));
});
it("distinguishes real Tell accounts even when two harvests have the same wording and day",()=>{
  const {state:s,player:p,person:n,parent}=setup();s.chat.active.row=[];s.chat.active.focus="tell";delete s.chat.active.expectation;
  s.ecs.relationships[n].known[p]={ring:"intimate",goodwill:70};
  recordEvent(s,"harvest",[parent],[],{day:1,audienceIds:[p]});recordEvent(s,"harvest",[parent],[],{day:1,audienceIds:[p]});
  const choices=presentChoices(s,chatChoices(s)).filter(l=>l.family=="gossip_tell");
  expect(choices).toHaveLength(2);expect(new Set(choices.map(l=>l.title)).size).toBe(2);
  expect(choices.every(l=>!l.title.includes("an unknown person"))).toBe(true);
});
it("selects on a touch tap and speaks only through Say this; chip taps also select",()=>{
  const onSelect=jest.fn(),onSpeak=jest.fn(),onExplain=jest.fn();
  const l={key:"choice",id:"choice",text:"Hello",title:"Hello",icons:[topic("family")]};
  const props={line:l,preview:{fits:true,matches:1,matchingKeys:["topic:family"]},onSelect,onSpeak,onExplain,onPreview:()=>{},reaction:()=>null};
  const card=ChatChoice(props);card.props.onClick({nativeEvent:{pointerType:"touch"}});
  expect(onSelect).toHaveBeenCalledWith("choice");expect(onSpeak).not.toHaveBeenCalled();
  const all=node=>[node,...React.Children.toArray(node?.props?.children).flatMap(x=>typeof x==="object"?all(x):[])];
  const chip=all(card).find(x=>x.type?.name==="ChatIcon");chip.props.onExplain(topic("family"));
  expect(onExplain).toHaveBeenCalledWith(topic("family"));expect(onSelect).toHaveBeenCalledTimes(2);expect(onSpeak).not.toHaveBeenCalled();
  const selected=ChatChoice({...props,selected:true});all(selected).find(x=>x.props?.className==="chat-say").props.onClick({stopPropagation:()=>{}});
  expect(onSpeak).toHaveBeenCalledWith("choice");
  card.props.onClick({nativeEvent:{pointerType:"mouse"}});expect(onSpeak).toHaveBeenCalledTimes(2);
});
it("explains unknown moods and locked grievances without reading hidden tastes",()=>{
  const {state:s}=setup();expect(explainIcon(s,{kind:"mood",key:"guarded"},{})).toContain("do not yet know");
  expect(explainIcon(s,{kind:"grievance"},{})).toContain("cannot match");
});
it("stages a grievance created by a risky line as a locked spoken icon",()=>{
  jest.useFakeTimers();const seen=[],play=createChatPlayback(f=>seen.push(f));
  play.enqueue([{speaker:"player",text:"No",icons:[topic("woodland")],pops:[],presentation:{icons:[topic("woodland"),{kind:"grievance"}]}}]);
  expect(seen.at(-1).line.icons).toEqual([topic("woodland"),{kind:"grievance"}]);play.dispose();
});
it("distinguishes accounts at different times that share the same displayed date",()=>{
  const {state:s}=setup();
  const cards=[0.1,0.2].map((day,n)=>({key:"event-"+n,text:"A harvest today.",family:"gossip_tell",b:{event:{day,when_exact:"on Day 1 of Spring"}}}));
  const titles=presentChoices(s,cards).map(l=>l.title);
  expect(new Set(titles).size).toBe(2);
});
it("describes an unnamed speaker in explanations and answer labels",()=>{
  const {state:s,player:p,person:n}=setup();s.knowledge[p].people={};s.ecs.relationships[p].known={};
  delete s.ecs.nameable[n].male;s.chat.active.expectation="name";
  expect(explainIcon(s,topic("season"),{})).not.toContain("an unknown person");
  expect(presentChoices(s,[{text:"Hello",answers:["name"]}])[0].answer).not.toContain("an unknown person");
  s.chat.active.lastPops=[{...topic("village"),amount:1}];
  const markup=renderToStaticMarkup(<GameState.Provider value={s}><ChatPanel/></GameState.Provider>);
  expect(markup).not.toContain(" · a’s regard");
});
