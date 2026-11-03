const fs=require('fs'),v8=require('v8'),{isDeepStrictEqual}=require('util');
const kind=process.argv[2],left=process.argv[3],right=process.argv[4];
const a=v8.deserialize(fs.readFileSync(`shots/regress-${kind}-${left}.v8`));
const b=v8.deserialize(fs.readFileSync(`shots/regress-${kind}-${right}.v8`));
const equal=isDeepStrictEqual(a,b);
function difference(a,b,path='',seen=new WeakMap()) {
 if(Object.is(a,b))return;
 if(!a||!b||typeof a!=='object'||typeof b!=='object')return {path,a,b};
 if(seen.get(a)===b)return;seen.set(a,b);
 const ak=Object.keys(a),bk=Object.keys(b);
 if(ak.length!==bk.length)return {path,keysA:ak.length,keysB:bk.length,onlyA:ak.filter(k=>!Object.hasOwn(b,k)).slice(0,10),onlyB:bk.filter(k=>!Object.hasOwn(a,k)).slice(0,10)};
 for(const k of ak){if(!Object.hasOwn(b,k))return {path:path+'.'+k,missing:true};const d=difference(a[k],b[k],path+'.'+k,seen);if(d)return d;}
}
const counts=s=>({people:Object.keys(s.travel.people).length,households:Object.values(s.travel.maps).reduce((n,m)=>n+Object.keys(m.ecs.building||{}).length,0),events:Object.keys(s.travel.events).length,communities:Object.keys(s.travel.maps).length});
console.log(JSON.stringify({kind,left,right,fullStateEqual:equal,leftCounts:counts(a),rightCounts:counts(b),difference:equal?undefined:difference(a,b)},null,2));
if(!equal)process.exitCode=1;
