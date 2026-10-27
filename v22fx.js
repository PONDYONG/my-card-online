/* V2.1.1 visual feedback for card effects; gameplay/network unchanged */
(()=>{'use strict';
const root=document.createElement('div');root.id='fxToastRoot';document.body.append(root);
let last='';
function show(msg,kind){if(msg===last)return;last=msg;setTimeout(()=>{if(last===msg)last=''},900);const el=document.createElement('div');el.className='fx-toast fx-'+kind;el.textContent=msg;root.prepend(el);while(root.children.length>3)root.lastChild.remove();setTimeout(()=>el.remove(),2600);
 if(kind==='summon'||kind==='battle'||kind==='draw'){const flash=document.createElement('div');flash.className='fx-flash fx-flash-'+kind;document.body.append(flash);setTimeout(()=>flash.remove(),650);}}
window.addEventListener('mycard:log',e=>{const m=e.detail?.message||'';
if(/จั่ว|ค้นหา.*ขึ้นมือ/.test(m))show('🃏 '+m,'draw');
else if(/อัญเชิญ/.test(m))show('✨ '+m,'summon');
else if(/โจมตี|ปะทะ|ถูกทำลาย|ความเสียหาย/.test(m))show('⚔️ '+m,'battle');
else if(/ฟื้นฟู|เพิ่มพลัง|ลดพลัง|กลับมือ|เปิดกับดัก/.test(m))show('💫 '+m,'effect');
});
})();
