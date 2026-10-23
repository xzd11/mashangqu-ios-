'use strict';
// Ported from njpemo/mashangqu PddQrClient (MIT): AUTH_LOGIN, app_id 512.
// Safety checks are completed by the user on PDD's official verification page.
function pddQrPost(path,params){
 const job=async()=>{
  const ac=await antiContent();
  return request('https://mobile.yangkeduo.com/proxy/api/'+path+'?pdduid=0',{
   method:'POST',body:typeof params==='function'?await params(ac):{...params,anti_content:ac},
   headers:{'anti-content':ac,Referer:'https://mobile.yangkeduo.com/login.html'}
  });
 };
 const result=pddQueue.catch(()=>{}).then(job);pddQueue=result;return result;
}
function pddQrError(j){return Error('拼多多扫码登录失败：'+(j.error_msg||j.error_message||'平台未返回有效结果')+'（PDD-'+String(j.error_code??'UNKNOWN')+'）');}
async function pddQrGenerate(){
 const {json:j}=await pddQrPost('api/cupid/query_qr_code',{pdd_biz_scene:'AUTH_LOGIN',scene_data:{app_id:512}});
 if(typeof j.secret_key!=='string'||!j.secret_key||typeof j.data!=='string'||!j.data)throw pddQrError(j);
 if(j.data.length>2500)throw Error('拼多多登录二维码内容过长');
 return {secretKey:j.secret_key,content:j.data};
}
async function pddQrCheck(secretKey){
 const {json:j}=await pddQrPost('api/cupid/login/check_qr_code',{secret_key:secretKey,pdd_biz_scene:'AUTH_LOGIN'});
 if(typeof j.ticket==='string'&&j.ticket)return {status:'confirmed',ticket:j.ticket};
 const code=String(j.error_code??'0');
 if(code==='60020')return {status:'expired'};
 if(code!=='0'&&code!=='60022')throw pddQrError(j);
 return {status:'waiting'};
}
function pddCredential(cookies){
 const token=cookies.PDDAccessToken||cookies.pdd_access_token||cookies.accesstoken;
 if(typeof token!=='string'||!token.trim())throw Error('尚未取得拼多多登录凭据，请完成官方验证后再点「完成登录」');
 return {token,extra:{pdd_user_id:cookies.pdd_user_id||'',pdd_uin:cookies.pdd_user_uin||cookies.pdd_uin||''},capturedAt:Date.now()};
}
async function pddQrAuth(ticket,secretKey,vat=null,status=null){
 const r=await pddQrPost('api/sigerus/auth/ticket',{ticket,secret_key:secretKey,add_cookie:true,...(vat?{verify_auth_token:vat}:{}),...(status!==null?{status}:{} )});
 const cookies=Object.fromEntries((r.cookies||[]).map(c=>[c.name,c.value]));
 if(cookies.PDDAccessToken)return {status:'ok',credential:pddCredential(cookies)};
 const j=r.json;
 if(String(j.error_code)==='54002'&&typeof j.verify_auth_token==='string'&&j.verify_auth_token)return {status:'verify',vat:j.verify_auth_token};
 throw pddQrError(j);
}
function pddQrVerifyURL(s){
 return 'https://mobile.yangkeduo.com/psnl_verification.html?'+query({VerifyAuthToken:s.vat,secret_key:s.secretKey,ticket:s.ticket,from:'qr_code_login'});
}

// Port of the upstream verification envelope. AES keys stay in native memory.
async function pddVerificationClear(ctx){if(ctx?.session)await native('pddCrypto',{action:'clear',session:ctx.session});}
async function pddVerificationDecode(ctx,j){
 if(j?.e===true){
  if(typeof j.content!=='string'||!j.content)throw Error('验证响应缺少加密内容');
  return native('pddCrypto',{action:'decrypt',session:ctx.session,content:j.content});
 }
 return j;
}
function pddVerifyEnvelope(ctx,vat,params){
 return native('pddCrypto',{action:'encrypt',session:ctx.session,data:params}).then(content=>({e:true,verify_auth_token:vat,content}));
}
async function pddVerificationPrepare(vat){
 const ctx=await native('pddCrypto',{action:'new'});
 if(!ctx?.session||!ctx.a||!ctx.v)throw Error('无法创建安全验证会话');
 try{
  const pre=await pddQrPost('api/phantom/vc_pre_ck',async ac=>({
   ...await pddVerifyEnvelope(ctx,vat,{anti_content:ac,sdk_type:1,client_time:Date.now()}),a:ctx.a,v:ctx.v
  }));
  const data=await pddVerificationDecode(ctx,pre.json);
  if(typeof data?.salt!=='string'||!data.salt)throw Error('安全验证预检失败');
  ctx.salt=data.salt;ctx.vat=vat;
  const obtained=await pddQrPost('api/phantom/obtain_captcha',ac=>pddVerifyEnvelope(ctx,vat,{anti_content:ac,verify_auth_token:vat,captcha_collect:'',salt:ctx.salt,wp:false}));
  const captcha=await pddVerificationDecode(ctx,obtained.json);
  if(Number(captcha?.code)!==0)throw Error('无法获取验证类型，请使用官方验证');
  ctx.type=Number(captcha.type);return ctx;
 }catch(e){await pddVerificationClear(ctx).catch(()=>{});throw e;}
}
async function pddVerificationSms(ctx,code){
 if(!/^[0-9]{4,8}$/.test(code))throw Error('请输入短信中的数字验证码');
 const response=await pddQrPost('api/phantom/user_verify',ac=>pddVerifyEnvelope(ctx,ctx.vat,{anti_content:ac,verify_auth_token:ctx.vat,salt:ctx.salt,captcha_collect:'',verify_code:code}));
 const data=await pddVerificationDecode(ctx,response.json);
 if(Number(data?.code)!==0)throw Error('验证码未通过，请核对后重试');
}
function pddVerificationImage(value){
 try{const u=new URL(value);return u.protocol==='https:'&&['pddpic.com','yangkeduo.com','pinduoduo.com'].some(h=>u.hostname===h||u.hostname.endsWith('.'+h));}catch{return false;}
}
async function pddVerificationQuestion(ctx){
 const response=await pddQrPost('api/phantom/challenge_captcha',ac=>pddVerifyEnvelope(ctx,ctx.vat,{anti_content:ac,verify_auth_token:ctx.vat,salt:ctx.salt}));
 const data=await pddVerificationDecode(ctx,response.json);
 if(Number(data?.code)!==0||!data.options||Array.isArray(data.options)||typeof data.options!=='object')throw Error('无法获取验证题，请使用官方验证');
 const options=Object.entries(data.options);
 if(!options.length||options.length>30||options.some(([k,v])=>typeof v!=='string')||!Number.isInteger(Number(data.question_id)))throw Error('验证题格式暂不支持');
 if(options.some(([k,v])=>/^https?:\/\//i.test(v)&&!pddVerificationImage(v)))throw Error('该验证图片需要在官方页面查看');
 const count=Number(data.correct_answer_cnt)||1;
 if(!Number.isInteger(count)||count<1||count>options.length)throw Error('验证题选项数量异常');
 return {id:Number(data.question_id),desc:String(data.question_desc||'请选择正确答案'),count,options};
}
async function pddVerificationAnswer(ctx,q,selected,order){
 if(selected.length!==q.count||new Set(selected).size!==selected.length||selected.some(k=>!q.options.some(([key])=>key===k)))throw Error('请选择 '+q.count+' 个答案');
 const response=await pddQrPost('api/phantom/challenge_verify',{verify_auth_token:ctx.vat,useNativeAntiToken:true,salt:ctx.salt,question_id:q.id,user_options:selected,question_order_number:order});
 const code=Number(response.json?.code);
 if(code!==0&&code!==3002)throw Error('答案提交失败，请稍后重试');
 return code;
}
