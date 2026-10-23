const {chromium}=require('playwright'),path=require('path'),assert=require('assert');
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.MSQ_CHROMIUM?{executablePath:process.env.MSQ_CHROMIUM}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote','--single-process','--disable-software-rasterizer']});const page=await browser.newPage({viewport:{width:393,height:852}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{window.webkit={messageHandlers:{bridge:{postMessage:m=>{const value=m.op==='load'?{credentials:{TAOBAO:{token:'test'}},cache:{}}:true;setTimeout(()=>window.nativeReply({id:m.id,value,error:null}),1);}}}};});await page.goto('file://'+path.join(__dirname,'web/index.html'));await page.waitForTimeout(100);await page.locator('[data-tab="express"]').click();assert.equal(await page.locator('#pickup-query-form').count(),1);
 await page.locator('#pickup-waybill').fill('bad');await page.locator('#pickup-query-submit').click();assert((await page.locator('.lookup-card .error').textContent()).includes('快递运单号'));
 await page.evaluate(()=>{mtop=async()=>({data:{data:{stationPackageAssembleList:[{stationMessageDTO:{stationName:'测试菜鸟站'},groupList:[{certainPickupWaybillList:[{waybillNo:'YT1234567890',pickupCode:'22-5-7603',status:'3'}]}]}]}}});});await page.locator('#pickup-waybill').fill(' yt1234567890 ');await page.locator('#pickup-query-submit').click();await page.locator('#pickup-query-result .pickup').waitFor();assert.equal(await page.locator('#pickup-query-result .pickup').textContent(),'22-5-7603');assert((await page.locator('#pickup-query-result').textContent()).includes('来源：菜鸟'));assert.equal(await page.locator('#pickup-waybill').inputValue(),'YT1234567890');
 await page.evaluate(()=>{
  state.credentials.TAOBAO.token='cookie2=test; unb=user-A';
  state.cache={PDD:{items:[item('PDD','YT1234567890','驿站','')]},SF:{items:[item('SF','学校|88-1|1','校园','88-1')]}};
  lookup.result=null;lookup.input='';render();
 });
 assert.equal(await page.locator('[data-cainiao-no]').count(),2);
 assert(await page.locator('[data-cainiao-no=""]').isDisabled());
 await page.locator('[data-cainiao-no="YT1234567890"]').click();
 await page.waitForFunction(()=>document.querySelector('.package .pickup')?.textContent==='22-5-7603');
 assert((await page.locator('.package').first().textContent()).includes('取件码来源：淘宝 · 菜鸟'));
 assert.equal(await page.locator('#pickup-waybill').inputValue(),'YT1234567890');
 await page.evaluate(()=>{state.credentials.TAOBAO={token:'cookie2=other; unb=user-B'};render();});
 assert.equal(await page.locator('.package .pickup').first().textContent(),'暂无取件码');
 await page.evaluate(()=>{delete state.credentials.TAOBAO;render();});assert.equal(await page.locator('#pickup-query-result').count(),0);
 await page.locator('[data-cainiao-no="YT1234567890"]').click();assert(!(await page.locator('#modal').isHidden()));await page.locator('#close-modal').click();assert(await page.locator('#pickup-query-submit').isDisabled());assert((await page.locator('.lookup-card').textContent()).includes('先登录淘宝 / 菜鸟'));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(errors.length,0);await page.screenshot({path:path.join(__dirname,'build/pickup-preview.png'),fullPage:true});console.log('Pickup list button and UI passed: input, validation, lookup result, login guard, account isolation, mobile width');await browser.close();})().catch(e=>{console.error(e);process.exit(1)});
