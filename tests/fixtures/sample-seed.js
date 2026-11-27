
/* SAMPLE DATA BUILD: fills a brand-new browser with demo data. Does nothing if any Tracker data already exists. */
(function(){try{
if(localStorage.getItem('goal-tracker.v1')||localStorage.getItem('tally:app:v1')||localStorage.getItem('tally:books:v1'))return;
var now=new Date(),Y=now.getFullYear(),iso=function(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
var ago=function(n){var d=new Date(now);d.setDate(d.getDate()-n);return iso(d);},ahead=function(n){return ago(-n);};
var seed=1;var rnd=function(){seed=(seed*9301+49297)%233280;return seed/233280;};
var uid=function(p){return p+Math.random().toString(36).slice(2,8);};
/* ---- Goals ---- */
var G=function(cat,name,unit,total,base,end,status,tgt,logs,type){return {id:uid('g'),plan:'p1',category:cat,name:name,unit:unit,type:type||'total',total:total,baseline:base,start:Y+'-01-01',end:end,status:status,targets:tgt,logs:logs,focus:(function(o){o[Y]=true;return o;})({}),usesMoney:false};};
var L=function(d,v,n){return {id:uid('l'),date:d,amount:v,note:n||''};};
var goals=[
 G('Financial','Emergency fund','₹',600000,100000,(Y+1)+'-06-30','In Progress',(function(o){o[Y]=450000;return o;})({}),[L(ago(150),50000),L(ago(90),80000),L(ago(30),80000,'Bonus added')]),
 G('Financial','Invest in index funds','₹',1200000,200000,(Y+3)+'-12-31','In Progress',(function(o){o[Y]=700000;return o;})({}),[L(ago(120),60000),L(ago(60),120000)]),
 G('Health','Run 500 km this year','km',500,0,Y+'-12-31','In Progress',(function(o){o[Y]=500;return o;})({}),[L(ago(100),90),L(ago(50),120),L(ago(7),75,'Half marathon')]),
 G('Career','Finish cloud certification','%',100,0,Y+'-12-15','In Progress',(function(o){o[Y]=100;return o;})({}),[L(ago(60),40),L(ago(20),25)]),
 G('Learning','Read 24 books','books',24,0,Y+'-12-31','In Progress',(function(o){o[Y]=24;return o;})({}),[L(ago(80),8),L(ago(10),7)]),
 G('Family','Family trip','trip',1,0,(Y+1)+'-05-31','Not Started',(function(o){o[Y+1]=1;return o;})({}),[]),
 G('Personal','Daily meditation habit','days',365,0,Y+'-12-31','In Progress',(function(o){o[Y]=365;return o;})({}),[L(ago(14),210)],'level')
];
/* ---- To-dos ---- */
var T=function(text,due,o){o=o||{};return {id:uid('t'),text:text,done:!!o.done,doneAt:o.done?Date.now()-86400000:null,due:due||null,time:o.time||'',repeat:o.repeat||'',est:o.est||0,notes:o.notes||'',rem:o.rem||0,subs:o.subs||[],tags:o.tags||[],goalId:o.goal||null,category:o.cat||'',created:Date.now()-Math.floor(rnd()*9e8)};};
goals[5].start=(Y+1)+'-01-01';
var todos=[
 T('Pay electricity bill',ago(1),{cat:'Home',time:'10:00'}),T('Renew car insurance',ahead(0),{cat:'Finance',time:'18:00',rem:60,tags:['t1']}),
 T('Book dentist appointment',ahead(2),{cat:'Health'}),T('Team sprint review prep',ahead(1),{cat:'Work',est:45,subs:[{id:uid('s'),t:'Collect metrics',d:true},{id:uid('s'),t:'Draft slides',d:false}],tags:['t2']}),
 T('Weekly grocery run',ahead(3),{cat:'Home',repeat:'every 1 weeks'}),T('Call parents',ahead(0),{cat:'Family',time:'20:00'}),
 T('Study cloud cert module 5',ahead(4),{cat:'Learning',est:90,goal:goals[3].id}),T('Review mutual fund SIPs',ahead(9),{cat:'Finance',goal:goals[1].id}),
 T('File expense receipts',ago(4),{cat:'Work'}),T('Water the plants',ago(0),{cat:'Home',done:true}),T('Plan family trip itinerary',null,{cat:'Family',goal:goals[5].id}),
 T('Read 30 pages',ahead(0),{cat:'Learning',goal:goals[4].id,repeat:'every 1 days'}),T('Someday: learn pottery',null,{cat:'Personal',notes:'Look for weekend classes nearby'})
];
var tags=[{id:'t1',name:'Important',color:'#dc2626',note:''},{id:'t2',name:'Work',color:'#2563eb',note:''}];
/* ---- Vault (dummy values) ---- */
var V=function(type,title,extra){var o={id:uid('v'),type:type,title:title,username:'',password:'',totp:'',uris:[],url:'',notes:'',fields:[],history:[],files:[],log:[],folderId:'f1',fav:false,created:Date.now()-5e8,updated:Date.now()-1e8};for(var k in extra)o[k]=extra[k];return o;};
var vault={v:2,folders:[{id:'f1',name:'Personal'},{id:'f2',name:'Work'}],items:[
 V('login','Netflix',{username:'demo.user@example.com',password:'Sunny-Demo-Pass-42!',uris:['https://netflix.com'],url:'https://netflix.com',fav:true}),
 V('login','Office VPN',{username:'demo.employee',password:'abc123',uris:['https://vpn.example.com'],folderId:'f2'}),
 V('login','Spare account',{username:'demo.user@example.com',password:'abc123',folderId:'f2'}),
 V('card','Demo credit card',{card:{holder:'DEMO USER',brand:'Visa',number:'4111111111111111',exp:'12/29',cvv:'123'}}),
 V('wifi','Home Wi-Fi',{f:{ssid:'HomeNet',password:'welcome-home-2026'}}),
 V('note','Locker combination',{notes:'Demo note: nothing real stored here.'})]};
var state={v:2,goals:goals,categories:['Financial','Personal','Career','Health','Family','Learning'],plans:[{id:'p1',age:null,start:Y+'-01-01',end:(Y+6)+'-12-31'}],todos:todos,tags:tags,vault:vault};
localStorage.setItem('goal-tracker.v1',JSON.stringify(state));
/* ---- Money: two books ---- */
var acc=function(n,i,c,o){return {id:uid('a'),name:n,icon:i,color:c,open:o};},cat=function(n,t,i,c){return {id:uid('c'),name:n,type:t,icon:i,color:c};};
var mk=function(accounts,cats,recs,extra){var base={v:1,settings:{theme:'tally',mode:'system',currency:'₹',position:'start',decimals:2,grouping:'indian',notes:true,remind:false,remindTime:'20:00',pin:'',salt:'',lockAfter:30,view:'month',showTotal:true,carry:false,compact:false,hide:false,backupEvery:'monthly'},accounts:accounts,categories:cats,records:recs,budgets:[],recurring:[],sgoals:[],loans:[],presets:[],meta:{lastAccount:accounts[0].id,lastBackup:'',nudgeDay:'',bkNudgeDay:'',firstUse:ago(120)}};for(var k in extra)base[k]=extra[k];return base;};
var R=function(t,a,ac,c,n,d,to){return {id:uid('r'),t:t,a:Math.round(a*100),ac:ac,to:to||'',c:c||'',n:n||'',d:d,tm:String(8+Math.floor(rnd()*12)).padStart(2,'0')+':'+String(Math.floor(rnd()*60)).padStart(2,'0'),cr:Date.now()-Math.floor(rnd()*1e8)};};
/* Job book */
var jb=acc('Bank',"🏦",'#3949AB',50000),jc=acc('Cash','💵','#43A047',3000),jcc=acc('Credit card','💳','#E53935',0);
var jSal=cat('Salary','income','💼','#43A047'),jBon=cat('Bonus','income','🎁','#00897B'),jRent=cat('Rent','expense','🏠','#5E35B1'),jFood=cat('Food','expense','🍽️','#F4511E'),jTr=cat('Transport','expense','🚌','#039BE5'),jBill=cat('Bills','expense','💡','#FDD835'),jShop=cat('Shopping','expense','🛍️','#D81B60'),jFun=cat('Entertainment','expense','🎬','#8E24AA');
var jr=[];
for(var m=0;m<4;m++){var base=m*30;
 jr.push(R('i',85000,jb.id,jSal.id,'Monthly salary',ago(base+Math.max(0,28-now.getDate()+0))));
 jr.push(R('e',22000,jb.id,jRent.id,'House rent',ago(base+(m?0:0))));
 jr.push(R('e',2400+Math.round(rnd()*900),jb.id,jBill.id,'Electricity & internet',ago(base+6)));
 for(var k=0;k<6;k++)jr.push(R('e',180+Math.round(rnd()*900),k%2?jc.id:jcc.id,jFood.id,['Lunch','Groceries','Dinner out','Coffee','Snacks','Takeaway'][k],ago(base+k*4+1)));
 jr.push(R('e',900+Math.round(rnd()*500),jc.id,jTr.id,'Metro card & cabs',ago(base+9)));
 jr.push(R('e',1500+Math.round(rnd()*3500),jcc.id,jShop.id,'Online order',ago(base+12)));
 jr.push(R('e',650,jcc.id,jFun.id,'Movie night',ago(base+15)));}
jr.push(R('i',20000,jb.id,jBon.id,'Performance bonus',ago(40)));
jr.push(R('x',10000,jb.id,'','Move to savings',ago(20),jc.id));
var job=mk([jb,jc,jcc],[jSal,jBon,jRent,jFood,jTr,jBill,jShop,jFun],jr,{budgets:[{id:uid('b'),c:jFood.id,l:1200000,m:''},{id:uid('b'),c:jShop.id,l:300000,m:''}],recurring:[{id:uid('r'),on:true,name:'House rent',a:2200000,c:jRent.id,ac:jb.id,freq:'monthly',next:ahead(6),day:+ahead(6).slice(8),end:'',auto:false}],sgoals:[{id:uid('s'),name:'New laptop',target:90000,contrib:[],icon:'💻'}]});
/* Investment book */
var ib=acc('Brokerage','📈','#3949AB',200000),ibk=acc('Savings','🐷','#D81B60',25000);
var iDiv=cat('Dividends','income','💰','#43A047'),iGain=cat('Capital gains','income','📈','#00897B'),iInt=cat('Interest','income','🏦','#1E88E5'),iBuy=cat('Stock purchase','expense','🛒','#F4511E'),iFee=cat('Brokerage fees','expense','🧾','#8E24AA'),iTax=cat('Tax on gains','expense','🏛️','#6D4C41'),iSip=cat('SIP investment','expense','🔁','#00897B');
var ir=[];
for(var m2=0;m2<4;m2++){var b2=m2*30;
 ir.push(R('e',15000,ibk.id,iSip.id,'Monthly index fund SIP',ago(b2+2)));
 ir.push(R('e',20000+Math.round(rnd()*30000),ib.id,iBuy.id,['Blue-chip shares','ETF units','Bank stock','IT stock'][m2],ago(b2+8)));
 ir.push(R('e',120+Math.round(rnd()*200),ib.id,iFee.id,'Brokerage charges',ago(b2+8)));
 ir.push(R('i',1800+Math.round(rnd()*2200),ib.id,iDiv.id,'Dividend received',ago(b2+14)));
 ir.push(R('i',210+Math.round(rnd()*120),ibk.id,iInt.id,'Savings interest',ago(b2+27)));}
ir.push(R('i',18500,ib.id,iGain.id,'Sold shares at profit',ago(45)));
ir.push(R('e',2775,ib.id,iTax.id,'Short-term gains tax',ago(44)));
var inv=mk([ib,ibk],[iDiv,iGain,iInt,iBuy,iFee,iTax,iSip],ir,{budgets:[{id:uid('b'),c:iBuy.id,l:5000000,m:''}],recurring:[{id:uid('r'),on:true,name:'Monthly index fund SIP',a:1500000,c:iSip.id,ac:ibk.id,freq:'monthly',next:ahead(3),day:+ahead(3).slice(8),end:'',auto:true}],sgoals:[{id:uid('s'),name:'Retirement corpus',target:5000000,contrib:[],icon:'🌴'}]});
try{var jx=job.categories.filter(function(c){return c.type==='expense';});jx.slice(0,2).forEach(function(c){c.pin=true;});
job.recurring=job.recurring||[];
job.recurring.push({id:uid('r'),on:true,name:'Electricity bill',a:180000,c:jx[1].id,ac:job.accounts[0].id,freq:'monthly',next:ahead(2),day:+ahead(2).slice(8),end:'',auto:false,ask:true,note:'Amount changes every month - enter it from the bill'});
job.recurring.push({id:uid('r'),on:true,name:'Flat rent',a:2200000,c:jx[0].id,ac:job.accounts[0].id,freq:'monthly',next:ahead(6),day:+ahead(6).slice(8),end:'',auto:false,note:'Paid to landlord by UPI before the 10th'});}catch(e){}
localStorage.setItem('tally:app:v1',JSON.stringify(job));
localStorage.setItem('tally:book:bdemo',JSON.stringify(inv));
localStorage.setItem('tally:books:v1',JSON.stringify({active:'b1',list:[{id:'b1',name:'Job',key:'tally:app:v1',icon:'\uD83D\uDCBC',color:'#E53935'},{id:'bdemo',name:'Investment',key:'tally:book:bdemo',icon:'\uD83D\uDCC8',color:'#00897B'}]}));
}catch(e){}})();

