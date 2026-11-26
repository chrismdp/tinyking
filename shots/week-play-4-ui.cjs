const { browserClickPoint } = require('../scripts/click-selection');
module.exports = function makeUI(page) {
  const close = async () => {
    for (const selector of ['.people-sheet .sheet-close', '#journal [aria-label="Close journal"]', '.popper .close']) {
      const button = page.locator(selector).first();
      if (await button.isVisible()) await button.click({force:true});
    }
  };
  const pan = async id => {
    for (let attempt = 0; attempt < 14; attempt++) {
      const offset = await page.evaluate(id => {
        const s=window.tinyking,p=s.ecs.spatial[id],pose=s.renderer.metrics.pose;
        const dx=p.x-pose.x,dz=p.y-pose.z;
        const right=dx*Math.cos(pose.yaw)-dz*Math.sin(pose.yaw);
        const forward=-dx*Math.sin(pose.yaw)-dz*Math.cos(pose.yaw);
        const canvas=document.querySelector('#world canvas');
        const scale=2*pose.distance*Math.tan(s.renderer.camera.fov*Math.PI/360)/canvas.clientHeight;
        return { dx:-right/scale,dy:forward*Math.sin(pose.pitch)/scale,world:Math.hypot(dx,dz) };
      }, id);
      if (offset.world < 35) break;
      const v=page.viewportSize(),x=v.width>500?v.width-220:v.width/2,y=v.height>600?450:v.height/2;
      const factor=Math.min(1,240/Math.max(Math.abs(offset.dx),Math.abs(offset.dy)));
      await page.mouse.move(x,y); await page.mouse.down();
      await page.mouse.move(x+offset.dx*factor,y+offset.dy*factor,{steps:1}); await page.mouse.up();
      await page.waitForTimeout(50);
    }
  };
  const select = async id => {
    await close();
    let at=await page.evaluate(browserClickPoint,id);
    if (!at) {
      await pan(id);
      at=await page.evaluate(browserClickPoint,id);
    }
    if (!at) throw Error('No visible click target for '+id);
    await page.mouse.click(at.x,at.y);
    await page.waitForTimeout(150);
    return page.evaluate(()=>({selected:window.tinyking.ui.selected,text:document.body.innerText}));
  };
  const order = async (id,label) => {
    await select(id);
    await page.getByRole('button',{name:label,exact:true}).click({force:true});
  };
  const chat = async id => {
    await order(id,'Chat');
    await page.waitForFunction(()=>window.tinyking.chat?.active || window.tinyking.ui.talkResult,null,{timeout:45000}).catch(()=>{});
    return page.evaluate(()=>({day:window.tinyking.days,chat:window.tinyking.chat?.active,result:window.tinyking.ui.talkResult,text:document.body.innerText}));
  };
  return { close, pan, select, order, chat };
};
