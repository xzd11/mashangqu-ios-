const vm=require('vm'),fs=require('fs'),path=require('path'),assert=require('assert');
function setup(handler){const c={window:{},setTimeout,clearTimeout,crypto:require('crypto').webcrypto};vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'web/core.js'),'utf8'),c);c.fixture=handler;vm.runInContext('mtop=(cred,api,data)=>fixture(api,data)',c);return input=>vm.runInContext(`queryCainiaoPickup({token:'test-cookie'},${JSON.stringify(input)})`,c);}
const no='YT1234567890',list=packages=>({data:{data:{stationPackageAssembleList:packages.length?[{stationMessageDTO:{stationName:'学校菜鸟'},groupList:[{certainPickupWaybillList:packages}]}]:[]}}}),search=packages=>({data:{data:{pkgResultResps:[{certainPickupWaybillList:packages}]}}});
(async()=>{
 let calls=[];let run=setup((api,data)=>{calls.push({api,data});return list([{waybillNo:no,pickupCode:'22-5-7603',status:'3',pickedWaybill:true}]);});let r=await run(' yt1234567890 ');assert.equal(r.status,'found');assert.equal(r.code,'22-5-7603');assert.equal(r.no,no);assert.equal(calls.length,1);
 let searched=false;calls=[];run=setup((api,data)=>{calls.push({api,data});if(api.endsWith('multiOneSearch')){searched=true;assert.equal(data.searchValue,no);return search([{waybillNo:no,status:'3',pickedWaybill:true,pickupCode:'***'}]);}return searched?list([{waybillNo:no,pickupCode:'88-1-2',status:'3'}]):list([]);});r=await run(no);assert.equal(r.code,'88-1-2');assert.equal(calls.length,3);
 run=setup(api=>api.endsWith('multiOneSearch')?search([{waybillNo:no,status:'3',pickedWaybill:true,pickupCode:'***'}]):list([]));r=await run(no);assert.equal(r.status,'masked');assert(!r.code);
 run=setup(api=>api.endsWith('multiOneSearch')?search([{waybillNo:no,status:'4',pickedWaybill:false,pickupCode:'bad-code'}]):list([]));assert.equal((await run(no)).status,'picked');
 run=setup(api=>api.endsWith('multiOneSearch')?search([{waybillNo:'OTHER1234',status:'3',pickupCode:'secret'}]):list([]));assert.equal((await run(no)).status,'not_found');
 run=setup(api=>{if(api.endsWith('multiOneSearch'))throw Error('FAIL_BIZ_waybill-5047');return list([]);});assert.equal((await run(no)).status,'not_found');
 run=setup(()=>{throw Error('登录已失效');});await assert.rejects(run(no),/登录已失效/);
 let count=0;run=setup(()=>{count++;return list([]);});await assert.rejects(run('<script>'),/快递运单号/);assert.equal(count,0);
 run=setup((api,data)=>{count++;return list([{waybillNo:no,pickupCode:'***'}]);});r=await run(no);assert.equal(r.status,'masked');assert(!r.code);
 console.log('Pickup query fixtures passed: direct hit, fallback, masked, picked, exact match, not found, auth failure, validation');
})().catch(e=>{console.error(e);process.exit(1)});
