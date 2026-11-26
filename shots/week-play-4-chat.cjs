module.exports = (page, receipt, read, save) => {
  const settle = async () => {
    await page.waitForTimeout(350);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  };
  const inspect = async () => {
    const r = await read();
    return { day:r.day, npc:r.chat?.npcId, focus:r.chat?.focus, expectation:r.chat?.expectation, endReason:r.chat?.endReason,
      lines:r.chat?.transcript.map(l=>({speaker:l.speaker,id:l.id,text:l.text})),
      choices:await page.locator('.chat-choice-text').allTextContents(),text:r.text };
  };
  const click = async (selector, text) => {
    const locate = () => page.evaluate(({selector,text}) => {
      const all=[...document.querySelectorAll(selector)],b=text==null?all[0]:all.find(b=>b.textContent.trim()===text);
      if(!b)return null;
      const r=b.getBoundingClientRect(),p=document.querySelector('.chat-panel')?.getBoundingClientRect();
      return {x:r.x+r.width/2,y:r.y+r.height/2,text:b.textContent.trim(),disabled:b.disabled,
        sx:p?p.left+8:100,sy:p?p.top+p.height/2:350};
    },{selector,text});
    await settle();
    let at=await locate();
    if(!at)throw Error('No visible control: '+(text||selector));
    for(let n=0;(at.y<40||at.y>page.viewportSize().height-30)&&n<8;n++) {
      await page.mouse.move(at.sx,at.sy);
      await page.mouse.wheel(0,at.y<40?-450:450);
      await settle();at=await locate();
    }
    if(at.disabled)throw Error('Disabled control: '+at.text);
    if(at.y<0||at.y>page.viewportSize().height)throw Error('Control remains outside viewport: '+at.text);
    await page.mouse.click(at.x,at.y);await settle();return at;
  };
  const subject = async name => {
    if(await page.locator('.chat-extras').getAttribute('open')===null)await click('.chat-extras summary');
    await click('.chat-subjects button',name);
    return inspect();
  };
  const say = async text => {
    const before=await read(),count=before.chat?.transcript.length||0;
    if(!before.chat)throw Error('No conversation');
    const at=await click('.chat-choice-text',text);
    await page.waitForFunction(n=>!window.tinyking.chat?.active||window.tinyking.chat.active.transcript.length>n,count,{timeout:30000}).catch(()=>{});
    const after=await read(),lines=after.chat?.transcript.slice(count);
    receipt.spoken.push({day:before.day,npc:before.chat.npcId,chosen:at.text,lines,
      actual:lines?.some(l=>l.speaker==='player'&&l.text===at.text),closed:!after.chat});save();
    if(after.chat) {
      const last=after.chat.transcript.at(-1).text.replaceAll('*','');
      await page.waitForFunction(t=>(document.querySelector('.chat-choices')||document.querySelector('.chat-notice'))&&document.querySelector('.chat-speech')?.textContent.includes(t),last,{timeout:30000}).catch(()=>{});
    }
    return inspect();
  };
  return {inspect,click,subject,say};
};
