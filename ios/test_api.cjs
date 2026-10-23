const {chromium}=require('playwright');const path=require('path'),assert=require('assert');
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.MSQ_CHROMIUM?{executablePath:process.env.MSQ_CHROMIUM}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process','--disable-software-rasterizer']});const page=await browser.newPage();await page.addInitScript(()=>{window.webkit={messageHandlers:{bridge:{postMessage:m=>setTimeout(()=>window.nativeReply({id:m.id,value:{credentials:{},cache:{}},error:null}),1)}}};});await page.goto('file://'+path.join(__dirname,'web/index.html'));await page.waitForTimeout(50);
const results=await page.evaluate(async()=>{
 const old=native;let tb=0,hashes=[],calls=[];
 native=async(op,a)=>{
 if(op==='md5'){hashes.push(a.text);return 'deadbeef';}if(op==='anti')return 'a'.repeat(398);if(op!=='http')return true;
 calls.push(a);let json={},cookies=[];
 if(a.url.includes('h5api.m.taobao.com')){if(!tb++){json={ret:['FAIL_SYS_TOKEN_EMPTY']};cookies=[{name:'_m_h5_tk',value:'newtoken_1'}];}else if(a.url.includes('getidentitymessage'))json={ret:['SUCCESS::调用成功'],data:{data:{identityCode:'XNST-test'}}};else json={ret:['SUCCESS'],data:{data:{stationPackageAssembleList:[{stationMessageDTO:{stationName:'菜鸟站'},groupList:[{certainPickupWaybillList:[{waybillNo:'123',pickupCode:'1-2-3'}]}]}]}}};}
 else if(a.url.includes('lop-proxy'))json={data:{identityCode:'JDM-test'}};
 else if(a.url.includes('mec.yto'))json={status:0,data:'data:image/png;base64,dGVzdA=='};
 else if(a.url.includes('sf-express'))json={success:true,obj:[{storeName:'学校驿站',pickUpCode:'88-1',waitingPickType:'1'}]};
 else if(a.url.includes('generate_identification_code'))json={result:{identification_code:'wx-test',expire_mills:Date.now()+500000}};
 else throw Error('unexpected request '+a.url);
 return {status:200,body:JSON.stringify(json),cookies,headers:{}};
 };
 const cred={token:'cookie2=a; unb=b',extra:{}};
 const taobao=await identity('TAOBAO',cred),jd=await identity('JD',{token:'pt_key=k; pin=p'}),ry=await identity('RYLL',{token:'jwt'}),sfcode=await identity('SF',{token:'',extra:{staticSeg:'1234567890'}}),pddcode=await identity('PDD',{token:'test'});
 const packages=await express('TAOBAO',cred),campus=await express('SF',{token:'sessionId=test'});
 let jdListError=false;try{await express('JD',{});}catch{jdListError=true;}
 let newlineRejected=false;try{await request('https://lop-proxy.jd.com',{cookie:'test\r\nX: bad'});}catch{newlineRejected=true;}
 native=old;
 return {taobao:taobao.content,taobaoType:taobao.type,tbCookie:cred.token.includes('newtoken_1'),tkRetry:hashes.some(x=>x.startsWith('newtoken&')),jd:jd.type,ry:ry.type,sf:sfcode.content.endsWith('ACS1234567890'),pdd:pddcode.content,packages:packages.length,pickup:packages[0].pickupCode,campus:campus[0].station,jdListError,newlineRejected};
});assert.deepEqual(results,{taobao:'XNST-test',taobaoType:'BARCODE',tbCookie:true,tkRetry:true,jd:'BARCODE',ry:'IMAGE_URL',sf:true,pdd:'wx-test',packages:1,pickup:'1-2-3',campus:'学校驿站（丰巢柜）',jdListError:true,newlineRejected:true});console.log(JSON.stringify({adapterFixtures:'passed',results}));await browser.close();})().catch(e=>{console.error(e);process.exit(1)});
