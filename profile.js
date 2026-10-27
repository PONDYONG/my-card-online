(()=>{'use strict';
const URL='https://caweivthcmopkxuocczu.supabase.co';
const KEY='sb_publishable_GT1cj7x79t81G-cS6LailQ_3wkN-J0t';
const $=id=>document.getElementById(id);
const client=window.supabase?.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
if(!client){console.error('Supabase client unavailable');return;}
let current=null;
window.mycardAccount={client,getUser:()=>current,async getProfile(id){if(!id)return null;const {data}=await client.from('profiles').select('id,username,avatar_url,rank_points,wins,losses,created_at').eq('id',id).maybeSingle();return data;}};
function status(t){$('profileStatus').textContent=t;}
function setUI(){const yes=!!current;$('profileLoggedOut').hidden=yes;$('profileLoggedIn').hidden=!yes;$('profileEmail').textContent=current?.email||'';}
async function loadProfile(){if(!current)return;const {data,error}=await client.from('profiles').select('username,avatar_url').eq('id',current.id).maybeSingle();if(error){status('อ่านโปรไฟล์ไม่ได้: '+error.message);return;}
if(data){$('profileUsername').value=data.username||'';if(data.username&&$('name'))$('name').value=data.username.slice(0,24);$('profileAvatar').src=data.avatar_url||'./king_of_cards_poster.png';}status('เชื่อมต่อโปรไฟล์สำเร็จ ✓');window.dispatchEvent(new Event('mycard:profile-updated'));}
async function init(){const {data}=await client.auth.getUser();current=data.user||null;setUI();if(current)await loadProfile();}
client.auth.onAuthStateChange((_event,session)=>{current=session?.user||null;setUI();if(current)setTimeout(loadProfile,0);else window.dispatchEvent(new Event('mycard:profile-updated'));});
$('profileSignup').onclick=async()=>{const email=$('profileLoginEmail').value.trim(),password=$('profileLoginPassword').value;if(!email||password.length<6){status('กรอกอีเมลและรหัสผ่านอย่างน้อย 6 ตัว');return;}status('กำลังสมัครสมาชิก...');const {data,error}=await client.auth.signUp({email,password});status(error?'สมัครไม่สำเร็จ: '+error.message:data.session?'สมัครและเข้าสู่ระบบสำเร็จ':'สมัครแล้ว กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ');};
$('profileSignin').onclick=async()=>{status('กำลังเข้าสู่ระบบ...');const {error}=await client.auth.signInWithPassword({email:$('profileLoginEmail').value.trim(),password:$('profileLoginPassword').value});status(error?'เข้าสู่ระบบไม่สำเร็จ: '+error.message:'เข้าสู่ระบบสำเร็จ ✓');};
$('profileSignout').onclick=async()=>{const {error}=await client.auth.signOut();status(error?error.message:'ออกจากระบบแล้ว');};
$('profileSave').onclick=async()=>{if(!current)return status('กรุณาเข้าสู่ระบบก่อน');const username=$('profileUsername').value.trim().slice(0,24);if(!username)return status('กรุณาตั้งชื่อผู้เล่น');status('กำลังบันทึก...');const {error}=await client.from('profiles').update({username}).eq('id',current.id);if(error)return status('บันทึกไม่สำเร็จ: '+error.message);$('name').value=username;status('บันทึกชื่อถาวรสำเร็จ ✓');window.dispatchEvent(new Event('mycard:profile-updated'));};
$('profileFile').onchange=async e=>{if(!current)return status('กรุณาเข้าสู่ระบบก่อน');const file=e.target.files?.[0];if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type))return status('รองรับเฉพาะ JPG, PNG, WEBP');if(file.size>2*1024*1024)return status('รูปต้องไม่เกิน 2 MB');const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];const path=current.id+'/avatar-'+Date.now()+'.'+ext;status('กำลังอัปโหลดรูป...');const {error}=await client.storage.from('avatars').upload(path,file,{contentType:file.type,upsert:false});if(error)return status('อัปโหลดไม่สำเร็จ: '+error.message+' (ตรวจสอบ Storage policy)');const {data}=client.storage.from('avatars').getPublicUrl(path);const {error:saveError}=await client.from('profiles').update({avatar_url:data.publicUrl}).eq('id',current.id);if(saveError)return status('อัปโหลดสำเร็จ แต่บันทึกโปรไฟล์ไม่ได้: '+saveError.message);$('profileAvatar').src=data.publicUrl;status('เปลี่ยนรูปโปรไฟล์สำเร็จ ✓');window.dispatchEvent(new Event('mycard:profile-updated'));};
init().catch(e=>status('เชื่อมต่อไม่ได้: '+e.message));
})();
