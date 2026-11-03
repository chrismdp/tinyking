import { economy } from './support/economy';
import { newEntities } from 'game/entities';
import { recordEvent } from 'game/events';
import { seasonLines } from 'game/seasons';
import { personLabel } from 'game/knowledge';

it('groups repeated known life events while preserving every source event and separate reasons',()=>{
  const {s,p}=economy();s.days=2;
  const men=newEntities(s,Array.from({length:4},()=>({personable:{age:30},nameable:{male:true},kinship:{parents:[],children:[]}})));
  const events=men.map((id,i)=>recordEvent(s,'departure',[id],[],{toWorld:i+',3',reason:i==3?'to find work':'to seek company elsewhere',audienceIds:[p]}));
  recordEvent(s,'departure',[men[0]],[],{toWorld:'5,3',reason:'to seek company elsewhere',audienceIds:[]});
  const rows=seasonLines(s,0);expect(rows).toHaveLength(2);
  expect(rows[0].eventIds).toEqual(events.slice(0,3).map(e=>e.id));
  expect(rows[1].id).toBe(events[3].id);
});
it('uses a learned trade or disclosed spouse to describe festival strangers without exposing names',()=>{
  const {s,p}=economy();const [miller,wife]=newEntities(s,[{personable:{age:40},nameable:{male:true,nickname:'Secret Miller'}},{personable:{age:40},nameable:{male:false,nickname:'Secret Wife'},kinship:{spouse:null,parents:[],children:[]}}]);
  s.ecs.kinship[wife].spouse=miller;s.ecs.profession={[miller]:{trade:'miller'}};
  s.knowledge={[p]:{people:{[miller]:{nameOnly:true,trade:'miller'}},kinLinks:{married:{speaker_id:miller,relative_id:wife,kinship:'spouse'}}}};
  expect(personLabel(s,wife)).toBe("the miller's wife");expect(personLabel(s,wife)).not.toContain('Secret');
  s.knowledge[p].kinLinks.married.kinship='cousin';expect(personLabel(s,wife)).not.toContain('wife');
  delete s.knowledge[p].kinLinks;expect(personLabel(s,wife)).not.toContain('wife');
});
