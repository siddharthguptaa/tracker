// Re-records tests/fixtures/golden.json from the classic app (legacy/index.html) at a frozen clock.
// Only needed if you intentionally change behaviour: `node scripts/capture-golden.cjs` then review the diff.
// Runs the LEGACY index.html at a frozen clock and records its outputs as golden fixtures for the React port's unit tests.
const {chromium}=require(process.env.PW||'@playwright/test');const fs=require('fs');const SEED=fs.readFileSync('tests/fixtures/sample-seed.js','utf8');const OUT=process.env.OUT||'tests/fixtures/golden.json';
const FIXED='2026-11-26T10:00:00';
const Q=["how much did I spend this month","give me suggestions","forecast this month","what budget should I follow","predict my savings in 1 year","financial health score","any unusual spending","what if I save 5000 more","am I on track with my goals","my subscriptions","spending trends","weekly review","where did my money go this month","what is my balance","can I afford 20000","when will I finish Read 24 books","biggest expense","compare this month with last month","how many todos do I have","hello"];
const ACTQ=["spent 250 on lunch today","add todo call bank tomorrow 5pm","delete last expense","set budget food 8000"];
const QUICK=["buy milk tomorrow","call mom every monday","pay rent on 5th every month #home","gym fri 6pm","review report in 3 days","submit tax docs next week","water plants every 2 days","plain text only"];
const AMTS=["spent 250 on lunch","paid 1,200.50 rent","got 85000 salary","5k for travel","12 lakh","3.5k coffee"],DATES=["today","yesterday","tomorrow","last friday","5 nov","2026-10-01","this month","last month"];
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:390,height:844}});const p=await ctx.newPage();
await p.addInitScript(SEED);await p.addInitScript(`(()=>{const F=new Date('${FIXED}').getTime(),R=Date,o=R.now;let off=F-o.call(R);class D extends R{constructor(...a){if(a.length)super(...a);else super(F)}static now(){return F}}window.Date=D;})();`);
await p.goto('file://'+process.cwd()+'/legacy/index.html');await p.waitForTimeout(1200);
const out=await p.evaluate(({Q,ACTQ,QUICK,AMTS,DATES})=>{
 const strip=h=>String(h).replace(/data-id="[^"]*"/g,'').replace(/id="[^"]*"/g,'');
 const R={today:todayStr(),state:JSON.parse(JSON.stringify(state)),moneyKeys:{}};
 tallyBooks().list.forEach(b=>{R.moneyKeys[b.key]=tallyRaw(b.key)});R.moneyBooks=tallyBooks();
 R.goals=state.goals.map(g=>{const o={id:g.id,name:g.name,type:g.type,current:current(g),pct:pct(g),pctText:pctText(g),expected:expected(g),pace:paceInfo(g),timeLeft:timeLeft(g),forecast:(typeof forecast==='function'?forecast(g):null)};
  if(g.type==='habit')o.habit=habitStats(g);const ol=goalOutlook(g);o.outlook={key:ol.key,like:ol.like,tip:ol.tip,have:ol.have,need:ol.need};return o});
 const O=outlookAll();R.outlookAll={score:O.score,n:O.n,ahead:O.ahead,ontrack:O.ontrack,risk:O.risk,behind:O.behind,stalled:O.stalled,done:O.done,label:outlookLabel(O.score)};
 R.dueLabels=['2026-11-25','2026-11-26','2026-11-27','2026-11-30','2026-12-25'].map(d=>[d,dueLabel(d)]);
 R.quick=QUICK.map(t=>{const q=parseQuick(t);return [t,{text:q.text,due:q.due||null,repeat:q.repeat||'',time:q.time||null,tags:(q.tags||[]).length}]});
 R.amts=AMTS.map(t=>[t,cAmt(t)]);R.dates=DATES.map(t=>[t,cDate(t)]);
 R.replies=Q.map(q=>{let r;try{r=chatRoute(q)}catch(e){r={html:'ERR '+e.message}}return [q,r?strip(r.html):null,r&&r.acts?r.acts.map(a=>a.label):[]]});
 R.actReplies=ACTQ.map(q=>{const r=chatRoute(q);return [q,r?strip(r.html):null,r&&r.acts?r.acts.map(a=>a.label):[]]});
 R.search=['rent','read','2026','book','zzzz','50'].map(q=>{ui.gsIdx=null;const h=gsResults(q);return [q,{goals:(h.match(/data-k="goal"/g)||[]).length,todos:(h.match(/data-k="todo"/g)||[]).length,money:(h.match(/data-k="money"/g)||[]).length,vault:(h.match(/data-k="vault"/g)||[]).length,none:/Nothing found/.test(h)}]});
 return R},{Q,ACTQ,QUICK,AMTS,DATES});
fs.writeFileSync(OUT,JSON.stringify({fixed:FIXED,...out}));
console.log('goals',out.goals.length,'todos',out.state.todos.length,'replies',out.replies.length,'bytes',fs.statSync(OUT).size);await b.close()})();
