const {chromium}=require('playwright'),crypto=require('crypto'),path=require('path'),assert=require('assert'),fs=require('fs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.MSQ_CHROMIUM,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process','--disable-software-rasterizer']});
 const page=await browser.newPage({viewport:{width:393,height:852}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://*.pddpic.com/**',route=>route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2XcAAAAASUVORK5CYII=','base64')}));
 let ctx=null,serial=0,fixture={type:1,smsFail:true,quizWrong:false,questions:0,orders:[],calls:[],finals:0,delayVerify:false},release=null;
 const encrypt=(data)=>{const cipher=crypto.createCipheriv('aes-128-cbc',ctx.key,ctx.iv);return Buffer.concat([cipher.update(JSON.stringify(data)),cipher.final()]).toString('base64');};
 const decrypt=(content)=>{const cipher=crypto.createDecipheriv('aes-128-cbc',ctx.key,ctx.iv);return JSON.parse(Buffer.concat([cipher.update(Buffer.from(content,'base64')),cipher.final()]).toString());};
 await page.exposeFunction('verifyFixture',async(op,a={})=>{
  if(op==='load')return {credentials:{},cache:{}};
  if(op==='save'||op==='shareCode')return true;
  if(op==='anti')return 'verification-anti';
  if(op==='code')return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2XcAAAAASUVORK5CYII=';
  if(op==='login')return {PDDAccessToken:'official-token'};
  if(op==='pddCrypto'){
   if(a.action==='new'){ctx={id:String(++serial),key:crypto.randomBytes(16),iv:crypto.randomBytes(16)};return {session:ctx.id,a:'rsa-key-fixture',v:'rsa-iv-fixture'};}
   if(a.action==='clear'){if(ctx?.id===a.session)ctx=null;return true;}
   assert.equal(a.session,ctx?.id,'native crypto session must match');
   if(a.action==='encrypt')return encrypt(a.data);
   if(a.action==='decrypt')return decrypt(a.content);
   throw Error('unexpected crypto action');
  }
  if(op==='http'){
   if(a.url.includes('_stm'))return {status:200,body:'{"server_time":1770000000000}'};
   const body=JSON.parse(a.body),api=new URL(a.url).pathname.split('/proxy/api/')[1];fixture.calls.push(api);let j={},cookies=[];
   if(api==='api/cupid/query_qr_code')j={secret_key:'secret',data:'pdd-qr-fixture'};
   else if(api==='api/cupid/login/check_qr_code')j={ticket:'ticket'};
   else if(api==='api/sigerus/auth/ticket'){
    if(body.status===1){assert.equal(body.verify_auth_token,'vat');fixture.finals++;cookies=[{name:'PDDAccessToken',value:'native-verified'}];}
    else j={error_code:54002,verify_auth_token:'vat'};
   }else if(api==='api/phantom/challenge_verify'){
    assert.equal(body.anti_content,a.headers['anti-content']);assert.equal(body.verify_auth_token,'vat');assert.equal(body.salt,'session-salt');assert.equal(body.useNativeAntiToken,true);
    fixture.orders.push(body.question_order_number);assert.equal(body.user_options.length,2);
    j={code:fixture.quizWrong?3002:0};fixture.quizWrong=false;
   }else {
    assert.equal(body.e,true);assert.equal(body.verify_auth_token,'vat');assert(!('anti_content' in body),'encrypted envelope excludes top-level anti_content');
    const data=decrypt(body.content);assert.equal(data.anti_content,a.headers['anti-content']);
    if(api==='api/phantom/vc_pre_ck'){
     assert.equal(body.a,'rsa-key-fixture');assert.equal(body.v,'rsa-iv-fixture');assert.equal(data.sdk_type,1);assert(data.client_time>0);
     j={e:true,content:encrypt({salt:'session-salt',success:true})};
    }else {
     assert.equal(data.salt,'session-salt');assert.equal(data.verify_auth_token,'vat');
     if(api==='api/phantom/obtain_captcha'){assert.equal(data.wp,false);j={e:true,content:encrypt({code:0,type:fixture.type})};}
     if(api==='api/phantom/user_verify'){
      assert.equal(data.verify_code,'123456');assert.equal(data.captcha_collect,'');
      if(fixture.delayVerify)await new Promise(r=>release=r);
      // A cancelled session cannot decrypt the returned response, and must not save credentials.
      j=ctx?{e:true,content:encrypt({code:fixture.smsFail?1001:0})}:{code:0};
     }
     if(api==='api/phantom/challenge_captcha'){
      fixture.questions++;j={code:0,question_id:100+fixture.questions,question_desc:'选出两个正确选项 <script>bad()</script>',question_style:'image',correct_answer_cnt:2,options:{a:'https://img.pddpic.com/a.png',b:'https://img.pddpic.com/b.png',c:'https://img.pddpic.com/c.png'}};
     }
    }
   }
   return {status:200,body:JSON.stringify(j),cookies};
  }
  return true;
 });
 await page.addInitScript(()=>{window.webkit={messageHandlers:{bridge:{postMessage:m=>window.verifyFixture(m.op,m.args).then(value=>window.nativeReply({id:m.id,value,error:null}),e=>window.nativeReply({id:m.id,value:null,error:e.message}))}}};});
 await page.goto('file://'+path.join(__dirname,'web/index.html'));await page.waitForFunction(()=>Object.keys(state.credentials).length===0);await page.evaluate(()=>{refreshCode=async()=>{};});
 async function start(){await page.evaluate(()=>startPddQr());await page.locator('.pdd-login-qr img').waitFor();await page.evaluate(async()=>{clearTimeout(pddQr.timer);await pollPddQr(pddQr);});}
 await start();await page.locator('#pdd-sms').waitFor();assert.equal(await page.locator('#pdd-verify').count(),0);
 await page.locator('#pdd-sms').fill('123456');await page.locator('#pdd-verification-submit').click();await page.waitForFunction(()=>!pddQr.verifyBusy);assert((await page.locator('#modal .error').textContent()).includes('验证码未通过'));assert.equal(fixture.finals,0);
 fixture.smsFail=false;await page.locator('#pdd-sms').fill('123456');await page.locator('#pdd-verification-submit').click();await page.waitForFunction(()=>state.credentials.PDD?.token==='native-verified');assert.equal(fixture.finals,1);await page.waitForFunction(()=>pddQr===null);assert.equal(ctx,null);
 // Manual multi-select image questions, wrong answer => next question and incremented order.
 fixture.type=101;fixture.quizWrong=true;await start();await page.locator('#pdd-quiz-form').waitFor();assert.equal(await page.locator('.verify-option img').count(),3);await page.screenshot({path:path.join(__dirname,'build/pdd-verification-preview.png')});assert(await page.locator('#pdd-verification-submit').isDisabled());assert.equal(await page.locator('.verify-question script').count(),0);
 await page.locator('[name="pdd-answer"][value="a"]').check();assert(await page.locator('#pdd-verification-submit').isDisabled());await page.locator('[name="pdd-answer"][value="b"]').check();await page.locator('#pdd-verification-submit').click();await page.waitForFunction(()=>pddQr?.quizOrder===2&&!pddQr.verifyBusy);assert.equal(await page.locator('[name="pdd-answer"]:checked').count(),0);assert((await page.locator('#modal .error').textContent()).includes('答案未通过'));
 await page.locator('[name="pdd-answer"][value="a"]').check();await page.locator('[name="pdd-answer"][value="c"]').check();await page.locator('#pdd-verification-submit').click();await page.waitForFunction(()=>pddQr===null);assert.deepEqual(fixture.orders,[1,2]);assert.equal(fixture.finals,2);
 // Cancellation during a verification request must ignore its late success.
 fixture.type=1;fixture.delayVerify=true;await start();await page.locator('#pdd-sms').fill('123456');await page.locator('#pdd-verification-submit').click();
 while(!release)await new Promise(r=>setTimeout(r,5));await page.locator('#close-modal').click();release();await page.waitForFunction(()=>pddQr===null);assert.equal(fixture.finals,2);assert.equal(ctx,null);
 // Unsupported type => original official page, without attempting to solve it.
 fixture.delayVerify=false;fixture.type=22;await start();await page.locator('#pdd-verify').waitFor();assert.equal(await page.locator('#pdd-sms').count(),0);assert.equal(ctx,null);await page.locator('#close-modal').click();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 // Embedded PKCS#1 public key must match the upstream modulus exactly.
 const native=fs.readFileSync(path.join(__dirname,'native/main.m'),'utf8'),der=native.match(/initWithBase64EncodedString:@"([A-Za-z0-9+/=]+)" options:0/)[1];
 const jwk=crypto.createPublicKey({key:Buffer.from(der,'base64'),format:'der',type:'pkcs1'}).export({format:'jwk'});
 const upstream=fs.readFileSync(path.join(__dirname,'reference/PddQrClient.kt'),'utf8').split('const val RSA_N_HEX =')[1].split('/**')[0];const expected=[...upstream.matchAll(/"([0-9A-F]+)"/g)].map(x=>x[1]).join('').replace(/^00/,'').toLowerCase();assert.equal(Buffer.from(jwk.n,'base64url').toString('hex'),expected);
 await browser.close();console.log('PDD验证: AES信封、密钥交换参数、短信错误/成功、图片多选、重试顺序、取消隔离、官方回退、RSA公钥一致性通过');
})().catch(e=>{console.error(e);process.exit(1)});
