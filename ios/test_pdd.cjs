const {chromium}=require('playwright');const path=require('path'),assert=require('assert');
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.MSQ_CHROMIUM?{executablePath:process.env.MSQ_CHROMIUM}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process','--disable-software-rasterizer']});const page=await browser.newPage();await page.addInitScript(()=>{window.webkit={messageHandlers:{bridge:{postMessage:m=>setTimeout(()=>window.nativeReply({id:m.id,value:{credentials:{},cache:{}},error:null}),1)}}};});await page.goto('file://'+path.join(__dirname,'web/index.html'));await page.waitForTimeout(50);
const results=await page.evaluate(async()=>{
 const now=1760000000000;
 const expiries=[pddExpiry(587000,now),pddExpiry(now+587000,now),pddExpiry(1760000587,now),pddExpiry(null,now)];
 const original=native;let mode='timeout',antiCalls=0;
 native=async(op,a)=>{
  if(op==='login')return {accesstoken:'alias-token',pdd_user_id:'123'};
  if(op==='anti'){antiCalls++;if(mode==='timeout')throw Error('PDD-ANTI-TIMEOUT');return 'a'.repeat(398);}
  if(op==='http'){
   if(a.url.includes('_stm'))return {status:200,body:JSON.stringify({server_time:now}),headers:{},cookies:[]};
   const json=mode==='reject'?{error_code:70005,error_msg:'ANTI_CONTENT_FAILED'}:{result:{identification_code:'wx-test',expire_mills:587000}};
   return {status:200,body:JSON.stringify(json),headers:{},cookies:[]};
  }
  return true;
 };
 const cred=await webLogin('PDD');let timeoutError='',rejectError='';
 try{await identity('PDD',cred);}catch(e){timeoutError=e.message;}
 mode='ok';const recovered=await identity('PDD',cred);
 mode='reject';try{await identity('PDD',cred);}catch(e){rejectError=e.message;}
 native=original;
 return {expiries,token:cred.token,user:cred.extra.pdd_user_id,timeout:timeoutError.includes('PDD-ANTI-TIMEOUT'),recovered:recovered.content,remaining:recovered.expires-Date.now(),rejection:rejectError.includes('PDD-70005'),antiCalls};
});assert.deepEqual(results.expiries,[1760000587000,1760000587000,1760000587000,1760000180000]);assert.equal(results.token,'alias-token');assert.equal(results.user,'123');assert.equal(results.timeout,true);assert.equal(results.recovered,'wx-test');assert(results.remaining>580000&&results.remaining<=587000);assert.equal(results.rejection,true);assert.equal(results.antiCalls,3);console.log(JSON.stringify({pddRegression:'passed',results}));await browser.close();})().catch(e=>{console.error(e);process.exit(1)});
