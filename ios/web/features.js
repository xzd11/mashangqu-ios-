'use strict';
const APP_VERSION='1.1.0';
const accountChecks={},checkingAccounts=new Set();
const diagnostics=[];
const updateInfo={busy:false,release:null,error:'',checkedAt:0};
let parcelView='waiting';
function failureKind(error){
 const s=String(error?.message||error||'');
 if(/SESSION_EXPIRED|TOKEN_(?:EMPTY|EXPIRED)|登录.*失效|登录.*过期|重新登录|PDD-40001|HTTP 401/i.test(s))return 'auth';
 if(/安全验证|二次验证|风控|54002|70005|captcha|校验结果/i.test(s))return 'verify';
 if(/HTTP 429|54001|频繁/i.test(s))return 'rate';
 if(/网络|超时|连接|offline|timed? ?out|network|HTTP 50[234]/i.test(s))return 'network';
 return 'platform';
}
const healthLabels={ok:'联网检查通过',local:'本地码可用，登录待联网检查',auth:'登录已过期',verify:'需要平台验证',rate:'请求频繁，请稍后重试',network:'网络连接失败',platform:'平台返回异常'};
function recordDiagnostic(event,fields={}){
 // Strict allowlist: no raw errors, URLs, request bodies, cookies, identifiers or codes.
 if(!['http','identity','account_check','pickup','restore','update','export'].includes(event))return;
 const entry={time:new Date().toISOString(),event};
 if(Object.prototype.hasOwnProperty.call(Platforms,fields.platform))entry.platform=fields.platform;
 if(['auth','verify','rate','network','platform','ok','local'].includes(fields.kind))entry.kind=fields.kind;
 if(Number.isInteger(fields.status)&&fields.status>=100&&fields.status<=599)entry.status=fields.status;
 if(Number.isFinite(fields.duration))entry.durationMs=Math.max(0,Math.min(Math.round(fields.duration),600000));
 diagnostics.push(entry);if(diagnostics.length>200)diagnostics.shift();
}
function requestPlatform(url){
 try{const h=new URL(url).hostname;return h.includes('taobao.com')?'TAOBAO':h.includes('jd.com')?'JD':h.includes('yangkeduo.com')||h.includes('pinduoduo.com')?'PDD':h.includes('sf-express.com')?'SF':h.includes('yto.net.cn')||h.includes('mamayz.com')?'RYLL':null;}catch{return null;}
}
function setAccountHealth(p,cred,kind){if(state.credentials[p]===cred)accountChecks[p]={owner:cred,kind,at:Date.now()};}
function accountHealth(p){const v=accountChecks[p];return v?.owner===state.credentials[p]?v:null;}
function accountNotice(p){
 const h=accountHealth(p);if(!state.credentials[p]||!h)return '';
 return `<div class="account-health ${h.kind==='ok'?'healthy':''}"><span>${healthLabels[h.kind]} · ${ago(h.at)}</span>${h.kind==='auth'||h.kind==='verify'?`<button class="secondary small" data-login="${p}">重新登录 / 验证</button>`:h.kind!=='ok'?`<button class="secondary small" data-check-account="${p}">重试检查</button>`:''}</div>`;
}
async function checkAccount(p){
 const cred=state.credentials[p];if(!cred||checkingAccounts.has(p))return;
 checkingAccounts.add(p);render();
 try{
  if(p==='SF'){const r=await sf(cred,'/mcs-mimp/commonPost/~memberManage~studentService~createIdentityCode');requireString(r.json.obj,'身份码');}
  else await identity(p,cred);
  setAccountHealth(p,cred,'ok');recordDiagnostic('account_check',{platform:p,kind:'ok'});
  if(state.credentials[p]===cred)await persist();
 }catch(e){const kind=failureKind(e);setAccountHealth(p,cred,kind);recordDiagnostic('account_check',{platform:p,kind});}
 finally{checkingAccounts.delete(p);render();}
}
async function checkAllAccounts(){for(const p of Object.keys(state.credentials))await checkAccount(p);}
function currentHistoryRefs(row){return (row.refs||[]).filter(r=>state.credentials[r.platform]&&accountScope(r.platform)===r.scope);}
function visibleHistory(){return (state.history||[]).filter(row=>currentHistoryRefs(row).length).sort((a,b)=>b.at-a.at);}
function hydrateEnhancements(){
 state.history=Array.isArray(state.history)?state.history:[];
 if(!state.historyMigration){
  const grouped=new Map();
  for(const [key,at] of Object.entries(state.pickedLocal||{}))try{
   const [platform,scope,no]=JSON.parse(key);if(!Object.prototype.hasOwnProperty.call(Platforms,platform)||typeof no!=='string')continue;
   let row=grouped.get(no);if(!row){row={id:'legacy-'+grouped.size+'-'+String(at),at:Number(at)||Date.now(),refs:[],markers:[]};grouped.set(no,row);}
   row.refs.push({platform,scope,no,station:Platforms[platform].name,summary:''});row.markers.push({platform,scope,no});
  }catch{}
  state.history.push(...grouped.values());state.historyMigration=true;
 }
}
function historyCard(row){
 const refs=currentHistoryRefs(row),r=refs[0];
 return `<article class="package history-card"><div class="caption">已取 · ${ago(row.at)}</div><h3>${esc(r.station)}</h3><div class="caption">${esc(r.summary)}</div>${r.platform!=='SF'?`<div class="code-text">${esc(r.no)}</div>`:''}<p class="caption">取件码已清除，撤销后可重新查询。</p><button class="secondary full" data-restore-picked="${esc(row.id)}" ${completing||busy?'disabled':''}>撤销已取，恢复待取</button></article>`;
}
async function restorePicked(id){
 if(completing||busy){toast('请等待当前操作完成');return;}
 const row=(state.history||[]).find(r=>r.id===id);if(!row||!currentHistoryRefs(row).length)return;
 completing=true;
 const old={cache:state.cache,pickedLocal:state.pickedLocal,history:state.history};
 state.cache={...state.cache};state.pickedLocal={...state.pickedLocal};
 for(const r of row.markers||row.refs)if(state.credentials[r.platform]&&accountScope(r.platform)===r.scope)delete state.pickedLocal[JSON.stringify([r.platform,r.scope,parcelNo(r.no)])];
 for(const r of currentHistoryRefs(row)){
  const cache=state.cache[r.platform]||{},items=[...(cache.items||[])];
  if(!items.some(x=>parcelNo(x.no)===parcelNo(r.no)))items.push(item(r.platform,r.no,r.station,'',r.summary));
  state.cache[r.platform]={...cache,items};
 }
 state.history=state.history.filter(r=>r!==row);const oldResult=lookup.result;
 if(currentHistoryRefs(row).some(r=>parcelNo(r.no)===lookup.result?.no))lookup.result=null;
 render();
 try{await persist();recordDiagnostic('restore',{kind:'ok'});toast('已恢复待取记录，可刷新或重新查询取件码');}
 catch(e){Object.assign(state,old);lookup.result=oldResult;toast('保存失败，未撤销');}
 finally{completing=false;render();}
}
function groupedPackages(items){
 if(state.groupByStation===false)return items.map(packageCard).join('');
 const groups=new Map();for(const x of items){const name=String(x.station||'未标明驿站').normalize('NFKC').trim().replace(/\s+/g,' ');if(!groups.has(name))groups.set(name,[]);groups.get(name).push(x);}
 return [...groups].map(([station,rows])=>`<section class="station-group"><div class="station-heading"><h2>${esc(station)}</h2><span class="pill">${rows.length} 件</span></div>${rows.map(packageCard).join('')}</section>`).join('');
}
function versionParts(value){const m=/^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(value));return m?m.slice(1).map(Number):null;}
function newerVersion(value){const a=versionParts(value),b=versionParts(APP_VERSION);if(!a)return false;for(let i=0;i<3;i++){if(a[i]!==b[i])return a[i]>b[i];}return false;}
function safeReleaseURL(url){try{const u=new URL(url);return u.protocol==='https:'&&u.hostname==='github.com'&&(!u.port||u.port==='443')&&!u.username&&!u.password&&/^\/xzd11\/mashangqu-ios-\/releases\/tag\/v\d+\.\d+\.\d+$/.test(u.pathname)&&!u.search&&!u.hash;}catch{return false;}}
async function checkUpdates(quiet=false){
 if(updateInfo.busy)return;updateInfo.busy=true;updateInfo.error='';if(!quiet)render();
 try{
  const {json:j}=await request('https://api.github.com/repos/xzd11/mashangqu-ios-/releases/latest',{headers:{Accept:'application/vnd.github+json'}});
  if(j.draft||j.prerelease||!versionParts(j.tag_name)||!safeReleaseURL(j.html_url))throw Error('更新信息格式无效');
  updateInfo.release={version:j.tag_name,url:j.html_url,body:typeof j.body==='string'?j.body.slice(0,12000):''};updateInfo.checkedAt=Date.now();state.updateCheckedAt=updateInfo.checkedAt;
  await persist();recordDiagnostic('update',{kind:'ok'});
  if(quiet&&newerVersion(j.tag_name))toast('发现新版本 '+j.tag_name+'，可在「我的」查看');
 }catch(e){updateInfo.error='暂时无法检查更新，请稍后重试';recordDiagnostic('update',{kind:failureKind(e)});}
 finally{updateInfo.busy=false;render();}
}
function updateCard(){
 const r=updateInfo.release,newer=r&&newerVersion(r.version);
 return `<section class="card"><h2>软件更新</h2><p class="info">当前版本 ${APP_VERSION}${r?' · '+(newer?'发现新版本 '+esc(r.version):'当前已是最新版本'):''}</p><button id="check-updates" class="secondary full" ${updateInfo.busy?'disabled':''}>${updateInfo.busy?'正在检查…':'检查 GitHub 更新'}</button>${updateInfo.error?`<p class="error">${esc(updateInfo.error)}</p>`:''}${r?`<button id="open-release" class="${newer?'primary':'secondary'} full">${newer?'查看更新 / 下载 IPA':'打开版本下载页面'}</button><details class="release-notes"><summary>版本更新内容</summary><div>${esc(r.body)}</div></details>`:''}<p class="caption">新版下载后仍需自行签名安装。</p></section>`;
}
function diagnosticReport(){
 return JSON.stringify({app:'Mashangqu',version:APP_VERSION,generatedAt:new Date().toISOString(),storage:'本机',accounts:Object.keys(Platforms).map(platform=>({platform,saved:!!state.credentials[platform],status:accountHealth(platform)?.kind||'unchecked',cachedItems:state.cache[platform]?.items?.length||0})),historyCount:visibleHistory().length,events:diagnostics},null,2);
}
async function exportDiagnostics(){
 try{recordDiagnostic('export',{kind:'ok'});await native('shareText',{text:diagnosticReport()});}catch(e){toast('诊断日志导出失败，请重试');}
}
function utilityCards(){return `${updateCard()}<section class="card"><h2>隐私与诊断</h2><p class="info">切换到后台时自动遮挡敏感内容。诊断日志仅包含版本、平台、请求状态、耗时和错误类别，不包含 Cookie、Token、手机号、运单号或取件码。</p><button id="export-diagnostics" class="secondary full">导出脱敏诊断日志</button></section>`;}
function bindEnhancements(){
 document.querySelectorAll('[data-restore-picked]').forEach(b=>b.onclick=()=>restorePicked(b.dataset.restorePicked));
 document.querySelectorAll('[data-parcel-view]').forEach(b=>b.onclick=()=>{parcelView=b.dataset.parcelView;render();});
 document.querySelectorAll('[data-check-account]').forEach(b=>b.onclick=()=>checkAccount(b.dataset.checkAccount));
 if($('check-all-accounts'))$('check-all-accounts').onclick=checkAllAccounts;
 if($('group-stations'))$('group-stations').onchange=async e=>{const old=state.groupByStation;state.groupByStation=e.target.checked;render();try{await persist();}catch{state.groupByStation=old;render();toast('偏好保存失败');}};
 if($('check-updates'))$('check-updates').onclick=()=>checkUpdates();
 if($('open-release'))$('open-release').onclick=async()=>{const url=updateInfo.release?.url;if(!safeReleaseURL(url))return;try{await native('openURL',{url});}catch{toast('无法打开下载页面');}};
 if($('export-diagnostics'))$('export-diagnostics').onclick=exportDiagnostics;
}

document.addEventListener('visibilitychange',()=>{const shield=document.getElementById('privacy-shield');if(shield)shield.hidden=!document.hidden;});
