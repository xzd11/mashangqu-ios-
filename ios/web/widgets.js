'use strict';
let widgetStatus=null,widgetError='',widgetSelection=null,widgetQueue=Promise.resolve(),widgetLastSync='';
function widgetItems(){
 return mergeItems(Object.entries(state.cache).flatMap(([p,c])=>state.credentials[p]?(c.items||[]).filter(x=>!locallyPicked(p,x.no)):[])).filter(x=>x.status!=='PICKED');
}
function widgetItemKey(x){return JSON.stringify([parcelNo(x.no),x.sources.map(p=>[p,accountScope(p)])]);}
function widgetRow(x,show){
 const supplement=state.credentials.TAOBAO&&x.cainiaoPickup?.accountKey===cainiaoAccountKey(state.credentials.TAOBAO)?x.cainiaoPickup:null;
 return {station:String(x.station||'待取包裹').slice(0,80),code:show?String(supplement?.code||x.pickupCode||'').slice(0,40):''};
}
function widgetPayload(){
 const items=widgetItems(),selected=items.find(x=>widgetItemKey(x)===widgetSelection);
 if(!selected)widgetSelection=null;
 const times=Object.entries(state.cache).filter(([p,c])=>state.credentials[p]&&(c.items||[]).length).map(([,c])=>Number(c.at)||0);
 const updatedAt=times.length?Math.min(...times):Date.now();
 return {count:items.length,rows:items.slice(0,8).map(x=>widgetRow(x,state.widgetShowCodes===true)),showCodes:state.widgetShowCodes===true,
  updatedAt,active:selected?{...widgetRow(selected,true),updatedAt}:null};
}
function widgetCommand(action,payload={}){
 const run=()=>native('widgets',{...payload,action}).then(result=>{if(result?.supported)widgetStatus=result;widgetError='';return result;});
 const result=widgetQueue.catch(()=>{}).then(run);widgetQueue=result.catch(()=>{});return result;
}
async function syncWidgets(payload=widgetPayload(),force=false){
 const key=JSON.stringify(payload);if(!force&&key===widgetLastSync)return;
 try{const status=await widgetCommand('sync',payload);if(status?.supported)widgetLastSync=key;}
 catch(e){widgetError=e.message||'小组件同步失败';}
}
async function refreshWidgetStatus(){
 try{await widgetCommand('status');await syncWidgets(widgetPayload(),true);}catch(e){widgetError=e.message;}
 render();
}
async function startPickupActivity(no){
 if(completing||busy){toast('请等待当前操作完成');return;}
 const x=widgetItems().find(x=>parcelNo(x.no)===parcelNo(no));if(!x)return;
 const previous=widgetSelection;widgetSelection=widgetItemKey(x);
 try{const payload=widgetPayload(),status=await widgetCommand('start',payload);if(!status?.supported)throw Error('当前安装包未包含小组件扩展，请安装 1.2.0 扩展版');widgetLastSync='';await syncWidgets(payload,true);toast('已开始取件，可在灵动岛或锁屏查看');}
 catch(e){widgetSelection=previous;widgetError=e.message;toast(e.message);}
 render();
}
async function endPickupActivity(){
 try{await widgetCommand('end');widgetSelection=null;widgetLastSync='';toast('已结束取件活动');}
 catch(e){widgetError=e.message;toast(e.message);}render();
}
function widgetSettingsCard(){
 const status=widgetStatus;
 return `<section class="card"><h2>灵动岛与桌面小组件</h2><p class="info">桌面小组件显示待取数量与驿站。快递卡片点「开始取件」后，灵动岛和锁屏显示所选包裹的取件码；这会在应用外显示明码。</p><label class="row"><span>桌面小组件显示取件码</span><input id="widget-show-codes" type="checkbox" ${state.widgetShowCodes===true?'checked':''}></label><p class="caption">默认隐藏。开启后取件码将写入本机共享容器，供桌面小组件读取。系统仍可能隐藏敏感内容。</p>${status?`<p class="caption">${status.widgetReady?'小组件共享已就绪':'小组件共享不可用，请检查自签 App Groups 权限'} · ${status.liveSupported?(status.liveEnabled?'实时活动已允许':'实时活动被系统关闭'):'实时活动需要 iOS 16.2+'}</p>`:''}${widgetError?`<p class="error">${esc(widgetError)}</p>`:''}<button id="widget-sync" class="secondary full">检查并同步小组件</button><button id="end-pickup-activity" class="secondary full">结束灵动岛取件活动</button><p class="caption">长按桌面 → 编辑 → 添加小组件 → 码上取。内容来自上次应用内刷新，超过 15 分钟隐藏旧码，请打开 App 更新；后台不会自动请求平台。</p></section>`;
}
function bindWidgets(){
 document.querySelectorAll('[data-start-pickup]').forEach(b=>b.onclick=()=>startPickupActivity(b.dataset.startPickup));
 if($('widget-sync'))$('widget-sync').onclick=refreshWidgetStatus;
 if($('end-pickup-activity'))$('end-pickup-activity').onclick=endPickupActivity;
 if($('widget-show-codes'))$('widget-show-codes').onchange=async e=>{
  const previous=state.widgetShowCodes;state.widgetShowCodes=e.target.checked;
  try{await persist();}catch(error){state.widgetShowCodes=previous;toast(error.message);}render();
 };
}
// No arbitrary URL or JavaScript is accepted from a widget deep link.
window.msqOpenExpress=()=>{tab='express';parcelView='waiting';document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab==='express'));render();window.scrollTo(0,0);};
