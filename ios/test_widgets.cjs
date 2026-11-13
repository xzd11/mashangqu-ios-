const {chromium}=require('playwright'),path=require('path'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.MSQ_CHROMIUM,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:393,height:852}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.calls=[];window.saved={credentials:{PDD:{token:'PRIVATE-TOKEN',capturedAt:1},TAOBAO:{token:'cookie2=PRIVATE-COOKIE; unb=A'}},cache:{PDD:{at:Date.now(),items:[{platform:'PDD',no:'YT1234567890',station:'校园驿站',pickupCode:'12-3456',status:'WAIT_PICKUP'}]}},updateCheckedAt:Date.now()};
  window.activity=false;window.webkit={messageHandlers:{bridge:{postMessage:m=>{
   window.calls.push(m);
   if(m.op==='save'&&window.failSave){setTimeout(()=>nativeReply({id:m.id,error:'save failed'}),0);return;}
   if(m.op==='save')window.saved=structuredClone(m.args.data);
   if(m.op==='widgets'&&m.args.action==='start'&&window.denyLive){setTimeout(()=>nativeReply({id:m.id,error:'系统已关闭实时活动'}),0);return;}
   if(m.op==='widgets'&&m.args.action==='start')window.activity=true;
   if(m.op==='widgets'&&(m.args.action==='end'||m.args.action==='sync'&&!m.args.active))window.activity=false;
   const value=m.op==='load'?window.saved:m.op==='widgets'?{supported:true,widgetReady:true,liveSupported:true,liveEnabled:!window.denyLive,active:window.activity}:true;
   setTimeout(()=>nativeReply({id:m.id,value}),0);
  }}}};
 });
 await page.goto('file://'+path.join(__dirname,'web/index.html'));await page.waitForFunction(()=>widgetStatus?.supported);
 let sync=await page.evaluate(()=>calls.filter(x=>x.op==='widgets'&&x.args.action==='sync').at(-1).args);
 assert.equal(sync.count,1);assert.equal(sync.rows[0].code,'');for(const s of ['PRIVATE-TOKEN','PRIVATE-COOKIE','YT1234567890','12-3456'])assert(!JSON.stringify(sync).includes(s),s);
 await page.locator('[data-tab="express"]').click();await page.locator('[data-start-pickup]').click();await page.waitForFunction(()=>window.activity&&widgetStatus.active);
 const start=await page.evaluate(()=>calls.find(x=>x.op==='widgets'&&x.args.action==='start').args);assert.equal(start.active.code,'12-3456');assert.equal(start.active.station,'校园驿站');assert(!JSON.stringify(start).includes('PRIVATE-'));
 await page.locator('[data-picked-no="YT1234567890"]').click();await page.waitForFunction(()=>!completing&&!window.activity);assert.equal(await page.evaluate(()=>widgetSelection),null);
 await page.locator('#toast .toast-action').click();await page.waitForFunction(()=>!completing);assert.equal(await page.evaluate(()=>window.activity),false);
 await page.locator('[data-tab="mine"]').click();assert.equal(await page.locator('#widget-show-codes').isChecked(),false);await page.locator('#widget-show-codes').check();await page.waitForFunction(()=>window.saved.widgetShowCodes===true);
 // Failed persistence cannot publish a preference that was not saved.
 await page.evaluate(()=>{window.failSave=true;window.calls=[];});await page.locator('#widget-show-codes').uncheck();await page.waitForFunction(()=>state.widgetShowCodes===true);assert.equal(await page.evaluate(()=>calls.filter(x=>x.op==='widgets').length),0);await page.evaluate(()=>window.failSave=false);
 // A removed account cannot leak its cached rows to an extension.
 assert.equal(await page.evaluate(()=>{delete state.credentials.PDD;return widgetPayload().count;}),0);
 await page.evaluate(()=>{state.credentials.PDD={token:'PRIVATE-TOKEN',capturedAt:1};state.cache.PDD.items[0].pickupCode='66-7777';state.cache.PDD.at=Date.now();window.denyLive=true;});
 await page.locator('[data-tab="express"]').click();await page.locator('[data-start-pickup]').click();await page.waitForFunction(()=>widgetError.includes('系统已关闭'));assert.equal(await page.evaluate(()=>widgetSelection),null);assert.equal(await page.evaluate(()=>window.activity),false);
 // Consent enables only the minimal shared fields and current account's supplement.
 const payload=await page.evaluate(()=>{state.widgetShowCodes=true;state.cache.PDD.items[0].cainiaoPickup={code:'FOREIGN-CODE',accountKey:'B'};return widgetPayload();});assert.equal(payload.rows[0].code,'66-7777');assert(!JSON.stringify(payload).includes('FOREIGN-CODE'));
 await page.evaluate(()=>{state.cache.PDD.items[0].cainiaoPickup.accountKey='A';});assert.equal(await page.evaluate(()=>widgetPayload().rows[0].code),'FOREIGN-CODE');
 await page.evaluate(()=>{refreshCode=async()=>{};});await page.evaluate(()=>saveCredential('PDD',{token:'NEW-TOKEN',capturedAt:2}));assert.equal(await page.evaluate(()=>widgetPayload().count),0);
 await page.evaluate(()=>window.msqOpenExpress());assert.equal(await page.evaluate(()=>tab),'express');assert.equal(await page.locator('#tabs [data-tab="express"]').getAttribute('class'),'active');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 await page.locator('[data-tab="mine"]').click();await page.screenshot({path:path.join(__dirname,'build/widgets-settings.png'),fullPage:true});await browser.close();
 console.log('Widgets passed: minimal snapshot, privacy opt-in, start/end, completion, undo, failed writes, account isolation, denied permission, deep link and mobile width');
})().catch(e=>{console.error(e);process.exit(1)});
