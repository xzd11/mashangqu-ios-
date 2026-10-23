const {chromium}=require('playwright'),path=require('path'),assert=require('assert');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.MSQ_CHROMIUM,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process','--disable-software-rasterizer']});
 const page=await browser.newPage({viewport:{width:393,height:852}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.saved={credentials:{TAOBAO:{token:'cookie2=test; unb=A'},PDD:{token:'pdd-A',capturedAt:1},SF:{token:'sf-A',capturedAt:2}},cache:{TAOBAO:{items:[{platform:'TAOBAO',no:'YT1234567890',station:'菜鸟站',pickupCode:'11-22',status:'WAIT_PICKUP'}]},PDD:{items:[{platform:'PDD',no:'YT1234567890',station:'菜鸟站',pickupCode:'33-44',status:'WAIT_PICKUP',cainiaoPickup:{code:'11-22',accountKey:'A'}}]},SF:{items:[{platform:'SF',no:'校园|88-1|1',station:'校园',pickupCode:'88-1',status:'WAIT_PICKUP'}]}}};
  window.webkit={messageHandlers:{bridge:{postMessage:m=>{
   const error=m.op==='save'&&window.failSave?'磁盘写入失败':null;
   if(m.op==='save'&&!error)window.saved=JSON.parse(JSON.stringify(m.args.data));
   const value=m.op==='load'?window.saved:true;
   setTimeout(()=>window.nativeReply({id:m.id,value,error}),1);
  }}}};
 });
 await page.goto('file://'+path.join(__dirname,'web/index.html'));await page.locator('[data-tab="express"]').click();
 await page.locator('[data-picked-no="YT1234567890"]').click();await page.waitForFunction(()=>!completing);
 assert.equal(await page.locator('.package').count(),1);
 const saved=await page.evaluate(()=>JSON.stringify(window.saved));assert(!saved.includes('11-22'));assert(!saved.includes('33-44'));
 // Stale server list returns the parcel again: neither display nor persistence may restore its codes.
 await page.evaluate(async()=>{express=async(p)=>p==='SF'?[]:[item(p,'YT1234567890','菜鸟站','RESTORED')];await refresh();});
 assert.equal(await page.locator('.package').count(),0);assert(!(await page.evaluate(()=>JSON.stringify(window.saved))).includes('RESTORED'));
 // Restoring saved app state preserves the completion marker.
 await page.evaluate(()=>{state=JSON.parse(JSON.stringify(window.saved));state.cache.PDD={items:[item('PDD','YT1234567890','旧记录','OLD')]};render();});assert.equal(await page.locator('.package').count(),0);
 // A different account may legitimately have the same waybill.
 await page.evaluate(()=>{state.credentials.PDD={token:'pdd-B',capturedAt:3};render();});assert.equal(await page.locator('.package').count(),1);
 // Failed persistence restores the card and leaves a retry available.
 await page.evaluate(()=>window.failSave=true);await page.locator('[data-picked-no="YT1234567890"]').click();await page.waitForFunction(()=>!completing);assert.equal(await page.locator('.package').count(),1);assert((await page.locator('#toast').textContent()).includes('保存失败'));
 await page.evaluate(()=>window.failSave=false);
 // Standalone lookup also has a completion button, and a late lookup cannot resurrect a deleted code.
 await page.evaluate(()=>{lookup.input='SF1234567890';queryCainiaoPickup=async(c,no)=>({status:'found',no,code:'55-66',station:'菜鸟站',checkedAt:Date.now()});});await page.locator('#pickup-waybill').fill('SF1234567890');await page.locator('#pickup-query-submit').click();await page.locator('#pickup-query-result [data-picked-no]').waitFor();
 await page.locator('#pickup-query-result [data-picked-no]').click();await page.waitForFunction(()=>!completing);assert.equal(await page.locator('#pickup-query-result').count(),0);
 await page.locator('#pickup-query-submit').click();await page.waitForFunction(()=>!lookup.busy);assert.equal(await page.locator('#pickup-query-result .pickup').count(),0);assert((await page.locator('#pickup-query-result').textContent()).includes('已标记为已取'));
 // SF campus records without a real waybill can still be removed.
 await page.evaluate(()=>{state.cache.SF={items:[item('SF','校园|88-1|1','校园','88-1')]};render();});await page.locator('[data-picked-no="校园|88-1|1"]').click();await page.waitForFunction(()=>!completing);assert.equal(await page.locator('[data-picked-no="校园|88-1|1"]').count(),0);
 assert.deepEqual(errors,[]);await browser.close();console.log('已取: 删除、跨平台合并、刷新防恢复、持久化、账户隔离、保存失败回滚、独立查码、校园记录通过');
})().catch(e=>{console.error(e);process.exit(1)});
