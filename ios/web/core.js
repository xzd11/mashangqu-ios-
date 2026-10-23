'use strict';
const pending = new Map(); let serial = 0;
function native(op,args={}) {return new Promise((resolve,reject)=>{
 const id=++serial; const timer=setTimeout(()=>{pending.delete(id);reject(Error('操作超时，请重试'));},(op==='login'||op==='shareCode')?600000:60000);
 pending.set(id,{resolve,reject,timer});
 if(window.webkit?.messageHandlers?.bridge) window.webkit.messageHandlers.bridge.postMessage({id,op,args});
 else {clearTimeout(timer);pending.delete(id);reject(Error('请在 iOS 应用内使用此功能'));}
});}
window.nativeReply=({id,value,error})=>{const p=pending.get(id);if(!p)return;clearTimeout(p.timer);pending.delete(id);error?p.reject(Error(error)):p.resolve(value);};
const Platforms={TAOBAO:{name:'淘宝 · 菜鸟',color:'#f37925'},JD:{name:'京东',color:'#db3545'},PDD:{name:'拼多多',color:'#d84236'},SF:{name:'顺丰',color:'#313b45'},RYLL:{name:'如意邻里 · 圆通',color:'#7056ac'}};
let state={credentials:{},cache:{}}, dirty=Promise.resolve();
function persist(){const data=JSON.parse(JSON.stringify(state));dirty=dirty.catch(()=>{}).then(()=>native('save',{data}));return dirty;}
const md5=text=>native('md5',{text});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const encode=encodeURIComponent;
const query=o=>Object.entries(o).map(([k,v])=>encode(k)+'='+encode(v)).join('&');
function cookieMap(header=''){return Object.fromEntries(header.split(';').map(s=>s.trim()).filter(s=>s.includes('=')).map(s=>[s.slice(0,s.indexOf('=')),s.slice(s.indexOf('=')+1)]));}
function cookieHeader(map){return Object.entries(map).map(([k,v])=>`${k}=${v}`).join('; ');}
function requireString(v,field){if(typeof v!=='string'||!v.trim())throw Error('响应缺少 '+field);return v;}
async function request(url,{method='GET',headers={},body,cookie}={}){
 const h={Accept:'application/json, text/plain, */*',...headers};
 if(cookie)h.Cookie=cookie;
 for(const [key,value] of Object.entries(h)){if(!/^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/.test(key)||typeof value!=='string'||/[\r\n]/.test(value))throw Error('请求头格式无效，请检查导入凭据是否含换行');}
 if(body!==undefined&&typeof body!=='string'){body=JSON.stringify(body);h['Content-Type']??='application/json;charset=UTF-8';}
 const r=await native('http',{url,method,headers:h,...(body===undefined?{}:{body})});
 if(r.status<200||r.status>=300)throw Error(r.status===401?'登录已失效，请重新登录':'服务器返回 HTTP '+r.status);
 let json;try{json=JSON.parse(r.body);}catch{throw Error('平台未返回 JSON，可能需要重新登录或完成安全验证');}
 return {...r,json};
}
function combineCookies(cred,cookies=[]){const map=cookieMap(cred.token);for(const c of cookies)map[c.name]=c.value;cred.token=cookieHeader(map);}
async function mtop(cred,api,data={}){
 const raw=JSON.stringify(data);
 for(let attempt=0;attempt<2;attempt++){
  const token=(cookieMap(cred.token)._m_h5_tk||'').split('_')[0],t=String(Date.now()),appKey='12574478';
  const sign=await md5(`${token}&${t}&${appKey}&${raw}`);
  const url=`https://h5api.m.taobao.com/h5/${api.toLowerCase()}/1.0/?`+query({jsv:'2.6.1',appKey,t,sign,api,v:'1.0',needLogin:'true',type:'originaljson',dataType:'json',data:raw});
  const r=await request(url,{cookie:cred.token,headers:{Referer:'https://pages-fast.m.taobao.com/'}});
  combineCookies(cred,r.cookies);const ret=r.json.ret?.[0]||'';
  if(ret.startsWith('SUCCESS'))return r.json;
  if(attempt===0&&/TOKEN_(EMPTY|EXPIRED|EXOIRED)/.test(ret))continue;
  throw Error(/SESSION_EXPIRED|TOKEN_/.test(ret)?'淘宝登录已失效，请重新登录':ret||'淘宝接口返回异常');
 }
}
const SFBASE='https://mcs-mimp-web.sf-express.com';
async function sf(cred,path,body={}){
 const timestamp=String(Date.now());
 const signature=await md5(`token=wwesldfs29aniversaryvdld29&timestamp=${timestamp}&sysCode=MCS-MIMP-CORE`);
 const r=await request(SFBASE+path,{method:'POST',body,cookie:cred?.token,headers:{timestamp,signature,sysCode:'MCS-MIMP-CORE',channel:'weixin',platform:'OTHER',Origin:SFBASE,Referer:SFBASE+'/origin/a/mimp-member-right/campusZoneId'}});
 if(cred)combineCookies(cred,r.cookies);
 if(r.json.success===false||r.json.errorCode)throw Error(r.json.errorMessage||r.json.message||'顺丰会话失效或安全验证未通过');
 return r;
}
const RYBASE='https://mec.yto.net.cn', RYSTATION='https://yizhan.mamayz.com:49197/opYZAppPackage/';
async function ryll(cred,path,{method='GET',body,station=false}={}){
 const r=await request((station?RYSTATION:RYBASE)+path,{method,body,headers:{source:'TB_WX_APPLET',...(cred?{'jwt-token':cred.token}:{}),'Content-Type':'application/x-www-form-urlencoded'}});
 const j=r.json;
 if(j?.status!=null&&!['0','200'].includes(String(j.status)))throw Error(j.msg||j.message||'圆通接口错误 '+j.status);
 if(j?.code!=null&&!['0','200'].includes(String(j.code)))throw Error(j.msg||j.message||'圆通接口错误 '+j.code);
 return r;
}
async function antiContent(){
 let serverTime=String(Date.now());
 try{const {json}=await request('https://api.pinduoduo.com/api/server/_stm');serverTime=String(json.server_time||serverTime);}catch{}
 return await native('anti',{serverTime});
}
let pddQueue=Promise.resolve();
function pdd(cred,path,body={}){
 const job=async()=>{
  let ac;try{ac=await antiContent();}catch(e){throw Error('生成拼多多校验失败：'+e.message);}
  let r;try{r=await request('https://mobile.yangkeduo.com/proxy/api/api/express_trackbox/'+path,{method:'POST',body,headers:{'anti-content':ac,accesstoken:cred.token}});}catch(e){throw Error('拼多多接口请求失败：'+e.message);}
  const j=r.json,code=String(j.error_code??'0');
  if(code!=='0'){
   const errors={'40001':'拼多多登录已失效，请重新登录（PDD-40001）','70005':'拼多多平台拒绝了校验结果（PDD-70005）','54001':'拼多多请求过于频繁，请稍后再试（PDD-54001）'};
   throw Error(errors[code]||'拼多多接口错误（PDD-'+code+'）');
  }
  await delay(1000);return j;
 };
 const result=pddQueue.catch(()=>{}).then(job);pddQueue=result;return result;
}
function pddExpiry(value,now=Date.now()){
 const n=Number(value);
 if(!Number.isFinite(n)||n<=0)return now+180000;
 if(n>=1e12)return n; // Unix milliseconds
 if(n>=1e9)return n*1000; // Unix seconds
 return now+n; // remaining milliseconds (not a 1970 timestamp)
}
async function identity(platform,cred){
 if(platform==='TAOBAO') {const j=await mtop(cred,'mtop.cainiao.pickup.identity.getIdentityMessage');return {type:'BARCODE',content:requireString(j.data?.data?.identityCode,'identityCode'),expires:Date.now()+180000};}
 if(platform==='JD') {
  const {json:j}=await request('https://lop-proxy.jd.com/generateIdentityCode',{method:'POST',cookie:cred.token,headers:{ClientInfo:'{"client":"m"}',AppParams:'{"appid":"2410","ticket_type":"m"}','LOP-DN':'convenient-h5.jd.com','Content-Type':'application/json'},body:'[{"source":"ConvenientH5","jdPin":-1}]'});
  const find=o=>o&&typeof o==='object'?(typeof o.identityCode==='string'?o.identityCode:Object.values(o).map(find).find(Boolean)):null;
  return {type:'BARCODE',content:requireString(find(j),'identityCode'),expires:Date.now()+1200000};
 }
 if(platform==='SF') {
  let content;if(cred.extra?.staticSeg)content=(Math.floor(Date.now()/1000)-1640010000)+'ACS'+cred.extra.staticSeg;
  else {const {json:j}=await sf(cred,'/mcs-mimp/commonPost/~memberManage~studentService~createIdentityCode');content=requireString(j.obj,'身份码');const seg=content.split('ACS')[1];if(/^\d{10}$/.test(seg||''))cred.extra={...cred.extra,staticSeg:seg};}
  return {type:'BARCODE',content,expires:Date.now()+180000};
 }
 if(platform==='PDD') {const j=await pdd(cred,'generate_identification_code',{entry_source:'WX'});return {type:'BARCODE',content:requireString(j.result?.identification_code,'identification_code'),expires:pddExpiry(j.result?.expire_mills)};}
 if(platform==='RYLL') {const {json:j}=await ryll(cred,'/api/user/getPinCode');const content=requireString(j.data,'条码图片');if(!content.startsWith('data:image/'))throw Error('圆通返回的码图格式异常');return {type:'IMAGE_URL',content,expires:0};}
 throw Error('未知平台');
}
function item(platform,no,station,pickupCode,summary='',status='WAIT_PICKUP'){return {platform,no:String(no||''),station:station||Platforms[platform].name,pickupCode:pickupCode&&!String(pickupCode).includes('*')?String(pickupCode):'',summary,status};}
async function express(platform,cred){
 if(platform==='JD')throw Error('京东暂不支持快递列表，可使用身份码');
 if(platform==='TAOBAO'){
  const out=[];
  for(let pageNo=1;pageNo<=5;pageNo++){
   const j=await mtop(cred,'mtop.cainiao.pickup.search.queryMultiStationPackages',{stationType:'XY',pageNo,pageSize:10});
   const list=j.data?.data?.stationPackageAssembleList;
   if(!Array.isArray(list))throw Error('淘宝包裹响应结构变化');if(!list.length)break;
   let count=0;for(const s of list)for(const g of s.groupList||[])for(const t of g.certainPickupWaybillList||[]){count++;out.push(item(platform,t.waybillNo,t.stationName||s.stationMessageDTO?.stationName,t.pickupCode,t.upCpCode,t.pickedWaybill?'PICKED':'WAIT_PICKUP'));}
   if(count<10)break;
  }return out;
 }
 if(platform==='SF'){
  const {json:j}=await sf(cred,'/mcs-mimp/commonPost/~memberManage~studentService~queryStudentWaittingWaybill');
  return (Array.isArray(j.obj)?j.obj:[]).map(t=>item(platform,[t.storeName,t.pickUpCode,t.waitingPickType].join('|'),(t.storeName||'顺丰')+(String(t.waitingPickType)==='1'?'（丰巢柜）':''),t.pickUpCode,[t.originateContacts,t.destinationContacts].filter(Boolean).join(' → ')));
 }
 if(platform==='RYLL') {
  const out=[],errors=[];
  for(const [path,body] of [['rypackage/waitAllOrderList',{flag:1}],['rypackage/queryCabinetByPhone',{}]]){
   try{const {json:j}=await ryll(cred,path,{station:true,method:'POST',body});const data=j.data||{};
    for(const key of ['waitTakeOrderResponseList','takeOrderResponseList'])for(const t of data[key]||[])out.push(item(platform,t.waybillNo||t.mailNo||t.wayBillCode||t.expressNo||t.orderNo,t.stationName||t.stationTitle||t.station,t.pickupCode||t.takeCode||t.pickCode,t.productName||t.goodsName||t.remark,key.startsWith('wait')?'WAIT_PICKUP':'PICKED'));
   }catch(e){errors.push(e.message);}
  }if(errors.length)throw Error('圆通列表未完整获取：'+errors.join('；'));return out;
 }
 if(platform==='PDD') {
  const out=[],errors=[];
  try{for(let offset=0;offset<100;offset+=20){const j=await pdd(cred,'list',{offset,count:20,channel:'express',entry_source:'assistant_search',status_type:0,query_type:0});const list=j.result?.track_info_list||[];for(const t of list)out.push(item(platform,t.tracking_number,t.status_type_desc,(t.pick_code||'').replace(/^取件码/,'').trim(),t.goods_name||t.shipping_name,Number(t.status_type)===400?'WAIT_PICKUP':Number(t.status_type)===500?'PICKED':'UNKNOWN'));if(list.length<20)break;await delay(2000);}}catch(e){errors.push(e.message);}
  try{const j=await pdd(cred,'station/package',{entry_source:'WX'});for(const s of j.result?.combine_list||[])for(const t of s.combine_track_list||[]){const old=out.find(x=>x.no===t.tracking_number);const code=(t.pick_code||'').replace(/^取件码/,'').trim();if(old){old.station=s.company_name||s.address||old.station;old.pickupCode||=code;if(old.status!=='PICKED')old.status='WAIT_PICKUP';}else out.push(item(platform,t.tracking_number,s.company_name||s.address,code,t.shipping_name));}}catch(e){errors.push(e.message);}
  if(errors.length)throw Error('拼多多列表未完整获取：'+errors.join('；'));return out;
 }
 return [];
}
function mergeItems(items){const map=new Map();for(const t of items){if(!t.no)continue;const key=t.platform==='SF'?'SF:'+t.no:t.no;const old=map.get(key);if(old){if(!old.pickupCode&&t.pickupCode){old.pickupCode=t.pickupCode;old.codeSource=t.platform;}if(old.status!=='PICKED'&&t.status==='WAIT_PICKUP')old.status='WAIT_PICKUP';old.sources=Array.from(new Set([...old.sources,t.platform]));}else map.set(key,{...t,sources:[t.platform]});}return [...map.values()];}
async function webLogin(platform){
 const cookies=await native('login',{platform});let token='',extra={};
 if(platform==='TAOBAO'){if(!cookies.cookie2||!cookies.unb)throw Error('尚未取得完整淘宝登录态，请完成网页登录后再点完成');token=cookieHeader(cookies);}
 if(platform==='JD'){const pin=cookies.pt_pin||cookies.pin;if(!cookies.pt_key||!pin)throw Error('网页没有下发 pt_key；此登录方式可能受限，可改用凭据导入');token=cookieHeader({...cookies,pin});}
 if(platform==='PDD'){extra={pdd_user_id:cookies.pdd_user_id||'',pdd_uin:cookies.pdd_user_uin||cookies.pdd_uin||''};token=cookies.PDDAccessToken||cookies.pdd_access_token||cookies.accesstoken;if(!token)throw Error('网页未提供拼多多 AccessToken，可改用凭据导入');}
 if(platform==='SF'){if(!cookies.sessionId&&!cookies.JSESSIONID&&!cookies._login_user_id_)throw Error('尚未取得顺丰会话，请完成网页登录');token=cookieHeader(cookies);extra.mimp='1';}
 return {token,extra,capturedAt:Date.now()};
}

function normalizeWaybill(value){
 const no=String(value??'').replace(/\s/g,'').toUpperCase();
 if(!/^[A-Z0-9-]{6,60}$/.test(no))throw Error('请输入正确的快递运单号（6–60 位字母、数字或横线），不是购物订单号');
 return no;
}
function completePickupCode(value){
 const code=String(value??'').trim();
 return code&&!/[*＊]/.test(code)?code:'';
}
async function scanCainiaoPickupList(cred,no){
 let masked=null;
 for(let pageNo=1;pageNo<=3;pageNo++){
  const j=await mtop(cred,'mtop.cainiao.pickup.search.queryMultiStationPackages',{stationType:'XY',pageNo,pageSize:10});
  const stations=j.data?.data?.stationPackageAssembleList;
  if(!Array.isArray(stations))throw Error('菜鸟包裹列表响应结构变化，请稍后重试');
  if(!stations.length)break;
  for(const s of stations){
   const groups=Array.isArray(s.groupList)?s.groupList:[];
   const packages=groups.flatMap(g=>Array.isArray(g.certainPickupWaybillList)?g.certainPickupWaybillList:[]);
   if(!groups.length)for(const key of ['packageList','packages','pkgList','waybillList'])if(Array.isArray(s[key])){packages.push(...s[key]);break;}
   for(const p of packages){
    if(String(p.waybillNo??'').replace(/\s/g,'').toUpperCase()!==no)continue;
    const base={no,station:p.stationName||s.stationMessageDTO?.stationName||'菜鸟驿站',checkedAt:Date.now()};
    if(String(p.status)==='4'||(String(p.status)!=='3'&&(p.pickedWaybill===true||p.pickedWaybill==='true')))return {...base,status:'picked'};
    const code=completePickupCode(p.pickupCode);
    if(code)return {...base,status:'found',code};
    masked={...base,status:'masked'};
   }
  }
 }
 return masked;
}
async function queryCainiaoPickup(cred,input){
 const no=normalizeWaybill(input);
 if(!cred?.token)throw Error('请先登录淘宝 / 菜鸟账户');
 const first=await scanCainiaoPickupList(cred,no);
 if(first&&first.status!=='masked')return first;
 const ts=Date.now(),trace=globalThis.crypto?.randomUUID?.().replace(/-/g,'').slice(0,12)||Math.random().toString(36).slice(2,14);
 let j;
 try{
  j=await mtop(cred,'mtop.cainiao.pickup.search.multiOneSearch',{
   searchValue:no,stationType:'XN',source:'DEFAULT',traceId:`${ts}-${trace}`,
   stationCode:'POINT_0',searchKey:`ST_${ts}_POINT_0_${Math.floor(Math.random()*1000)}`
  });
 }catch(e){
  if(/waybill[-_]5047/i.test(e.message))return first||{status:'not_found',no,checkedAt:Date.now()};
  throw e;
 }
 // Search responses may mask the code. Use them only to check package status;
 // a displayable code must come from the authenticated package-list endpoint.
 const groups=j.data?.data?.pkgResultResps||[];
 if(!Array.isArray(groups))throw Error('菜鸟查询响应结构变化，请稍后重试');
 const matches=groups.flatMap(g=>Array.isArray(g.certainPickupWaybillList)?g.certainPickupWaybillList:[])
  .filter(p=>String(p.waybillNo??'').replace(/\s/g,'').toUpperCase()===no);
 if(matches.some(p=>String(p.status)==='4'))return {status:'picked',no,checkedAt:Date.now()};
 if(!matches.some(p=>String(p.status)==='3'))return first||{status:'not_found',no,checkedAt:Date.now()};
 const second=await scanCainiaoPickupList(cred,no);
 return second||first||{status:'masked',no,checkedAt:Date.now()};
}
