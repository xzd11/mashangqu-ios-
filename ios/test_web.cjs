const {chromium}=require('playwright');const path=require('path');const assert=require('assert');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.MSQ_CHROMIUM?{executablePath:process.env.MSQ_CHROMIUM}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process','--disable-software-rasterizer']});const page=await browser.newPage({viewport:{width:393,height:852},deviceScaleFactor:2});const failures=[];page.on('pageerror',e=>failures.push(e.message));
 await page.addInitScript(()=>{
  window.webkit={messageHandlers:{bridge:{postMessage:m=>{
   let value={};if(m.op==='load')value={credentials:{},cache:{}};if(m.op==='save')value=true;
   if(m.op==='md5')value='test-md5';
   setTimeout(()=>window.nativeReply({id:m.id,value,error:null}),1);
  }}}};
 });
 await page.goto('file://'+path.join(__dirname,'web/index.html'));await page.waitForTimeout(100);
 assert.equal(await page.locator('.card').count(),5);
 assert.equal(await page.locator('[data-login="TAOBAO"]').count(),1);
 await page.locator('[data-login="TAOBAO"]').click();await page.locator('#import-mode').click();await page.locator('#credential').fill('bad');await page.locator('#save-import').click();await page.waitForTimeout(50);assert((await page.locator('#import-error').textContent()).includes('cookie2'));
 await page.locator('#close-modal').click();await page.locator('[data-tab="express"]').click();assert((await page.locator('#main').textContent()).includes('请先登录'));
 await page.locator('[data-tab="mine"]').click();await page.locator('#auto').check();await page.waitForTimeout(30);
 await page.locator('[data-login="RYLL"]').click();await page.locator('#sms-mode').click();await page.waitForTimeout(50);
 assert((await page.locator('#ry-error').textContent()).length>0);await page.locator('#close-modal').click();
 const tests=await page.evaluate(()=>{
  const merged=mergeItems([item('TAOBAO','123','a',''),item('PDD','123','b','12-3')]);
  const cookies=cookieMap('pt_key=a=b; pin=c');
  return {count:merged.length,code:merged[0].pickupCode,source:merged[0].codeSource,cookie:cookies.pt_key,masked:item('TAOBAO','x','a','***').pickupCode,overflow:document.documentElement.scrollWidth>innerWidth};
 });
 assert.deepEqual(tests,{count:1,code:'12-3',source:'PDD',cookie:'a=b',masked:'',overflow:false});
 // Verify upstream fingerprint module executes under a WebKit-like DOM without network.
 const anti=await page.evaluate(async()=>{try{return {value:await Promise.race([PddAnti(String(Date.now())),new Promise((_,r)=>setTimeout(()=>r(Error('timeout')),6000))])};}catch(e){return {error:e.message};}});
 console.log(JSON.stringify({ui:'passed',core:'passed',jsErrors:failures,pddAnti:anti.error||('generated '+anti.value.length+' characters')}));
 assert.equal(failures.length,0);
 await page.locator('[data-tab="identity"]').click();await page.screenshot({path:path.join(__dirname,'build/ui-preview.png'),fullPage:true});
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
