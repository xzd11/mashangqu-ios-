const {chromium}=require('playwright'),path=require('path'),assert=require('assert');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.MSQ_CHROMIUM,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process','--disable-software-rasterizer']});
 const page=await browser.newPage({viewport:{width:393,height:852}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.webkit={messageHandlers:{bridge:{postMessage:m=>setTimeout(()=>window.nativeReply({id:m.id,value:m.op==='load'?{credentials:{},cache:{}}:true,error:null}),1)}}};});
 await page.goto('file://'+path.join(__dirname,'web/index.html'));await page.locator('[data-login="PDD"]').click();assert.equal(await page.locator('#pdd-qr-mode').count(),1);assert.equal(await page.locator('#web-login').count(),0);
 await page.evaluate(()=>{
  window.calls=[];window.genCount=0;window.checkMode='waiting';window.authMode='ok';window.shareCount=0;
  native=async(op,a)=>{
   if(op==='anti')return 'test-anti';if(op==='save')return true;
   if(op==='code')return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2XcAAAAASUVORK5CYII=';
   if(op==='shareCode'){window.shareCount++;return true;}
   if(op==='login'){window.verifyURL=a.url;return {PDDAccessToken:'verified-token',pdd_user_id:'987'};}
   if(op==='http'){
    if(a.url.includes('_stm'))return {status:200,body:'{"server_time":1770000000000}'};
    const body=JSON.parse(a.body);window.calls.push({url:a.url,body,headers:a.headers});let j={},cookies=[];
    if(a.url.includes('query_qr_code')){window.genCount++;j={secret_key:'secret+&'+window.genCount,data:'https://mobile.yangkeduo.com/mock-qr-'+window.genCount};}
    else if(a.url.includes('check_qr_code')){
     if(window.checkMode==='deferred'){await new Promise(r=>window.resolvePoll=r);j={ticket:'late-ticket'};}
     else if(window.checkMode==='expired')j={error_code:60020};
     else if(window.checkMode==='confirmed')j={ticket:'ticket+&='};else j={error_code:60022};
    }else if(a.url.includes('auth/ticket')){
     if(window.authMode==='verify')j={error_code:54002,verify_auth_token:'verify+&='};
     else if(window.authMode==='bad')j={error_code:40001,error_msg:'会话失效'};
     else cookies=[{name:'PDDAccessToken',value:'qr-token'},{name:'pdd_user_id',value:'123'},{name:'pdd_user_uin',value:'abc'}];
    }
    return {status:200,body:JSON.stringify(j),cookies};
   }
   return true;
  };
  refreshCode=async()=>{};
 });
 await page.locator('#pdd-qr-mode').click();await page.locator('.pdd-login-qr img').waitFor();
 const request=await page.evaluate(()=>calls.find(x=>x.url.includes('query_qr_code')));assert.equal(request.body.pdd_biz_scene,'AUTH_LOGIN');assert.deepEqual(request.body.scene_data,{app_id:512});assert.equal(request.body.anti_content,'test-anti');assert.equal(request.headers['anti-content'],'test-anti');
 await page.locator('#pdd-save-qr').click();assert.equal(await page.evaluate(()=>shareCount),1);
 await page.evaluate(async()=>{clearTimeout(pddQr.timer);await pollPddQr(pddQr);});assert.equal(await page.evaluate(()=>pddQr.phase),'waiting');
 await page.evaluate(async()=>{clearTimeout(pddQr.timer);window.checkMode='expired';await pollPddQr(pddQr);});assert.equal(await page.evaluate(()=>genCount),2);
 await page.evaluate(async()=>{clearTimeout(pddQr.timer);window.checkMode='confirmed';await pollPddQr(pddQr);});assert.equal(await page.evaluate(()=>state.credentials.PDD.token),'qr-token');assert(await page.locator('#modal').isHidden());
 assert.equal(await page.evaluate(()=>calls.some(x=>x.url.includes('login_mobile'))),false);
 // Closing an outstanding poll must never save the returned ticket/token.
 await page.evaluate(()=>{startPddQr();});await page.locator('.pdd-login-qr img').waitFor();
 await page.evaluate(()=>{clearTimeout(pddQr.timer);window.checkMode='deferred';window.pollTask=pollPddQr(pddQr);});await page.waitForFunction(()=>!!window.resolvePoll);
 await page.locator('#close-modal').click();await page.evaluate(async()=>{window.resolvePoll();await window.pollTask;});assert.equal(await page.evaluate(()=>pddQr),null);
 assert.equal(await page.evaluate(()=>state.credentials.PDD.token),'qr-token');
 // Secondary verification uses the original QR session, with encoded values.
 await page.evaluate(()=>{window.checkMode='confirmed';window.authMode='verify';startPddQr();});await page.locator('.pdd-login-qr img').waitFor();
 await page.evaluate(async()=>{clearTimeout(pddQr.timer);await pollPddQr(pddQr);});await page.locator('#pdd-verify').waitFor();assert.equal(await page.locator('.pdd-login-qr img').count(),0);
 await page.locator('#pdd-verify').click();await page.waitForFunction(()=>state.credentials.PDD.token==='verified-token');
 const url=new URL(await page.evaluate(()=>window.verifyURL));assert.equal(url.pathname,'/psnl_verification.html');assert.equal(url.searchParams.get('ticket'),'ticket+&=');assert.equal(url.searchParams.get('VerifyAuthToken'),'verify+&=');assert.equal(url.searchParams.get('from'),'qr_code_login');
 // Unexpected errors are surfaced; no endless poll or phone-login fallback.
 await page.evaluate(()=>{window.checkMode='confirmed';window.authMode='bad';startPddQr();});await page.locator('.pdd-login-qr img').waitFor();await page.evaluate(async()=>{clearTimeout(pddQr.timer);await pollPddQr(pddQr);});assert((await page.locator('#modal .error').textContent()).includes('PDD-40001'));assert.equal(await page.evaluate(()=>pddQr.phase),'error');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);await page.locator('#close-modal').click();await browser.close();console.log('PDD扫码: 生成、参数、轮询、过期刷新、保存分享、凭据、取消隔离、官方验证、错误处理通过');
})().catch(e=>{console.error(e);process.exit(1)});
