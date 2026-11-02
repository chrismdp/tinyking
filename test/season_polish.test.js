import { economy } from './support/economy';
import { newEntities } from 'game/entities';
import { recordEvent, learnEvent, eventSentence, eventText } from 'game/events';
import { seasonLines } from 'game/seasons';
import { personLabel } from 'game/knowledge';

it('groups repeated known life events while preserving every source event and separate reasons',()=>{
  const {s,p}=economy();s.days=2;
  const men=newEntities(s,Array.from({length:4},()=>({personable:{age:30},nameable:{male:true},kinship:{parents:[],children:[]}})));
  const events=men.map((id,i)=>recordEvent(s,'departure',[id],[],{toWorld:i+',3',reason:i==3?'to find work':'to seek company elsewhere',audienceIds:[p]}));
  recordEvent(s,'departure',[men[0]],[],{toWorld:'5,3',reason:'to seek company elsewhere',audienceIds:[]});
  const rows=seasonLines(s,0);expect(rows).toHaveLength(2);
  expect(rows[0].text).toBe('Three men left to seek company elsewhere.');expect(rows[0].eventIds).toEqual(events.slice(0,3).map(e=>e.id));
  expect(rows[1].text).toContain('to find work');expect(rows.map(r=>r.text).join(' ')).not.toMatch(/\d+,\d+/);
});
it.each(['departure','arrival','world_visit','return','world_move'])('%s uses readable places in shared event sentences and news',type=>{
  const {s,p}=economy();const e=recordEvent(s,type,[p],[],{toWorld:'5,3',fromWorld:'4,3',worldHex:'5,3',audienceIds:[p]});
  for(const text of [eventSentence(s,e,()=> 'Will'),eventText(s,e,()=> 'Will','chat')]){
    expect(text).not.toMatch(/\d+,\d+/);expect(text).toContain('another region');
  }
  learnEvent(s,p,e);expect(seasonLines(s,0).map(r=>r.text).join(' ')).not.toMatch(/\d+,\d+/);
});
it('uses a learned trade or disclosed spouse to describe festival strangers without exposing names',()=>{
  const {s,p}=economy();const [miller,wife]=newEntities(s,[{personable:{age:40},nameable:{male:true,nickname:'Secret Miller'}},{personable:{age:40},nameable:{male:false,nickname:'Secret Wife'},kinship:{spouse:null,parents:[],children:[]}}]);
  s.ecs.kinship[wife].spouse=miller;s.ecs.profession={[miller]:{trade:'miller'}};
  s.knowledge={[p]:{people:{[miller]:{nameOnly:true,trade:'miller'}},kinLinks:{married:{speaker_id:miller,relative_id:wife,kinship:'spouse'}}}};
  expect(personLabel(s,wife)).toBe("the miller's wife");expect(personLabel(s,wife)).not.toContain('Secret');
  s.knowledge[p].kinLinks.married.kinship='cousin';expect(personLabel(s,wife)).not.toContain('wife');
  delete s.knowledge[p].kinLinks;expect(personLabel(s,wife)).not.toContain('wife');
});

it('uses visible appearance instead of an indistinct generated cottage label',()=>{
  const {s,p,camp}=economy();const [n]=newEntities(s,[{personable:{age:30,hair:2},nameable:{male:false,nickname:'Private'},spatial:{...s.ecs.spatial[p]},household:{houseId:camp}}]);
  s.ecs.nameable[camp]={nickname:'Family cottage'};s.ecs.playable[p].known=[require('game/hex').Hex().fromPoint(s.ecs.spatial[camp])];
  expect(personLabel(s,n)).toBe('a woman with black hair');expect(s.knowledge).toBeUndefined();
});
