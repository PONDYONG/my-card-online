/* ARCANE DUEL: host-authoritative local rules engine, v0.9 */
(()=>{
  'use strict';
  const T = globalThis.DUEL_DECKS;
  const RELICS=['RL01','RL02','RL03','RL04','RL05'];
  function checkRelics(g,p){if(g.winner!==null)return;const x=g.players[p];if(RELICS.every(id=>x.hand.some(c=>c.id===id))){g.winner=p;log(g,'🏆 '+x.name+' รวบรวมตำนานห้าศาสตราครบ 5 ชิ้น ชนะทันที!');}}
  const CARD={};
  for(const d of Object.values(T)) for(const c of d.cards) CARD[c.id]=c;
  let serial=0;
  const make=(id)=>({uid:'c'+(++serial),id});
  const val=(id)=>CARD[id];
  const idx=(a,u)=>a.findIndex(x=>x.uid===u);
  const shuffle=a=>{for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
  const viewStats=(g,p,m)=>{
    const c=val(m.id), friends=g.players[p].field;
    const bonus=c.id==='CP05' && friends.some(x=>x.uid!==m.uid&&x.id.startsWith('CP'))?200:0;
    return {atk:Math.max(0,c.atk+(m.atkMod||0)+bonus),def:Math.max(0,c.def+(m.defMod||0))};
  };
  const log=(g,msg)=>{g.log.unshift(msg);g.log=g.log.slice(0,18);};
  const fail=(msg)=>({ok:false,error:msg});
  const winning=g=>{if(g.players[0].lp<=0&&g.players[1].lp<=0)g.winner='draw'; else if(g.players[0].lp<=0)g.winner=1;else if(g.players[1].lp<=0)g.winner=0;};
  function draw(g,p,n=1){
    const x=g.players[p];let drawn=0;for(let i=0;i<n;i++){
      if(x.deck.length===0){g.winner=1-p;log(g,'เด็คหมด! '+x.name+' ไม่สามารถจั่วได้');return;}
      x.hand.push(x.deck.shift());drawn++;checkRelics(g,p);
    }
    if(drawn)log(g,'🃏 '+x.name+' จั่วการ์ดจากเอฟเฟกต์/กองจั่ว '+drawn+' ใบ');
  }
  function heal(g,p,num){g.players[p].lp=Math.min(4000,g.players[p].lp+num);}
  function grave(g,p,obj){g.players[p].grave.push({uid:obj.uid,id:obj.id});}
  function useTrap(g,p,id){const x=g.players[p], k=idx(x.traps,id);if(k<0)return false;const z=x.traps.splice(k,1)[0];grave(g,p,z);x.usedNames.push(z.id);log(g,'⚡ '+x.name+' เปิดกับดัก '+val(z.id).name);return true;}
  function kill(g,p,uid,isEffect=true){
    const x=g.players[p],i=idx(x.field,uid);if(i<0)return false;const m=x.field[i];
    if(isEffect&&m.id.startsWith('CP')){
      const tr=x.traps.find(z=>z.id==='CP13'&&z.setTurn<g.turnCount&&!x.usedNames.includes('CP13'));
      if(tr){useTrap(g,p,tr.uid);draw(g,p);log(g,'💝 ด้ายแดงช่วยปกป้อง '+val(m.id).name);return false;}
    }
    x.field.splice(i,1);grave(g,p,m);log(g,'💥 '+val(m.id).name+' ถูกทำลาย');return true;
  }
  function special(g,p,obj){
    const x=g.players[p];if(x.field.length>=6)return false;
    const m={...obj,pos:'def',attacked:true,atkMod:0,defMod:0,usedAbilityTurn:0};
    x.field.push(m);log(g,'✨ '+x.name+' อัญเชิญพิเศษ '+val(m.id).name);
    const en=g.players[1-p],trap=en.traps.find(t=>t.id==='RM13'&&t.setTurn<g.turnCount&&!en.usedNames.includes('RM13'));
    if(trap&&viewStats(g,p,m).atk>=2200){useTrap(g,1-p,trap.uid);kill(g,p,m.uid,true);}
    return true;
  }
  function discardLast(g,p){const x=g.players[p];if(x.hand.length){const z=x.hand.shift();grave(g,p,z);log(g,x.name+' ทิ้งการ์ด 1 ใบ');return true;}return false;}
  function summonEffect(g,p,m,tribute){
    const x=g.players[p],enemy=g.players[1-p];
    switch(m.id){
      case 'RM01':{
        const top=x.deck.splice(0,3),i=top.findIndex(q=>val(q.id).type==='monster');
        if(i>=0){const pick=top.splice(i,1)[0];x.hand.push(pick);log(g,'📜 ค้นหามอนสเตอร์รอยัลจากเด็คขึ้นมือ');}
        x.deck.push(...top);break;
      }
      case 'RM03':m.defMod+=400;m.expireDefAt=g.turnCount+1;break;
      case 'RM05':enemy.lp-=200;log(g,'⚡ สายฟ้าสร้างความเสียหาย 200 LP');break;
      case 'RM06':if(tribute){let i=x.grave.findIndex(q=>q.id.startsWith('RM')&&val(q.id).type==='spell');if(i>=0){x.hand.push(x.grave.splice(i,1)[0]);log(g,'📜 นำเวทรอยัลกลับมือ');}}break;
      case 'RM08':if(tribute){let target=enemy.field.find(y=>viewStats(g,1-p,y).atk<=2000);if(target)kill(g,1-p,target.uid);}break;
      case 'NC08': if(tribute){const i=x.grave.findIndex(z=>val(z.id).type==='monster'&&val(z.id).level<=4);if(i>=0&&x.field.length<6){special(g,p,x.grave.splice(i,1)[0]);log(g,'💀 จักรพรรดิเนโครแมนเซอร์คืนชีพมอนสเตอร์');}}break;
      case 'EL07':if(tribute){heal(g,p,500);if(x.field.some(z=>z.id==='EL06'))draw(g,p,1);}break;
      case 'EL08':if(tribute){heal(g,p,500);x.field.forEach(z=>{z.atkMod+=300;z.expireAtkAt=g.turnCount;});}break;
      case 'RK07':if(tribute){heal(g,p,Math.min(900,300*x.field.filter(z=>z.id==='RK01').length));}break;
      case 'RK08':if(tribute){x.field.forEach(z=>{z.atkMod+=300;z.expireAtkAt=g.turnCount;});}break;
      case 'CP01':draw(g,p);discardLast(g,p);break;
      case 'CP03':heal(g,p,400);log(g,'💗 ฟื้นฟู 400 LP');break;
      case 'CP04':if(enemy.field[0]){enemy.field[0].frozenTurn=g.turnCount+1;log(g,'🌬️ หยุดการโจมตีของ '+val(enemy.field[0].id).name+' ในเทิร์นถัดไป');}break;
      case 'CP07':if(tribute){const i=x.grave.findIndex(q=>val(q.id).type==='monster'&&val(q.id).level<=4);if(i>=0&&x.field.length<6){special(g,p,x.grave.splice(i,1)[0]);}}break;
      case 'CP08':if(tribute){if(enemy.field[0]){enemy.field[0].atkMod-=700;enemy.field[0].expireAtkAt=g.turnCount;}heal(g,p,500);log(g,'💝 ราชินีคิวปิดลดพลังและฟื้น LP');}break;
    }
    if(!['RM','CP'].includes(m.id.slice(0,2)) && !['NC08','EL07','EL08','RK07','RK08'].includes(m.id)){
      const num=Number(m.id.slice(2));
      if(m.id.startsWith('RL')&&num<=5){checkRelics(g,p);}
      else if(m.id.startsWith('RL')&&[6,7,8].includes(num)){draw(g,p,2);discardLast(g,p);}
      else if(num===1){draw(g,p);discardLast(g,p);}
      else if(num===2){enemy.lp-=250;log(g,'✨ สร้างความเสียหาย 250 LP');}
      else if(num===3){heal(g,p,400);}
      else if(num===4){draw(g,p);}
      else if(num===5){heal(g,p,300);}
      else if(num===6&&tribute){draw(g,p);}
      else if(num===7&&tribute){enemy.lp-=400;}
      else if(num===8&&tribute){draw(g,p,2);}
    }
    // V2.4: once-per-turn archetype combo after a successful summon.
    const prefix=m.id.slice(0,2), allies=x.field.filter(c=>c.id.startsWith(prefix));
    x.comboTurns=x.comboTurns||{};
    if(allies.length>=2 && x.comboTurns[prefix]!==g.turnCount){
      x.comboTurns[prefix]=g.turnCount;
      if(prefix==='RM'){m.atkMod+=300;log(g,'🐉 คอมโบรอยัล: มอนสเตอร์ที่อัญเชิญได้รับ ATK +300');}
      else if(prefix==='CP'){heal(g,p,300);log(g,'💘 คอมโบคิวปิด: ฟื้นฟู 300 LP');}
      else if(prefix==='FL'){allies.forEach(c=>c.defMod=(c.defMod||0)+200);log(g,'🌸 คอมโบบุปผา: DEF ฝ่ายเรา +200');}
      else if(prefix==='AS'){draw(g,p,1);log(g,'🌌 คอมโบดวงดาว: จั่ว 1 ใบ');}
      else if(prefix==='VP'){enemy.lp-=200;heal(g,p,200);log(g,'🩸 คอมโบแวมไพร์: ดูด 200 LP');}
      else if(prefix==='DB'){draw(g,p,1);log(g,'🐰 คอมโบบันนี่: จั่ว 1 ใบ');}
      else if(prefix==='NC'){const i=x.grave.findIndex(z=>val(z.id).type==='monster'&&val(z.id).level<=4);if(i>=0){x.hand.push(x.grave.splice(i,1)[0]);log(g,'💀 คอมโบเนโครแมนเซอร์: คืนการ์ดจากสุสานขึ้นมือ');}}
      else if(prefix==='EL'){heal(g,p,300);log(g,'💘 คอมโบคู่รัก: ฟื้นฟู 300 LP');}
      else if(prefix==='RK'){allies.forEach(z=>z.atkMod=(z.atkMod||0)+200);log(g,'👑 คอมโบราชวงศ์: ATK +200');}
      else if(prefix==='RL'){heal(g,p,200);log(g,'🏺 คอมโบศาสตรา: ฟื้น 200 LP');}
      else if(['PX','OC','TH','FR','SH','SM','CW','IC','DS','IL'].includes(prefix)){
        const modes={PX:'damage',OC:'heal',TH:'damage',FR:'heal',SH:'draw',SM:'buff',CW:'buff',IC:'heal',DS:'damage',IL:'draw'};
        const mode=modes[prefix];if(mode==='damage'){enemy.lp-=200;log(g,'⚡ คอมโบ '+T[Object.keys(T).find(k=>T[k].cards[0].id.startsWith(prefix))].name+': สร้างความเสียหาย 200 LP');}
        else if(mode==='heal'){heal(g,p,300);log(g,'💚 คอมโบ: ฟื้นฟู 300 LP');}
        else if(mode==='draw'){draw(g,p,1);log(g,'🃏 คอมโบ: จั่ว 1 ใบ');}
        else {allies.forEach(z=>z.atkMod=(z.atkMod||0)+150);log(g,'⚔️ คอมโบ: ATK +150');}
      }
    }
    winning(g);
  }
  function newGame(decks,names,customLists=[]){serial=0;
    const players=decks.map((d,i)=>{
      const allowed=new Set(T[d].cards.map(c=>c.id));
      const list=customLists[i];const counts={};
      const valid=Array.isArray(list)&&list.length===52&&list.every(id=>{if(!allowed.has(id))return false;counts[id]=(counts[id]||0)+1;return counts[id]<=4;});
      const ids=valid?list:T[d].cards.flatMap(c=>Array(4).fill(c.id));
      const cards=shuffle(ids.map(make));
      return {name:String(names[i]||('ผู้เล่น '+(i+1))).slice(0,24),deckName:T[d].name,deck:cards,hand:[],field:[],traps:[],grave:[],lp:4000,noDirect:false,normalUsed:false,usedNames:[]};
    });
    const g={players,turn:0,turnCount:1,phase:'main',drawPending:false,winner:null,log:[]};
    draw(g,0,5);draw(g,1,5);log(g,'🎲 เริ่มดวล! '+players[0].name+' เริ่มก่อน (เทิร์นแรกห้ามโจมตี)');return g;
  }
  function act(g,p,a){
    if(!g || g.winner!==null)return fail('เกมจบแล้ว');
    if(p!==g.turn)return fail('ยังไม่ถึงเทิร์นของคุณ');
    const x=g.players[p], y=g.players[1-p];
    if(!a||typeof a!=='object'||!['summon','spell','set','battle','attack','end','ability','draw'].includes(a.type))return fail('คำสั่งไม่ถูกต้อง');
    const isMain=g.phase==='main';
    if(a.type==='draw'){if(!g.drawPending)return fail('เทิร์นนี้จั่วไปแล้ว');g.drawPending=false;draw(g,p,1);log(g,'🃏 '+x.name+' กดจั่วการ์ด 1 ใบ');return {ok:true};}
    if(g.drawPending)return fail('ต้องกดกองจั่วก่อนจึงจะเล่นเทิร์นนี้ได้');
    if(a.type==='summon'){
      if(!isMain)return fail('อัญเชิญได้เฉพาะ Main Phase');
      const i=idx(x.hand,a.uid);if(i<0)return fail('ไม่พบการ์ดในมือ');const c=x.hand[i],def=val(c.id);
      if(def.type!=='monster'||x.field.length>=6)return fail('สนามเต็มหรือไม่ใช่มอนสเตอร์');
      const cost=def.level>=7?2:def.level>=5?1:0;
      if(x.field.length<cost)return fail('มอนสเตอร์สังเวยไม่พอ');
      const sacrifice=x.field.slice().sort((a,b)=>viewStats(g,p,a).atk-viewStats(g,p,b).atk).slice(0,cost);
      for(const t of sacrifice){x.field.splice(idx(x.field,t.uid),1);grave(g,p,t);}
      x.hand.splice(i,1);const m={...c,pos:a.pos==='def'?'def':'atk',attacked:false,atkMod:0,defMod:0,usedAbilityTurn:0};x.field.push(m);
      log(g,'🐉 '+x.name+' อัญเชิญ '+def.name+(cost?' (สังเวย '+cost+')':''));
      summonEffect(g,p,m,cost>0);return {ok:true};
    }
    if(a.type==='set'){
      if(!isMain)return fail('วางกับดักได้เฉพาะ Main Phase');
      const i=idx(x.hand,a.uid);if(i<0||val(x.hand[i].id).type!=='trap')return fail('ไม่มีการ์ดกับดักนี้');
      if(x.traps.length>=3)return fail('ช่องเวท/กับดักเต็ม');
      const t=x.hand.splice(i,1)[0];x.traps.push({...t,setTurn:g.turnCount});log(g,'🛡️ '+x.name+' วางกับดักคว่ำ 1 ใบ');return {ok:true};
    }
    if(a.type==='spell'){
      if(!isMain)return fail('ใช้เวทได้เฉพาะ Main Phase');
      const i=idx(x.hand,a.uid);if(i<0||val(x.hand[i].id).type!=='spell')return fail('ไม่มีเวทนี้');
      const c=x.hand[i],targets=a.target;
      if(x.usedNames.includes(c.id))return fail('เอฟเฟกต์ชื่อเดียวกันใช้ได้ครั้งเดียวต่อเทิร์น');
      const mine=x.field.find(z=>z.uid===targets),enemy=y.field.find(z=>z.uid===targets);
      const source=x.hand.find(z=>z.uid===targets&&val(z.id).type==='monster'&&val(z.id).level<=4&&z.uid!==c.uid);
      const gr=x.grave.find(z=>z.uid===targets&&val(z.id).type==='monster'&&val(z.id).level<=4);
      if(c.id==='RM09'&&!mine||c.id==='CP09'&&!enemy||['RM10','CP11'].includes(c.id)&&(!source||x.field.length>=6)||c.id==='RM11'&&!gr)return fail('กรุณาเลือกเป้าหมายที่ถูกต้อง');
      x.hand.splice(i,1);x.usedNames.push(c.id);log(g,'✨ '+x.name+' ใช้ '+val(c.id).name);
      switch(c.id){
        case 'RM09':mine.atkMod+=500;mine.expireAtkAt=g.turnCount;break;
        case 'CP09':enemy.atkMod-=500;enemy.expireAtkAt=g.turnCount;break;
        case 'RM10':case 'CP11':x.hand.splice(idx(x.hand,source.uid),1);special(g,p,source);break;
        case 'RM11':x.hand.push(x.grave.splice(idx(x.grave,gr.uid),1)[0]);break;
        case 'CP10':draw(g,p,2);discardLast(g,p);x.noDirect=true;break;
        default:{const n=Number(c.id.slice(2));if(c.id==='NC10'){if(x.lp>500&&x.field.length<6){const k=x.grave.findIndex(z=>val(z.id).type==='monster'&&val(z.id).level<=4);if(k>=0){x.lp-=500;special(g,p,x.grave.splice(k,1)[0]);log(g,'💀 พิธีฟื้นคืนทำงาน');}else log(g,'สุสานไม่มีมอนสเตอร์ที่คืนชีพได้');}else log(g,'ไม่สามารถใช้พิธีฟื้นคืนได้');}else if(n===9){draw(g,p,c.id==='RL09'?2:2);x.noDirect=true;}else if(n===10){if(c.id==='RL10'){draw(g,p,3);x.noDirect=true;}else heal(g,p,700);}else if(n===11&&y.field.length){const weakest=y.field.slice().sort((a,b)=>viewStats(g,1-p,a).atk-viewStats(g,1-p,b).atk)[0];kill(g,1-p,weakest.uid,true);}break;}
      }
      grave(g,p,c);checkRelics(g,p);winning(g);return {ok:true};
    }
    if(a.type==='ability'){
      if(!isMain)return fail('ใช้ความสามารถใน Main Phase เท่านั้น');
      const m=x.field.find(z=>z.uid===a.uid);
      if(!m||m.id!=='RM07'||m.usedAbilityTurn===g.turnCount||x.usedNames.includes('RM07'))return fail('ใช้เอฟเฟกต์นี้ไม่ได้');
      if(!x.hand.length||!y.traps.length)return fail('ต้องมีการ์ดในมือและกับดักฝ่ายตรงข้าม');
      discardLast(g,p);m.usedAbilityTurn=g.turnCount;x.usedNames.push('RM07');
      const target=y.traps[0];y.traps.shift();grave(g,1-p,target);log(g,'⚡ มังกรครามทำลายกับดักฝ่ายตรงข้าม');return {ok:true};
    }
    if(a.type==='battle'){
      if(!isMain)return fail('เข้า Battle Phase ไม่ได้');
      if(g.turnCount===1)return fail('ผู้เล่นคนแรกห้ามโจมตีในเทิร์นแรก');
      g.phase='battle';log(g,'⚔️ '+x.name+' เข้า Battle Phase');return {ok:true};
    }
    if(a.type==='attack'){
      if(g.phase!=='battle')return fail('ต้องอยู่ใน Battle Phase');
      const m=x.field.find(z=>z.uid===a.uid);
      if(!m||m.pos!=='atk'||m.attacked||m.frozenTurn===g.turnCount)return fail('มอนสเตอร์นี้โจมตีไม่ได้');
      let target=y.field.find(z=>z.uid===a.target);
      if(y.field.length&&!target)return fail('ต้องเลือกมอนสเตอร์คู่ต่อสู้');
      if(!y.field.length&&x.noDirect)return fail('เวทคิวปิดห้ามโจมตีโดยตรงในเทิร์นนี้');
      m.attacked=true;
      if(target){const guard=y.field.find(z=>z.id==='RM04'&&z.uid!==target.uid);if(guard){target=guard;log(g,'🛡️ องครักษ์ราชสำนักรับการโจมตีแทน');}}
      const trap=y.traps.find(t=>t.setTurn<g.turnCount && !y.usedNames.includes(t.id) && (t.id==='CP12'||t.id==='RM12'&&!!target||(!['CP','RM'].includes(t.id.slice(0,2))&&Number(t.id.slice(2))>=12)));
      if(trap){useTrap(g,1-p,trap.uid);if(trap.id==='CP12'||(!['CP','RM'].includes(trap.id.slice(0,2))&&trap.id.endsWith('13')))heal(g,1-p,300);if(trap.id==='RM12'&&target){target.defMod+=300;target.expireDefAt=g.turnCount;}log(g,'🛡️ ยกเลิกการโจมตี');return {ok:true};}
      const promise=y.field.find(z=>z.id==='CP06'&&z.usedAbilityTurn!==g.turnCount&&!y.usedNames.includes('CP06'));
      if(target&&target.id.startsWith('CP')&&promise&&y.hand.length){discardLast(g,1-p);promise.usedAbilityTurn=g.turnCount;y.usedNames.push('CP06');log(g,'🛡️ ผู้พิทักษ์คำสัญญาหยุดการโจมตี');return {ok:true};}
      if(!target){const dmg=viewStats(g,p,m).atk;y.lp-=dmg;log(g,'⚔️ '+val(m.id).name+' โจมตีตรง '+dmg+' LP');winning(g);return {ok:true};}
      let aAtk=viewStats(g,p,m).atk, dAtk=viewStats(g,1-p,target).atk,dDef=viewStats(g,1-p,target).def;
      if(m.id==='RM02')aAtk+=300;if(m.id==='CP02')dAtk=Math.max(0,dAtk-300);
      const defense=target.pos==='def',vs=defense?dDef:dAtk;
      log(g,'⚔️ '+val(m.id).name+' ('+aAtk+') ปะทะ '+val(target.id).name+' ('+vs+')');
      if(aAtk>vs){kill(g,1-p,target.uid,false);if(!defense)y.lp-=aAtk-vs;}
      else if(aAtk<vs){if(!defense)kill(g,p,m.uid,false);x.lp-=vs-aAtk;}
      else if(!defense){kill(g,p,m.uid,false);kill(g,1-p,target.uid,false);}
      winning(g);return {ok:true};
    }
    if(a.type==='end'){
      while(x.hand.length>7)discardLast(g,p);
      for(const player of g.players){for(const m of player.field){
        if(m.expireAtkAt===g.turnCount){m.atkMod=0;delete m.expireAtkAt;}
        if(m.expireDefAt===g.turnCount){m.defMod=0;delete m.expireDefAt;}
      }}
      x.noDirect=false;g.turn=1-p;g.turnCount++;g.players.forEach(q=>q.usedNames=[]);g.phase='main';
      const next=g.players[g.turn];next.normalUsed=false;
      for(const m of next.field){m.attacked=false;if(m.frozenTurn&&m.frozenTurn<g.turnCount)delete m.frozenTurn;}
      g.drawPending=true;log(g,'🔔 เทิร์น '+g.turnCount+' — '+next.name+' (รอกดจั่ว 1 ใบ)');return {ok:true};
    }
    return fail('คำสั่งไม่รองรับ');
  }
  function project(g,p){
    if(!g)return null;
    const copy=JSON.parse(JSON.stringify(g));
    for(let i=0;i<2;i++){
      copy.players[i].deckCount=g.players[i].deck.length;
      copy.players[i].handCount=g.players[i].hand.length;
      copy.players[i].graveCount=g.players[i].grave.length;
      copy.players[i].deck=undefined;
      if(i!==p){copy.players[i].hand=undefined;copy.players[i].traps=copy.players[i].traps.map(t=>({uid:t.uid,hidden:true}));}
    }
    return {...copy,you:p};
  }
  globalThis.Duel={newGame,act,project,val,viewStats};
})();
