'use strict';
let tab='identity',filter='ALL',busy=false,completing=false;
const lookup={input:'',busy:false,result:null,error:'',owner:null};const codes={},errors={},loading=new Set();
let pddQr=null;
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ago=t=>t?new Date(t).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'尚未刷新';
function toast(s,action){const box=$('toast');box.textContent=s;if(action){const button=document.createElement('button');button.textContent=action.label;button.className='toast-action';button.onclick=()=>{box.classList.remove('show');action.run();};box.appendChild(button);}box.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>box.classList.remove('show'),action?7000:4500);}
function modal(title,content){stopPddQr();$('modal-title').textContent=title;$('modal-content').innerHTML=content;$('modal').hidden=false;}
let expandedPlatform=null,viewerTimer=null,viewerPreviousFocus=null;
function layoutCodeViewer(){
 const w=window.innerWidth,h=window.innerHeight,stage=$('code-stage');
 stage.style.setProperty('--viewer-width',Math.max(w,h)+'px');
 stage.style.setProperty('--viewer-height',Math.min(w,h)+'px');
 stage.style.setProperty('--viewer-rotation',w<h?'90deg':'0deg');
}
function updateCodeViewer(){
 const c=codes[expandedPlatform];if(!c)return;
 const expired=c.expires&&c.expires<=Date.now();
 $('code-viewer-image').hidden=!!expired;$('code-viewer-notice').hidden=!expired;
 $('code-viewer-notice').textContent=expired?'身份码已过期，请关闭后刷新':'';
 $('code-viewer-expiry').textContent=expired?'已过期':c.expires?'有效至 '+new Date(c.expires).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}):'静态身份码';
}
function closeCodeViewer(){
 $('code-viewer').hidden=true;document.body.classList.remove('code-viewer-open');
 clearInterval(viewerTimer);viewerTimer=null;expandedPlatform=null;
 $('code-viewer-image').removeAttribute('src');
 viewerPreviousFocus?.focus?.({preventScroll:true});viewerPreviousFocus=null;
}
function openCodeViewer(p){
 const c=codes[p];if(!c)return;
 if(c.expires&&c.expires<=Date.now()){toast('身份码已过期，请先刷新');return;}
 if(c.type==='QR'){modal(Platforms[p].name,`<img class="expanded-code" src="${esc(c.image)}" alt="放大的二维码">`);return;}
 viewerPreviousFocus=document.activeElement;expandedPlatform=p;
 $('modal').hidden=true;document.body.classList.add('code-viewer-open');
 $('code-viewer-title').textContent=Platforms[p].name+' · 身份条形码';
 $('code-viewer-image').src=c.image;$('code-viewer-value').textContent=c.type==='IMAGE_URL'?'':c.content;
 layoutCodeViewer();updateCodeViewer();$('code-viewer').hidden=false;$('close-code-viewer').focus();
 clearInterval(viewerTimer);viewerTimer=setInterval(updateCodeViewer,1000);
}
$('close-code-viewer').onclick=closeCodeViewer;
window.addEventListener('resize',()=>{if(expandedPlatform)layoutCodeViewer();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&expandedPlatform)closeCodeViewer();});
document.addEventListener('dblclick',e=>{if(!e.target.closest('input,textarea,select'))e.preventDefault();},{passive:false});
$('close-modal').onclick=()=>{stopPddQr();$('modal').hidden=true;};
$('modal').onclick=e=>{if(e.target===$('modal')){stopPddQr();$('modal').hidden=true;}};
function badge(p){return `<span class="badge" style="background:${Platforms[p].color}">${esc(Platforms[p].name[0])}</span>`;}
function codeCard(p){const info=Platforms[p],cred=state.credentials[p],c=codes[p],expired=c?.expires&&c.expires<=Date.now();
return `<article class="card"><div class="cardtop">${badge(p)}<div><h2>${info.name}</h2><div class="caption">${cred?'本机账户已保存':'登录后获取身份码'}</div></div><span class="pill">${!cred?'未登录':loading.has(p)?'刷新中':expired?'已过期':c?'可出示':'待刷新'}</span></div><div class="code-area">${c&&!expired?`<img class="${c.type!=='QR'?'bar':''}" src="${esc(c.image)}" alt="${info.name}身份码" data-expand="${p}"><div class="code-text">${c.type==='IMAGE_URL'?'平台原始条码图片':esc(c.content)}</div><div class="caption">${c.expires?'有效至 '+new Date(c.expires).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}):'静态身份码'} · 点击放大</div>`:`<div class="placeholder">▦</div><div class="caption">${expired?'身份码已过期，请刷新':cred?'点击刷新获取身份码':'账户信息仅保存在本机'}</div>`}</div>${accountNotice(p)}${errors[p]?`<div class="error">${esc(errors[p])}</div>`:''}<div class="actions"><button class="${cred?'secondary':'primary'}" data-login="${p}">${cred?'账户管理':'登录 / 导入'}</button>${cred?`<button class="primary" data-code="${p}" ${loading.has(p)?'disabled':''}>刷新身份码</button>`:''}</div></article>`;}
function pickupLookupCard(){
 const cred=state.credentials.TAOBAO,result=lookup.owner===cred?lookup.result:null;
 const messages={local_picked:'已标记为已取，本机取件码已删除',picked:'菜鸟显示该包裹已取件',not_found:'未查到该账户下可获取取件码的包裹。请核对运单号及是否已入库。',masked:'已找到包裹，但菜鸟未返回完整取件码，请在菜鸟官方页面查看。'};
 return `<section class="card lookup-card"><h2>运单号查取件码</h2><p class="caption">使用已登录的菜鸟账户查询，填写快递运单号（非购物订单号）</p><form id="pickup-query-form"><label for="pickup-waybill">快递运单号</label><input id="pickup-waybill" type="text" inputmode="text" enterkeyhint="search" autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false" maxlength="80" placeholder="例如 YT…、SF… 或数字运单号" value="${esc(lookup.input)}"><button id="pickup-query-submit" class="primary full" ${lookup.busy||!cred?'disabled':''}>${lookup.busy?'正在通过菜鸟查询…':'查询取件码'}</button></form>${!cred?'<button class="secondary full" data-login="TAOBAO">先登录淘宝 / 菜鸟</button>':''}${lookup.error?`<div class="error" role="alert">${esc(lookup.error)}</div>`:''}${result?`<div id="pickup-query-result" class="lookup-result" role="status"><div class="caption">${esc(result.no)} · 来源：菜鸟 · ${ago(result.checkedAt)}</div>${result.status==='found'?`<div class="pickup">${esc(result.code)}</div><div>${esc(result.station)}</div><button class="secondary full" data-picked-no="${esc(result.no)}" ${completing?'disabled':''}>已取</button>`:`<p class="info">${messages[result.status]||'暂未返回可用取件码'}</p>`}</div>`:''}</section>`;
}
async function submitPickupLookup(){
 if(lookup.busy)return;
 const cred=state.credentials.TAOBAO;
 lookup.result=null;lookup.error='';lookup.owner=cred;
 try{lookup.input=normalizeWaybill(lookup.input);if(!cred)throw Error('请先登录淘宝 / 菜鸟账户');}
 catch(e){lookup.error=e.message;render();return;}
 lookup.busy=true;render();
 try{const result=await queryCainiaoPickup(cred,lookup.input);if(state.credentials.TAOBAO!==cred)return;lookup.result=locallyPicked('TAOBAO',result.no)?{...result,status:'local_picked',code:undefined}:result;
 if(result.status==='found'&&!locallyPicked('TAOBAO',result.no))for(const cache of Object.values(state.cache))for(const entry of cache.items||[]){
  if(String(entry.no??'').replace(/\s/g,'').toUpperCase()===result.no&&entry.status!=='PICKED'&&!locallyPicked(entry.platform,entry.no)){
   entry.cainiaoPickup={code:result.code,accountKey:cainiaoAccountKey(cred),checkedAt:result.checkedAt};
  }
 }
 await persist();}
 catch(e){if(state.credentials.TAOBAO===cred)lookup.error=e.message;}
 finally{lookup.busy=false;render();}
}
function cainiaoAccountKey(cred){return cred?(cookieMap(cred.token).unb||String(cred.capturedAt||'')):'';}
// Local completion markers are scoped to the platform account, independently of list caches.
function parcelNo(no){return String(no??'').replace(/\s/g,'').toUpperCase();}
function accountScope(p){
 const cred=state.credentials[p];if(!cred)return '';
 if(p==='TAOBAO')return cainiaoAccountKey(cred);
 if(cred.capturedAt)return String(cred.capturedAt);
 // Legacy imported credentials may not have a capture time. Do not duplicate tokens in markers.
 let a=2166136261,b=5381;for(const c of cred.token||''){a=Math.imul(a^c.charCodeAt(0),16777619);b=Math.imul(b,33)^c.charCodeAt(0);}
 return (a>>>0).toString(16)+':'+(b>>>0).toString(16);
}
function pickedKey(p,no){return JSON.stringify([p,accountScope(p),parcelNo(no)]);}
function locallyPicked(p,no){return !!state.pickedLocal?.[pickedKey(p,no)];}
async function markPicked(no){
 no=parcelNo(no);if(!no||completing)return;if(busy){toast('正在刷新，请稍候再标记');return;}completing=true;
 const oldMarkers={...state.pickedLocal},oldHistory=state.history,changed=[];
 const refs=[];
 for(const [p,c] of Object.entries(state.cache))for(const x of c.items||[])if(parcelNo(x.no)===no)refs.push({platform:p,scope:accountScope(p),no:x.no,station:x.station,summary:x.summary||''});
 if(!refs.length&&lookup.result?.no===no&&state.credentials.TAOBAO)refs.push({platform:'TAOBAO',scope:accountScope('TAOBAO'),no,station:lookup.result.station||'菜鸟',summary:''});
 const row={id:Date.now().toString(36)+'-'+(markPicked.serial=(markPicked.serial||0)+1),at:Date.now(),refs,markers:Object.keys(state.credentials).map(p=>({platform:p,scope:accountScope(p),no}))};
 state.history=[...(state.history||[]),row];
 state.pickedLocal={...oldMarkers};
 for(const p of Object.keys(state.credentials))state.pickedLocal[pickedKey(p,no)]=Date.now();
 for(const [p,cache] of Object.entries(state.cache)){
  const oldItems=cache.items||[],items=oldItems.filter(x=>parcelNo(x.no)!==no);
  if(items.length!==oldItems.length){changed.push({cache,oldItems,items});cache.items=items;}
 }
 const oldResult=lookup.result;
 if(parcelNo(lookup.result?.no)===no)lookup.result=null;
 render();
 try{await persist();recordDiagnostic('pickup',{kind:'ok'});toast('已取，已删除本机取件码',{label:'撤销',run:()=>restorePicked(row.id)});}
 catch(e){
  state.pickedLocal=oldMarkers;state.history=oldHistory;
  for(const {cache,oldItems,items} of changed)if(cache.items===items)cache.items=oldItems;
  if(!lookup.result)lookup.result=oldResult;
  toast('保存失败，未删除：'+e.message);
 }finally{completing=false;render();}
}
function packageCard(x){
 const supplement=state.credentials.TAOBAO&&x.cainiaoPickup?.accountKey===cainiaoAccountKey(state.credentials.TAOBAO)?x.cainiaoPickup:null;
 const displayedCode=supplement?.code||x.pickupCode,source=supplement?'TAOBAO':x.codeSource;
 const no=String(x.no??'').replace(/\s/g,'').toUpperCase();
 const canQuery=/^[A-Z0-9-]{6,60}$/.test(no);
 const result=lookup.owner===state.credentials.TAOBAO&&lookup.result?.no===no?lookup.result:null;
 const isThisQuery=lookup.input===no;
 const messages={local_picked:'已标记为已取，本机取件码已删除',picked:'菜鸟显示该包裹已取件',not_found:'菜鸟未查到可用取件码',masked:'菜鸟未返回完整取件码'};
 return `<article class="package"><div class="caption">${x.sources.map(p=>Platforms[p].name.split(' · ')[0]).join(' / ')}${x.status==='UNKNOWN'?' · 状态待确认':''}</div><h3>${esc(x.station)}</h3><div class="pickup">${esc(displayedCode||'暂无取件码')}</div>${source?`<div class="caption">取件码来源：${Platforms[source].name}</div>`:''}<div class="caption">${esc(x.summary)}</div><div class="code-text" style="text-align:left;max-width:100%;margin-top:8px">${esc(x.platform==='SF'?'':x.no)}</div><button class="secondary full" data-picked-no="${esc(x.no)}" ${completing||busy?'disabled':''}>已取</button><button class="secondary full" data-cainiao-no="${esc(canQuery?no:'')}" ${!canQuery||lookup.busy?'disabled':''}>${lookup.busy&&isThisQuery?'正在查询…':'通过菜鸟查询取件码'}</button>${!canQuery?'<div class="caption" style="margin-top:8px">该记录未提供可查询的运单号</div>':''}${result&&result.status!=='found'?`<p class="info">${messages[result.status]||'暂未返回取件码'}</p>`:''}${isThisQuery&&lookup.error?`<div class="error">${esc(lookup.error)}</div>`:''}</article>`;
}
function render(){
 if(tab==='identity')$('main').innerHTML=`<div class="intro"><span>一个地方，出示所有身份码</span><span>${Object.keys(state.credentials).length} / 5</span></div>${Object.keys(Platforms).map(codeCard).join('')}`;
 if(tab==='express'){
  const all=mergeItems(Object.entries(state.cache).flatMap(([p,c])=>(c.items||[]).filter(x=>!locallyPicked(p,x.no)))).filter(x=>x.status!=='PICKED'&&(filter==='ALL'||x.sources.includes(filter)));
  const history=visibleHistory().filter(r=>filter==='ALL'||currentHistoryRefs(r).some(x=>x.platform===filter));
  $('main').innerHTML=`${parcelView==='waiting'?pickupLookupCard():''}<div class="chips parcel-views"><button data-parcel-view="waiting" class="${parcelView==='waiting'?'active':''}">待取</button><button data-parcel-view="history" class="${parcelView==='history'?'active':''}">已取记录 · ${visibleHistory().length}</button></div><div class="intro"><span>${parcelView==='history'?'已取记录 · '+history.length:'待取包裹 · '+all.length} 件</span><span>按运单号合并</span></div><div class="chips">${['ALL',...Object.keys(Platforms)].map(p=>`<button data-filter="${p}" class="${filter===p?'active':''}">${p==='ALL'?'全部':Platforms[p].name.split(' · ')[0]}</button>`).join('')}</div>${Object.entries(state.cache).map(([p,c])=>`<div class="caption">${Platforms[p].name} · ${ago(c.at)}${c.error?' · 本次更新失败，保留旧记录':''}</div>${c.error?`<div class="error">${esc(c.error)}</div>`:''}`).join('')}${parcelView==='history'?(history.map(historyCard).join('')||'<div class="empty">暂无已取记录</div>'):all.length?`<label class="group-toggle"><input id="group-stations" type="checkbox" ${state.groupByStation!==false?'checked':''}>按驿站分组</label>${groupedPackages(all)}`:`<div class="empty"><div class="big">▣</div>${Object.keys(state.credentials).length?'暂无已获取的待取包裹':'请先登录平台账户'}<p class="caption">点击右上角刷新获取列表</p></div>`}`;
 }
 if(tab==='mine')$('main').innerHTML=`<div class="note">账户信息保存在本机，请求直连各平台。</div><div class="section">平台账户</div><div class="card">${Object.entries(Platforms).map(([p,v])=>`<div class="row"><div class="cardtop">${badge(p)}<div><span class="row-title">${v.name}</span><small>${state.credentials[p]?(checkingAccounts.has(p)?'正在联网检查…':healthLabels[accountHealth(p)?.kind]||'已保存 · 待检查'):'未登录'}</small></div></div><div class="account-buttons">${state.credentials[p]?`<button class="secondary small" data-check-account="${p}" ${checkingAccounts.has(p)?'disabled':''}>检查</button>`:''}<button class="secondary small" data-login="${p}">${['auth','verify'].includes(accountHealth(p)?.kind)?'重新登录':'管理'}</button></div></div>`).join('')}<button id="check-all-accounts" class="secondary full" ${checkingAccounts.size?'disabled':''}>检查所有已登录账户</button></div>${utilityCards()}<div class="section">偏好与说明</div><div class="card"><div class="row"><div><span class="row-title">身份码自动刷新</span><small>仅在身份码页面前台运行，每 3 分钟一次</small></div><input id="auto" class="toggle" type="checkbox" ${state.auto?'checked':''} aria-label="身份码自动刷新"></div><div class="info" style="margin-top:16px">支持多个平台身份码、快递聚合和菜鸟取件码查询。<br>点击身份条形码可横向全屏展示。<br>京东目前支持身份码，暂不支持快递列表。</div></div><div class="ver">码上取 iOS · ${APP_VERSION}<br>基于 njpemo/mashangqu · MIT License<br>支持 iPhone / iPad · iOS 15 及以上</div>`;
 if($('pickup-query-form')){
  $('pickup-waybill').oninput=e=>{lookup.input=e.target.value;};
  $('pickup-query-form').onsubmit=e=>{e.preventDefault();submitPickupLookup();};
 }
 document.querySelectorAll('[data-login]').forEach(b=>b.onclick=()=>manage(b.dataset.login));
 document.querySelectorAll('[data-code]').forEach(b=>b.onclick=()=>refreshCode(b.dataset.code));
 document.querySelectorAll('[data-expand]').forEach(b=>b.onclick=()=>openCodeViewer(b.dataset.expand));
 document.querySelectorAll('[data-cainiao-no]').forEach(b=>b.onclick=()=>{
  if(!b.dataset.cainiaoNo||lookup.busy)return;
  lookup.input=b.dataset.cainiaoNo;
  if(!state.credentials.TAOBAO){manage('TAOBAO');return;}
  submitPickupLookup();
 });
 document.querySelectorAll('[data-picked-no]').forEach(b=>b.onclick=()=>markPicked(b.dataset.pickedNo));
 document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;render();});
 bindEnhancements();
 if($('auto'))$('auto').onchange=async e=>{const old=state.auto;state.auto=e.target.checked;try{await persist();}catch(err){state.auto=old;toast(err.message);render();}};
}
async function saveCredential(p,cred){
 const old=state.credentials[p];state.credentials[p]=cred;
 if(p==='TAOBAO'){lookup.result=null;lookup.error='';lookup.owner=null;}
 try{await persist();}catch(e){if(old)state.credentials[p]=old;else delete state.credentials[p];throw e;}
 delete codes[p];delete errors[p];delete state.cache[p];await persist();$('modal').hidden=true;render();toast('账户已保存在本机');await refreshCode(p);
}
function stopPddQr(){if(pddQr){clearTimeout(pddQr.timer);pddVerificationClear(pddQr.verifyContext).catch(()=>{});pddQr=null;}}
function pddQrCurrent(s){return pddQr===s&&!$('modal').hidden;}
function renderPddQr(s){
 if(!pddQrCurrent(s))return;
 if(['checking','sms','quiz'].includes(s.phase)){renderPddVerification(s);return;}
 const verifying=s.phase==='verify',saving=s.phase==='saving';
 $('modal-content').innerHTML=`<p class="info">打开拼多多 App → 扫一扫 → 相册，选择登录二维码并确认授权。可截屏保存，或使用下方按钮在系统分享菜单中「存储图像」。</p>${s.image&&!verifying&&!saving?`<div class="pdd-login-qr"><img src="${esc(s.image)}" alt="拼多多登录二维码"></div><button id="pdd-save-qr" class="secondary full">保存二维码 / 分享</button>`:''}<p id="pdd-qr-hint" class="info" role="status">${esc(s.hint)}</p>${s.error?`<div class="error" role="alert">${esc(s.error)}</div>`:''}${verifying?'<p class="info">请在拼多多官方页面完成安全验证，然后点击右上角「完成登录」。这是扫码授权后的验证，不会切换到普通手机号登录。</p><button id="pdd-verify" class="primary full">打开官方安全验证</button>':''}${!saving?'<button id="pdd-new-qr" class="secondary full">重新生成二维码</button>':''}`;
 if($('pdd-new-qr'))$('pdd-new-qr').onclick=startPddQr;
 if($('pdd-save-qr'))$('pdd-save-qr').onclick=async e=>{
  const button=e.target;button.disabled=true;
  try{await native('shareCode',{text:s.content,type:'QR'});}catch(e){if(pddQrCurrent(s))toast(e.message);}
  finally{if(pddQrCurrent(s)&&$('pdd-save-qr'))$('pdd-save-qr').disabled=false;}
 };
 if($('pdd-verify'))$('pdd-verify').onclick=async e=>{
  e.target.disabled=true;s.error='';
  try{const cookies=await native('login',{platform:'PDD',url:pddQrVerifyURL(s)});if(!pddQrCurrent(s))return;await finishPddQr(s,pddCredential(cookies));}
  catch(e){if(pddQrCurrent(s)){s.error=e.message;renderPddQr(s);}}
 };
}
async function finishPddQr(s,credential){
 if(!pddQrCurrent(s))return;
 s.phase='saving';s.image=null;s.hint='授权成功，正在保存登录凭据…';renderPddQr(s);
 await saveCredential('PDD',credential);
 if(pddQr===s)stopPddQr();
}
async function generatePddQr(s){
 if(!pddQrCurrent(s))return;
 clearTimeout(s.timer);s.phase='generating';s.image=null;s.error='';s.hint='正在生成拼多多授权二维码…';renderPddQr(s);
 try{
  const qr=await pddQrGenerate();if(!pddQrCurrent(s))return;
  s.secretKey=qr.secretKey;s.content=qr.content;
  const image=await native('code',{text:qr.content,type:'QR'});if(!pddQrCurrent(s))return;
  s.image=image;s.phase='waiting';s.hint='等待拼多多 App 扫码确认；二维码过期后会自动刷新。';renderPddQr(s);
  s.timer=setTimeout(()=>pollPddQr(s),3000);
 }catch(e){if(pddQrCurrent(s)){s.phase='error';s.hint='二维码生成失败，可重新生成。';s.error=e.message;renderPddQr(s);}}
}
async function pollPddQr(s){
 if(!pddQrCurrent(s)||s.phase!=='waiting')return;
 if(document.hidden){s.timer=setTimeout(()=>pollPddQr(s),3000);return;}
 try{
  const result=await pddQrCheck(s.secretKey);if(!pddQrCurrent(s))return;
  if(result.status==='expired'){
   if(++s.expirations>=3)throw Error('二维码已多次过期，请点击重新生成');
   await generatePddQr(s);return;
  }
  if(result.status==='waiting'){s.timer=setTimeout(()=>pollPddQr(s),3000);return;}
  s.ticket=result.ticket;s.phase='authorizing';s.hint='已确认授权，正在获取登录凭据…';renderPddQr(s);
  const auth=await pddQrAuth(s.ticket,s.secretKey);if(!pddQrCurrent(s))return;
  if(auth.status==='ok')await finishPddQr(s,auth.credential);
  else{s.vat=auth.vat;await startPddVerification(s);}
 }catch(e){if(pddQrCurrent(s)){s.phase='error';s.image=null;s.hint='扫码登录未完成，请重试。';s.error=e.message;renderPddQr(s);}}
}
function startPddQr(){
 modal('拼多多 · 扫码登录','');
 const s={phase:'generating',image:null,expirations:0};pddQr=s;
 generatePddQr(s);
}
async function pddOfficialFallback(s,message='',refresh=true){
 if(!pddQrCurrent(s))return;
 await pddVerificationClear(s.verifyContext).catch(()=>{});s.verifyContext=null;
 if(refresh){
  try{
   const auth=await pddQrAuth(s.ticket,s.secretKey);if(!pddQrCurrent(s))return;
   if(auth.status==='ok'){await finishPddQr(s,auth.credential);return;}s.vat=auth.vat;
  }catch(e){if(!pddQrCurrent(s))return;}
 }
 s.phase='verify';s.image=null;s.hint='当前验证需要在拼多多官方页面完成。';s.error=message;s.verifyBusy=false;renderPddQr(s);
}
async function startPddVerification(s){
 if(!pddQrCurrent(s))return;
 s.phase='checking';s.image=null;s.error='';s.hint='正在准备安全验证…';renderPddQr(s);
 try{
  const ctx=await pddVerificationPrepare(s.vat);
  if(!pddQrCurrent(s)){await pddVerificationClear(ctx).catch(()=>{});return;}
  s.verifyContext=ctx;
  if([1,2,3].includes(ctx.type)){s.phase='sms';s.hint='验证码已发送到拼多多账户绑定的手机号';}
  else if(ctx.type===101){
   const q=await pddVerificationQuestion(ctx);if(!pddQrCurrent(s))return;
   s.question=q;s.selected=[];s.quizOrder=1;s.phase='quiz';s.hint='请根据题目手动选择答案';
  }else{await pddOfficialFallback(s);return;}
  renderPddQr(s);
 }catch(e){if(pddQrCurrent(s))await pddOfficialFallback(s,e.message);}
}
async function finishPddVerification(s){
 const auth=await pddQrAuth(s.ticket,s.secretKey,s.vat,1);if(!pddQrCurrent(s))return;
 if(auth.status==='ok')await finishPddQr(s,auth.credential);
 else{s.vat=auth.vat;await pddOfficialFallback(s,'平台仍要求进一步验证，请继续完成。',false);}
}
async function submitPddVerification(s,code){
 if(!pddQrCurrent(s)||s.verifyBusy)return;
 s.verifyBusy=true;s.error='';renderPddQr(s);
 try{
  if(s.phase==='sms'){
   await pddVerificationSms(s.verifyContext,code);if(!pddQrCurrent(s))return;
   await finishPddVerification(s);
  }else if(s.phase==='quiz'){
   const result=await pddVerificationAnswer(s.verifyContext,s.question,s.selected,s.quizOrder);if(!pddQrCurrent(s))return;
   if(result===0)await finishPddVerification(s);
   else{
    const q=await pddVerificationQuestion(s.verifyContext);if(!pddQrCurrent(s))return;
    s.question=q;s.selected=[];s.quizOrder++;s.error='答案未通过，请根据新题目再试一次。';
   }
  }
 }catch(e){if(pddQrCurrent(s))s.error=e.message;}
 finally{if(pddQrCurrent(s)){s.verifyBusy=false;renderPddQr(s);}}
}
function renderPddVerification(s){
 if(!pddQrCurrent(s))return;
 const loading=s.phase==='checking',sms=s.phase==='sms',q=s.question;
 $('modal-title').textContent='拼多多 · 安全验证';
 $('modal-content').innerHTML=`<div class="verify-heading"><span class="badge" style="background:#d84236">拼</span><div><h3>${loading?'准备验证':sms?'短信验证':'验证题'}</h3><div class="caption">${esc(s.hint)}</div></div></div>${s.error?`<div class="error" role="alert">${esc(s.error)}</div>`:''}${loading?'<p class="info" role="status">正在安全连接，请稍候…</p>':sms?`<form id="pdd-sms-form"><label for="pdd-sms">短信验证码</label><input id="pdd-sms" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{4,8}" maxlength="8" placeholder="输入短信验证码" ${s.verifyBusy?'disabled':''}><button id="pdd-verification-submit" class="primary full" ${s.verifyBusy?'disabled':''}>${s.verifyBusy?'正在验证…':'验证并登录'}</button></form>`:`<h3 class="verify-question">${esc(q.desc)}</h3><p class="caption">${q.count===1?'单选':'请选择 '+q.count+' 项'}</p><form id="pdd-quiz-form"><div class="verify-options ${q.options.every(([k,v])=>pddVerificationImage(v))?'image-options':''}">${q.options.map(([k,v],i)=>`<label class="verify-option ${s.selected.includes(k)?'selected':''}"><input type="${q.count===1?'radio':'checkbox'}" name="pdd-answer" value="${esc(k)}" ${s.selected.includes(k)?'checked':''} ${s.verifyBusy?'disabled':''}>${pddVerificationImage(v)?`<img src="${esc(v)}" alt="选项 ${i+1}" referrerpolicy="no-referrer">`:`<span>${esc(v)}</span>`}</label>`).join('')}</div><button id="pdd-verification-submit" class="primary full" ${s.verifyBusy||s.selected.length!==q.count?'disabled':''}>${s.verifyBusy?'正在验证…':'确认答案并登录'}</button></form>`}${!loading&&!s.verifyBusy?'<button id="pdd-verification-web" class="secondary full">改用官方验证页面</button>':''}<p class="caption" style="margin-top:14px">这是扫码授权后的安全验证。完成后继续当前扫码登录。</p>`;
 if($('pdd-sms-form'))$('pdd-sms-form').onsubmit=e=>{e.preventDefault();submitPddVerification(s,$('pdd-sms').value.trim());};
 if($('pdd-quiz-form')){
  $('pdd-quiz-form').onsubmit=e=>{e.preventDefault();submitPddVerification(s);};
  document.querySelectorAll('[name="pdd-answer"]').forEach(input=>input.onchange=()=>{
   if(s.verifyBusy)return;
   s.selected=[...document.querySelectorAll('[name="pdd-answer"]:checked')].map(x=>x.value);
   $('pdd-verification-submit').disabled=s.selected.length!==q.count;
   document.querySelectorAll('.verify-option').forEach(label=>label.classList.toggle('selected',label.querySelector('input').checked));
  });
 }
 if($('pdd-verification-web'))$('pdd-verification-web').onclick=()=>{s.phase='checking';s.hint='正在打开官方验证入口…';renderPddQr(s);pddOfficialFallback(s).catch(e=>{if(pddQrCurrent(s)){s.error=e.message;renderPddQr(s);}});};
}
function manage(p){const cred=state.credentials[p];modal(Platforms[p].name,`<p class="info">${p==='PDD'?'使用拼多多 App 扫一扫确认授权，不走普通手机号登录流程。':p==='RYLL'?'可直接使用手机号和短信验证码登录。':'在平台官方网页完成登录后，点击右上角「完成登录」。如果网页无法提供所需凭据，可使用手动导入。'}</p>${p==='PDD'?'<button id="pdd-qr-mode" class="primary full">扫码登录</button>':p==='RYLL'?'<button id="sms-mode" class="primary full">手机号登录</button>':'<button id="web-login" class="primary full">打开官方网页登录</button>'}<button id="import-mode" class="secondary full">导入已有凭据</button>${cred?'<button id="logout" class="danger full">退出并删除本机账户</button>':''}`);
 if($('pdd-qr-mode'))$('pdd-qr-mode').onclick=startPddQr;
 if($('web-login'))$('web-login').onclick=async e=>{e.target.disabled=true;try{await saveCredential(p,await webLogin(p));}catch(err){toast(err.message);}finally{if($('web-login'))$('web-login').disabled=false;}};
 if($('sms-mode'))$('sms-mode').onclick=ryllForm;
 $('import-mode').onclick=()=>importForm(p);
 if($('logout'))$('logout').onclick=async()=>{const old=JSON.parse(JSON.stringify(state));delete state.credentials[p];delete state.cache[p];if(p==='TAOBAO'){lookup.result=null;lookup.error='';lookup.owner=null;}try{await persist();delete codes[p];delete errors[p];$('modal').hidden=true;render();toast('已删除本机保存的账户');}catch(err){state=old;toast(err.message);}};
}
function importForm(p){const hint={TAOBAO:'完整 Cookie，必须含 cookie2 和 unb',JD:'Cookie，必须含 pt_key 和 pin / pt_pin',PDD:'AccessToken 字符串',SF:'MIMP Cookie，含 sessionId / JSESSIONID；不支持旧 YJY-Auth JWT',RYLL:'jwt-token 字符串'}[p];
 modal('导入 · '+Platforms[p].name,`<p class="info">${hint}</p><label>凭据<textarea id="credential" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" placeholder="在此粘贴"></textarea></label><p class="caption">也接受 JSON：{"token":"…","extra":{…}}</p><button id="save-import" class="primary full">保存并尝试取码</button><div id="import-error" class="error" hidden></div>`);
 $('save-import').onclick=async e=>{e.target.disabled=true;try{const raw=$('credential').value.trim();if(!raw)throw Error('请先粘贴凭据');let cred=raw.startsWith('{')?JSON.parse(raw):{token:raw,extra:{}};if(typeof cred.token!=='string')throw Error('缺少 token 字符串');cred.token=cred.token.trim();cred.extra=cred.extra&&typeof cred.extra==='object'&&!Array.isArray(cred.extra)?cred.extra:{};const cs=cookieMap(cred.token);if(p==='TAOBAO'&&(!cs.cookie2||!cs.unb))throw Error('Cookie 必须同时含 cookie2 和 unb');if(p==='PDD'&&(cs.PDDAccessToken||cs.pdd_access_token||cs.accesstoken))cred.token=cs.PDDAccessToken||cs.pdd_access_token||cs.accesstoken;if(p==='JD'){if(!cs.pt_key||!(cs.pin||cs.pt_pin))throw Error('Cookie 必须含 pt_key 和 pin / pt_pin');if(!cs.pin)cred.token=cookieHeader({...cs,pin:cs.pt_pin});}if(p==='SF'){if(!cs.sessionId&&!cs.JSESSIONID&&!cs._login_user_id_&&!/^\d{10}$/.test(cred.extra.staticSeg||''))throw Error('请导入 MIMP Cookie，或包含 10 位 staticSeg 的 JSON');cred.extra.mimp='1';}cred.capturedAt=Date.now();await saveCredential(p,cred);}catch(err){if($('import-error')){$('import-error').textContent=err.message;$('import-error').hidden=false;}else toast(err.message);}finally{if($('save-import'))$('save-import').disabled=false;}};
}
async function ryllForm(){let cap;modal('圆通 · 手机号登录',`<label>手机号<input id="phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="11"></label><div><img id="captcha-img" class="captcha" alt="加载图形验证码"><button id="reload-cap" class="secondary small">换一张</button></div><label>图形验证码<input id="captcha" autocomplete="off" maxlength="8"></label><button id="send-sms" class="secondary full">发送短信验证码</button><label>短信验证码<input id="sms" inputmode="numeric" autocomplete="one-time-code" maxlength="8"></label><button id="ry-login" class="primary full">登录并保存</button><div id="ry-error" class="error" hidden></div>`);
 const fail=e=>{if($('ry-error')){$('ry-error').textContent=e.message;$('ry-error').hidden=false;}};
 const load=async()=>{try{const {json:j}=await ryll(null,'/api/user/vcode');cap=j.data||j;let src=cap.base64Img;if(!src)throw Error('验证码返回缺少图片');if(!src.startsWith('data:image/'))src='data:image/png;base64,'+src;if($('captcha-img'))$('captcha-img').src=src;}catch(e){fail(e);}};
 $('reload-cap').onclick=load;
 let nextSms=0;
 $('send-sms').onclick=async e=>{const b=e.target;b.disabled=true;try{const phone=$('phone').value.trim(),code=$('captcha').value.trim();if(!/^1\d{10}$/.test(phone))throw Error('请输入 11 位手机号');if(!cap?.randValue||!code)throw Error('请填写图形验证码');if(Date.now()<nextSms)throw Error('请等待一分钟后再试');await ryll(null,'/api/loginsendsms?'+query({randValue:cap.randValue,code,username:phone}),{method:'POST',body:''});nextSms=Date.now()+60000;toast('短信已发送');setTimeout(()=>{if($('send-sms'))$('send-sms').disabled=false;},60000);}catch(err){fail(err);b.disabled=false;}};
 $('ry-login').onclick=async e=>{e.target.disabled=true;try{const phone=$('phone').value.trim(),smsCode=$('sms').value.trim();if(!/^1\d{10}$/.test(phone)||!smsCode)throw Error('请填写手机号和短信验证码');const r=await ryll(null,'/api/user/login?'+query({username:phone,flag:2,smsCode}),{method:'POST',body:''});const j=r.json;const token=j.data?.token||(typeof j.data==='string'?j.data:null)||j.token||Object.entries(r.headers||{}).find(([k])=>k.toLowerCase()==='jwt-token')?.[1];requireString(token,'登录 token');await saveCredential('RYLL',{token,extra:{},capturedAt:Date.now()});}catch(err){fail(err);}finally{if($('ry-login'))$('ry-login').disabled=false;}};
 await load();
}
async function refreshCode(p){if(loading.has(p)||!state.credentials[p])return;const cred=state.credentials[p];loading.add(p);delete errors[p];render();
 try{const c=await identity(p,cred);if(cred!==state.credentials[p])return;const image=c.type==='IMAGE_URL'?c.content:await native('code',{text:c.content,type:c.type});if(cred!==state.credentials[p])return;codes[p]={...c,image};const kind=p==='SF'&&cred.extra?.staticSeg?'local':'ok';setAccountHealth(p,cred,kind);recordDiagnostic('identity',{platform:p,kind});await persist();}catch(e){if(cred===state.credentials[p]){errors[p]=e.message;const kind=failureKind(e);setAccountHealth(p,cred,kind);recordDiagnostic('identity',{platform:p,kind});}}finally{loading.delete(p);render();}}

async function refresh(){if(busy||completing)return;busy=true;$('refresh').classList.add('busy');
 try{const ps=Object.keys(state.credentials);if(!ps.length){toast('请先登录一个平台');return;}if(tab==='express'){for(const p of ps){const cred=state.credentials[p];try{const items=await express(p,cred);if(state.credentials[p]!==cred)continue;state.cache[p]={items:items.filter(x=>!locallyPicked(p,x.no)),at:Date.now()};}catch(e){if(state.credentials[p]!==cred)continue;state.cache[p]={...state.cache[p],error:e.message};}render();}await persist();}else for(const p of ps)await refreshCode(p);}catch(e){toast(e.message);}finally{busy=false;$('refresh').classList.remove('busy');}}
$('refresh').onclick=refresh;
$('tabs').querySelectorAll('button').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;$('tabs').querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));render();window.scrollTo(0,0);});
setInterval(()=>{if(!document.hidden&&state.auto&&tab==='identity'&&!busy&&$('modal').hidden)refresh();},180000);
setInterval(()=>{if(tab==='identity'&&!loading.size&&Object.values(codes).some(c=>c.expires&&c.expires<=Date.now()))render();},30000);
(async()=>{try{const data=await native('load');state={credentials:{},cache:{},...data};hydrateEnhancements();render();if(Object.keys(state.credentials).length&&Date.now()-(Number(state.updateCheckedAt)||0)>86400000)setTimeout(()=>checkUpdates(true),1500);}catch(e){render();toast(e.message);}})();
