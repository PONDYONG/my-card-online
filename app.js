(()=>{'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,k=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[k]));
const cards=globalThis.Duel;
let peer=null,conn=null,role='',game=null,state=null,selection=null,room='',locked=false;
const TURN_MS=90000;let turnDeadline=0,turnRemaining=TURN_MS,turnIdentity='',timerBusy=false,guestDeadline=0,turnTicker=null;
let guestToken=sessionStorage.getItem('mycard-token')||randomToken(),authorizedToken=null,retryTimer=null,retryCount=0,resultShown=false,connectTimer=null;
function randomToken(){const bytes=new Uint8Array(20);crypto.getRandomValues(bytes);return Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');}
sessionStorage.setItem('mycard-token',guestToken);
const save=()=>{if(!room)return;try{sessionStorage.setItem('mycard-session',JSON.stringify({role,room,game:role==='host'?game:null,state:role==='guest'?state:null,authorizedToken,guestToken,turnRemaining:role==='host'?(turnDeadline?Math.max(0,turnDeadline-Date.now()):turnRemaining):null,turnIdentity,deck:chosenDeck(),name:name()}));}catch(e){}};
const reconnectUI=(visible,t='กำลังเชื่อมต่อใหม่...')=>{$('reconnectNotice').classList.toggle('hidden',!visible);$('reconnectText').textContent=t;};
const online=()=>!!conn?.open;
function updateClock(){const el=$('turnClock');if(!el)return;const active=!!state&&state.winner===null;const left=role==='host'?turnDeadline-Date.now():guestDeadline-Date.now();const seconds=Math.max(0,Math.ceil(left/1000));el.textContent=active?(online()?`⏳ เวลาต่อเทิร์น ${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`:'⏸️ หยุดเวลา — รอเชื่อมต่อ'):'⏳ 01:30';el.classList.toggle('clock-warning',active&&online()&&seconds<=15);}
function ensureHostClock(){if(role!=='host'||!game||game.winner!==null)return;const identity=game.turnCount+':'+game.turn;if(identity!==turnIdentity){turnIdentity=identity;turnDeadline=Date.now()+TURN_MS;turnRemaining=TURN_MS;}else if(!turnDeadline){turnDeadline=Date.now()+Math.max(0,turnRemaining);}}
function pauseHostClock(){if(role==='host'&&turnDeadline){turnRemaining=Math.max(0,turnDeadline-Date.now());turnDeadline=0;}updateClock();}
function resumeHostClock(){if(role==='host'&&game){turnDeadline=Date.now()+Math.max(0,turnRemaining);sync();}}
function timerTick(){updateClock();if(role!=='host'||!game||game.winner!==null||!online()||!turnDeadline||timerBusy||Date.now()<turnDeadline)return;timerBusy=true;const player=game.turn;msg('⏰ หมดเวลา! ระบบจบเทิร์นอัตโนมัติ');if(game.drawPending){const draw=cards.act(game,player,{type:'draw'});if(!draw.ok){timerBusy=false;return;}}const end=cards.act(game,player,{type:'end'});if(end.ok){selection=null;sync();}timerBusy=false;}
turnTicker=setInterval(timerTick,250);

function scheduleRetry(){if(retryTimer||state?.winner!==null&&state?.winner!==undefined)return;reconnectUI(true);retryTimer=setTimeout(()=>{retryTimer=null;retryCount++;if(role==='guest')rejoin();else if(role==='host')restoreHostPeer();},Math.min(1500*retryCount,7000));}
function rejoin(){if(role!=='guest'||!room)return;if(peer&&!peer.destroyed){try{peer.destroy()}catch(e){}}peer=null;badge('🟠 กำลังกลับเข้าห้อง');try{peer=new Peer({debug:0});peer.on('open',()=>attach(peer.connect('arcane-duel-'+room.toLowerCase(),{reliable:true})));peer.on('error',()=>scheduleRetry());peer.on('disconnected',()=>scheduleRetry());}catch(e){scheduleRetry();}}
function restoreHostPeer(){if(role!=='host'||!room)return;if(peer&&!peer.destroyed){try{peer.destroy()}catch(e){}}peer=null;badge('🟠 กำลังเปิดห้องเดิม');try{peer=new Peer('arcane-duel-'+room.toLowerCase(),{debug:0});peer.on('open',()=>{badge('🟠 รอเพื่อนกลับมา');reconnectUI(!!game,'ห้องเดิมพร้อมแล้ว กำลังรอเพื่อนกลับเข้ามา');retryCount=0;});peer.on('connection',c=>{if(conn?.open){c.on('open',()=>{c.send({type:'reject'});c.close()});return;}attach(c)});peer.on('error',()=>scheduleRetry());peer.on('disconnected',()=>{if(!peer.destroyed)try{peer.reconnect()}catch(e){scheduleRetry()}});}catch(e){scheduleRetry();}}

const name=()=>($('name').value.trim()||'ผู้ท้าดวล').slice(0,24), chosenDeck=()=>$('deck').value;
const status=s=>{$('lobbyStatus').textContent=s;};
const msg=s=>{$('actionMsg').textContent=s;};
const badge=(s,live=false)=>{$('connectionBadge').textContent=s;$('connectionBadge').classList.toggle('live',live);};
const randomCode=()=>{const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',b=new Uint8Array(8);crypto.getRandomValues(b);return [...b].map(v=>a[v%a.length]).join('');};
const validCode=s=>String(s).toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,12);
const urlFor=code=>{const u=new URL(location.href);u.searchParams.set('room',code);u.hash='';return u.href;};
const peerError=e=>{const m=e?.type||e?.message||'unknown';status('เชื่อมต่อไม่สำเร็จ: '+m+' — ลองสร้างห้องใหม่ หรือสลับเครือข่าย Wi-Fi/มือถือ');badge('🔴 ขัดข้อง');if((role==='host'&&game)||(role==='guest'&&state))scheduleRetry();else {locked=false;if(role==='guest'){closePeer();role='';room='';sessionStorage.removeItem('mycard-session');}}};
const closePeer=()=>{clearTimeout(connectTimer);connectTimer=null;if(retryTimer){clearTimeout(retryTimer);retryTimer=null;}if(conn){try{conn.close()}catch(e){}conn=null;}if(peer){try{peer.destroy()}catch(e){}peer=null;}};
function attach(c){
 conn=c;
 c.on('open',()=>{setTimeout(()=>window.mycardProfileConnected?.(),150);window.dispatchEvent(new Event('mycard:chat-status'));clearTimeout(connectTimer);connectTimer=null;badge('🟢 เพื่อนออนไลน์',true);reconnectUI(false);retryCount=0;if(role==='host'&&game)resumeHostClock();save();if(role==='guest'){status('เข้าห้องสำเร็จ กำลังซิงก์เกม...');c.send({type:'hello',deck:chosenDeck(),name:name(),token:guestToken,customDeck:window.mycardGetDeck?.(chosenDeck())});}});
 c.on('data',data=>{
  if(!data||typeof data!=='object')return;
  if(data.type==='player-profile'){window.mycardReceiveProfile?.(data.profile);return;}
  if(data.type==='chat'){const t=String(data.text||'').trim().slice(0,250);if(t)window.dispatchEvent(new CustomEvent('mycard:chat',{detail:{text:t,from:'friend'}}));return;}
  if(role==='host'){
    if(data.type==='hello'&&game){if(data.token&&data.token===authorizedToken){status('เพื่อนกลับเข้าเกมแล้ว');sync();}else {c.send({type:'reject'});c.close();}}else if(data.type==='hello'&&!game){
      if(!globalThis.DUEL_DECKS[data.deck]){status('เพื่อนเลือกเด็คไม่ถูกต้อง');return;}
      authorizedToken=String(data.token||'');game=cards.newGame([chosenDeck(),data.deck],[name(),String(data.name||'เพื่อน').slice(0,24)],[window.mycardGetDeck?.(chosenDeck()),data.customDeck]);save();
      status('เริ่มดวลแล้ว!');sync();
    }else if(data.type==='action'&&game&&authorizedToken){processAction(1,data.action);}
  }else if(role==='guest'){
    if(data.type==='state'&&data.state){state=data.state;guestDeadline=Date.now()+Math.max(0,Number(data.remainingTurnMs)||0);showArena();save();render();reconnectUI(false);updateClock();}
    if(data.type==='reject'){status('ห้องเต็ม ลองห้องอื่น');closePeer();}
    if(data.type==='error'){msg(String(data.message||'คำสั่งไม่สำเร็จ').slice(0,120));}
  }
 });
 c.on('close',()=>{window.dispatchEvent(new Event('mycard:chat-status'));if(conn!==c)return;conn=null;badge('🔴 เพื่อนออฟไลน์');if(game||state){pauseHostClock();msg('หยุดเกมชั่วคราว รอเชื่อมต่อกลับมา');reconnectUI(true,'การดวลถูกพักไว้ รอเพื่อนกลับเข้าห้องเดิม');if(role==='guest')scheduleRetry();}else {status('การเชื่อมต่อขาด กำลังลองใหม่');scheduleRetry();}});
 c.on('error',peerError);
}
window.mycardSendChat=function(text){if(!conn?.open)return false;const t=String(text||'').trim().slice(0,250);if(!t)return false;try{conn.send({type:'chat',text:t});return true;}catch(e){return false;}};
window.mycardChatOnline=()=>!!conn?.open;
window.mycardSendProfile=p=>{if(!conn?.open)return false;conn.send({type:'player-profile',profile:p});return true;};
function create(){
 if(locked)return;locked=true;closePeer();role='host';room=randomCode();game=null;authorizedToken=null;save();
 $('invite').classList.remove('hidden');$('joinBox').classList.add('hidden');$('roomCode').textContent=room;$('inviteLink').textContent=urlFor(room);status('กำลังสร้างห้อง...');badge('🟡 กำลังเชื่อมต่อ');
 try{
  peer=new Peer('arcane-duel-'+room.toLowerCase(),{debug:0});
  peer.on('open',()=>{status('สร้างห้องสำเร็จ! ส่งลิงก์ให้เพื่อน แล้วรอเพื่อนเข้ามา');badge('🟠 รอเพื่อนออนไลน์');});
  peer.on('connection',c=>{if(conn&&conn.open){c.on('open',()=>{c.send({type:'reject'});c.close();});return;}attach(c);});
  peer.on('error',peerError);peer.on('disconnected',()=>{badge('🟠 สัญญาณขัดข้อง');status('ขาดการเชื่อมต่อกับเซิร์ฟเวอร์สัญญาณ');});
 }catch(e){peerError(e);}
}
function join(){
 if(locked)return;closePeer();room=validCode($('roomInput').value);if(room.length<6){status('กรอกรหัสห้องอย่างน้อย 6 ตัวอักษร');return;}
 locked=true;role='guest';save();status('กำลังเชื่อมต่อห้อง '+room+' ...');badge('🟡 กำลังเข้าห้อง');$('invite').classList.add('hidden');
 try{
  peer=new Peer({debug:0});
  peer.on('open',()=>{
   const c=peer.connect('arcane-duel-'+room.toLowerCase(),{reliable:true});attach(c);
  });peer.on('error',peerError);peer.on('disconnected',()=>{badge('🟠 สัญญาณขัดข้อง');});
 }catch(e){peerError(e);}
}
function showArena(){$('setup').classList.add('hidden');$('arena').style.display='block';}
function sync(){if(!game)return;ensureHostClock();state=cards.project(game,0);save();showArena();render();updateClock();if(conn?.open){const projected=cards.project(game,1);projected.remainingTurnMs=Math.max(0,turnDeadline-Date.now());conn.send({type:'state',state:projected});}}
function processAction(p,a){
 if(!game||!online())return;
 const out=cards.act(game,p,a);
 if(!out.ok){const txt=String(out.error||'ไม่สามารถทำรายการได้');if(p===1&&conn?.open)conn.send({type:'error',message:txt});else msg(txt);return;}
 selection=null;msg('');sync();
}
function sendAction(a){
 if(!state||state.winner!==null)return;if(!online()){msg('รอเพื่อนเชื่อมต่อกลับมาก่อน');return;}
 if(state.you!==state.turn){msg('ยังไม่ถึงเทิร์นของคุณ');return;}
 if(role==='host')processAction(0,a);
 else if(conn?.open){conn.send({type:'action',action:a});msg('ส่งคำสั่งแล้ว...');}
 else msg('ยังไม่ได้เชื่อมต่อกับเพื่อน');
}
const icons={RM01:'📜',RM02:'🐲',RM03:'🌙',RM04:'🛡️',RM05:'⚡',RM06:'⚔️',RM07:'🐉',RM08:'👑',RM09:'🔥',RM10:'🌀',RM11:'📖',RM12:'🛡️',RM13:'⚡',CP01:'💌',CP02:'🏹',CP03:'💗',CP04:'🪽',CP05:'🌹',CP06:'🛡️',CP07:'👸',CP08:'👑',CP09:'💘',CP10:'🌸',CP11:'🪽',CP12:'🌷',CP13:'🧵'};
const effect=id=>cards.val(id).effect_th;
function cardHTML(obj,where,owner,selectable=true){
 const c=cards.val(obj.id);if(!c)return '';
 const stats=c.type==='monster'?cards.viewStats(state,owner,obj):null;
 const active=selection&&selection.uid===obj.uid&&selection.where===where;
 const badge=c.type==='monster'?`<div class="star">${'★'.repeat(c.level)} ${obj.pos==='def'?'🛡️':''}</div>`:`<div class="star">${c.type==='spell'?'✨ เวทมนตร์':'🛡️ กับดัก'}</div>`;
 const statLine=stats?`<div class="stats"><span>ATK ${stats.atk}</span><span>DEF ${stats.def}</span></div>`:'<div class="stats">เอฟเฟกต์พิเศษ</div>';
 const stateText=obj.attacked?'โจมตีแล้ว':obj.frozenTurn===state.turnCount?'ห้ามโจมตี':'';
 const attr=selectable?`data-select="${where}" data-uid="${esc(obj.uid)}"`:'disabled';
 return `<button type="button" class="tcg ${obj.id.startsWith('CP')?'cupid':''} ${c.type} ${obj.pos==='def'?'defense':''} ${active?'active':''}" ${attr} title="${esc(effect(obj.id))}">${badge}<div class="art" aria-hidden="true"><img src="./art/${obj.id}.webp" alt="" loading="lazy" onerror="this.style.display='none'"></div><div class="cname">${esc(c.name)}</div>${statLine}<span class="status">${esc(stateText)}</span></button>`;
}
function fieldHTML(field,key,owner){return Array.from({length:6},(_,i)=>field[i]?cardHTML(field[i],key,owner,key==='myfield'):'<div class="slot">ว่าง</div>').join('');}
function optionList(arr){return arr.map(o=>`<option value="${esc(o.uid)}">${esc(cards.val(o.id).name)}</option>`).join('');}
function selectedPanel(){
 const panel=$('selected');panel.innerHTML='';panel.classList.add('hidden');
 if(!selection||!state)return;
 const me=state.players[state.you],them=state.players[1-state.you];
 const list=selection.where==='hand'?me.hand:me.field;
 const cobj=list?.find(z=>z.uid===selection.uid);if(!cobj){selection=null;return;}
 const def=cards.val(cobj.id),yourTurn=state.turn===state.you&&state.winner===null;
 const main=yourTurn&&state.phase==='main',battle=yourTurn&&state.phase==='battle';
 let opts='',buttons='';
 if(selection.where==='hand'){
  if(def.type==='monster'){
   const tribute=def.level>=7?2:def.level>=5?1:0;
   const enabled=main&&me.field.length>=tribute&&me.field.length<6;
   const reason=tribute?`ต้องสังเวย ${tribute} ตัว (ระบบเลือกตัวพลังโจมตีต่ำสุดอัตโนมัติ)`:'ไม่ต้องสังเวย';
   opts=`<div class="muted">${reason}</div>`;
   buttons=`<button class="primary" data-do="summon" data-pos="atk" ${enabled?'':'disabled'}>⚔️ อัญเชิญโจมตี</button><button class="secondary" data-do="summon" data-pos="def" ${enabled?'':'disabled'}>🛡️ อัญเชิญป้องกัน</button>`;
  }else if(def.type==='trap'){
   buttons=`<button class="pink" data-do="set" ${main&&me.traps.length<3?'':'disabled'}>🔮 วางกับดักคว่ำ</button>`;
  }else {
   let choices=null;
   if(def.id==='RM09')choices=me.field;
   if(def.id==='CP09')choices=them.field;
   if(def.id==='RM10'||def.id==='CP11')choices=me.hand.filter(t=>t.uid!==cobj.uid&&cards.val(t.id).type==='monster'&&cards.val(t.id).level<=4&&me.field.length<6);
   if(def.id==='RM11')choices=me.grave.filter(t=>cards.val(t.id).type==='monster'&&cards.val(t.id).level<=4);
   if(choices)opts=`<label class="small" for="targetSelect">เป้าหมายของเวทมนตร์</label><select id="targetSelect">${optionList(choices)}</select>`;
   buttons=`<button class="primary" data-do="spell" ${main&&(!choices||choices.length)?'':'disabled'}>✨ ใช้เวทมนตร์</button>`;
  }
 }else {
  if(def.id==='RM07')buttons+=`<button class="secondary" data-do="ability" ${main&&me.hand.length&&them.traps.length&&cobj.usedAbilityTurn!==state.turnCount?'':'disabled'}>⚡ ทำลายกับดัก (ทิ้งการ์ด)</button>`;
  if(cobj.pos==='atk'){
   const targets=them.field;
   if(targets.length)opts=`<label class="small" for="targetSelect">เลือกมอนสเตอร์เป้าหมาย</label><select id="targetSelect">${optionList(targets)}</select>`;
   const enabled=battle&&!cobj.attacked&&cobj.frozenTurn!==state.turnCount&&(!me.noDirect||targets.length);
   buttons+=`<button class="primary" data-do="attack" ${enabled?'':'disabled'}>⚔️ ${targets.length?'โจมตีเป้าหมาย':'โจมตีโดยตรง'}</button>`;
  }
 }
 panel.innerHTML=`<div><strong>${esc(def.name)}</strong><span class="mini"> · ${def.type==='monster'?'เลเวล '+def.level:def.type==='spell'?'เวทมนตร์':'กับดัก'}</span></div><div class="effect">${esc(def.effect_th)}</div>${opts}<div class="buttons">${buttons}</div>`;
 panel.classList.remove('hidden');
}
function render(){
 if(!state)return;
 const previousLog=window.__mycardLastLog;const newest=state.log?.[0]||'';window.__mycardLastLog=newest; if(previousLog!==undefined&&newest!==previousLog)window.dispatchEvent(new CustomEvent('mycard:log',{detail:{message:newest,gameState:state}}));
 window.__mycardVisibleState=state;
 const me=state.players[state.you], them=state.players[1-state.you];
 $('myName').textContent='🫵 '+me.name+' · '+me.deckName;$('enemyName').textContent='🎭 '+them.name+' · '+them.deckName;
 $('myLP').textContent=me.lp+' LP';$('enemyLP').textContent=them.lp+' LP';
 $('myCount').textContent='เด็ค '+me.deckCount+' • มือ '+me.handCount;
 $('enemyCount').textContent='เด็ค '+them.deckCount+' • มือ '+them.handCount;
 $('myGrave').textContent='สุสาน '+me.graveCount;$('enemyGrave').textContent='สุสาน '+them.graveCount;
 $('handCounter').textContent=me.handCount+' ใบ';
 $('turnLabel').textContent=state.winner===null?(state.turn===state.you?'✅ เทิร์นของคุณ':'⌛ เทิร์นฝ่ายตรงข้าม'):'🏁 จบการแข่งขัน';
 $('phaseLabel').textContent='เทิร์น '+state.turnCount+' · '+(state.phase==='main'?'Main Phase':'Battle Phase');
 $('battleButton').disabled=state.winner!==null||state.turn!==state.you||state.phase!=='main'||state.turnCount===1;
 $('endButton').disabled=state.winner!==null||state.turn!==state.you||!!state.drawPending;
 $('drawPile').disabled=state.winner!==null||state.turn!==state.you||!state.drawPending;
 $('drawPile').classList.toggle('ready',!$('drawPile').disabled);
 $('pileCount').textContent=me.deckCount+' ใบ';
 $('drawHint').textContent=state.drawPending&&state.turn===state.you?'✨ กดจั่ว 1 ใบ':'จั่วแล้ว / รอเทิร์น';
 $('enemyField').innerHTML=fieldHTML(them.field,'enemyfield',1-state.you);
 $('myField').innerHTML=fieldHTML(me.field,'myfield',state.you);
 $('enemyTraps').innerHTML=Array.from({length:3},(_,i)=>i<them.traps.length?'<span class="backcard" title="กับดักคว่ำ"></span>':'<span class="backcard" style="opacity:.2"></span>').join('');
 $('myTraps').innerHTML=Array.from({length:3},(_,i)=>me.traps[i]?`<span class="backcard" title="${esc(cards.val(me.traps[i].id).name)}"></span>`:'<span class="backcard" style="opacity:.2"></span>').join('');
 $('hand').innerHTML=me.hand.map(z=>cardHTML(z,'hand',state.you)).join('')||'<span class="muted">ไม่มีการ์ดบนมือ</span>';
 $('logs').innerHTML=state.log.map(x=>`<li>${esc(x)}</li>`).join('');
 if(state.winner!==null){window.mycardMatchEnded?.(state,room);if(!resultShown){resultShown=true;const won=state.winner===state.you;const title=$('resultTitle');title.textContent=state.winner==='draw'?'DRAW':won?'WIN':'LOSS';title.classList.toggle('loss',!won);$('resultDetail').textContent=state.winner==='draw'?'การแข่งขันเสมอ':won?'ยินดีด้วย! คุณชนะการดวล':'จบการแข่งขัน คุณแพ้ในการดวล';$('resultOverlay').classList.remove('hidden');}$('endBanner').classList.remove('hidden');$('endBanner').textContent=state.winner==='draw'?'🤝 เสมอ!':state.winner===state.you?'🏆 คุณชนะแล้ว!':'💔 คุณแพ้ในการดวล';}
 else $('endBanner').classList.add('hidden');
 selectedPanel();
 if(previousLog!==undefined&&newest!==previousLog&&newest.includes('⚔️')){
  const fx=$('attackFx');fx.classList.remove('play');void fx.offsetWidth;fx.classList.add('play');
  const attacker=$('myField').querySelector('.tcg:not(.defense)')||$('enemyField').querySelector('.tcg:not(.defense)');
  if(attacker){attacker.classList.add('striking');setTimeout(()=>attacker.classList.remove('striking'),720);}
 }
}
$('resultClose').addEventListener('click',()=>$('resultOverlay').classList.add('hidden'));$('resultRestart').addEventListener('click',()=>{sessionStorage.removeItem('mycard-session');location.href=location.pathname;});$('retryConnect').addEventListener('click',()=>{if(role==='guest')rejoin();else if(role==='host')restoreHostPeer();});$('create').addEventListener('click',create);
$('joinTab').addEventListener('click',()=>{$('joinBox').classList.toggle('hidden');$('invite').classList.add('hidden');});
$('join').addEventListener('click',join);
$('copy').addEventListener('click',async()=>{const u=urlFor(room);try{await navigator.clipboard.writeText(u);status('คัดลอกลิงก์สำเร็จ ส่งให้เพื่อนได้เลย!');}catch(e){window.prompt('คัดลอกลิงก์นี้',u);}});
$('drawPile').addEventListener('click',()=>sendAction({type:'draw'}));
$('battleButton').addEventListener('click',()=>sendAction({type:'battle'}));
$('endButton').addEventListener('click',()=>sendAction({type:'end'}));
$('arena').addEventListener('click',e=>{
 const card=e.target.closest('[data-select]');
 if(card){selection={where:card.dataset.select,uid:card.dataset.uid};msg('');render();return;}
 const btn=e.target.closest('[data-do]');if(!btn||!selection)return;
 const which=btn.dataset.do,sel=$('targetSelect');const a={type:which,uid:selection.uid};
 if(which==='summon')a.pos=btn.dataset.pos;
 if(which==='spell'||which==='attack')a.target=sel?.value||null;
 sendAction(a);
});
const saved=(()=>{try{return JSON.parse(sessionStorage.getItem('mycard-session')||'null')}catch(e){return null}})();
if(saved?.room&&['host','guest'].includes(saved.role)&&(saved.role==='host'||!!saved.state)&&(!new URL(location.href).searchParams.get('room')||new URL(location.href).searchParams.get('room')===saved.room)){
 role=saved.role;room=saved.room;game=saved.role==='host'?saved.game:null;state=saved.role==='guest'?saved.state:null;authorizedToken=saved.authorizedToken||null;turnRemaining=Number.isFinite(saved.turnRemaining)?Math.max(0,saved.turnRemaining):TURN_MS;turnIdentity=saved.turnIdentity||'';guestToken=saved.guestToken||guestToken;locked=true;
 $('deck').value=saved.deck||chosenDeck();$('name').value=saved.name||name();
 if(role==='host'){$('invite').classList.remove('hidden');$('roomCode').textContent=room;$('inviteLink').textContent=urlFor(room);restoreHostPeer();}
 else rejoin();
 if(game||state){if(role==='host')state=cards.project(game,0);showArena();render();reconnectUI(true,'กำลังกลับเข้าห้องเดิม...');}
}
const code=new URL(location.href).searchParams.get('room');
if(code&&!locked){$('joinBox').classList.remove('hidden');$('roomInput').value=validCode(code);status('ได้รับคำเชิญแล้ว! เลือกเด็คและกด “เข้าห้องและเริ่มดวล”');}
if(!locked&&saved?.role==='guest'&&!saved.state){sessionStorage.removeItem('mycard-session');}
if(typeof Peer==='undefined'){status('โหลดระบบเชื่อมต่อไม่สำเร็จ ต้องใช้อินเทอร์เน็ตและอนุญาตโหลดสคริปต์ PeerJS');$('create').disabled=true;$('join').disabled=true;}
window.addEventListener('beforeunload',()=>closePeer());
})();
