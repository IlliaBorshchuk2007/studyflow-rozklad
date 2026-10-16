import {useEffect,useMemo,useState,type FormEvent} from 'react';
import {Check,ChevronLeft,ChevronRight,Filter,Plus,Search,Trash2,X} from 'lucide-react';
import {supabase} from './lib/supabase.ts';
import {ROLE_LABEL,type Group,type Membership,type Profile,type Role,type UserRow} from './lib/types.ts';
import './dashboard.css';
import GroupInvitations from './GroupInvitations.tsx';

type Person=Profile&{email:string};
const PAGE_SIZE=40;
export default function GroupManager({groups,members,profiles,users,role,onRefresh,onNotice,onError}:{
 groups:Group[];members:Membership[];profiles:Profile[];users:UserRow[];role:Role;
 onRefresh:()=>Promise<void>;onNotice:(s:string)=>void;onError:(e:unknown)=>void;
}){
 const [groupId,setGroupId]=useState('');const [name,setName]=useState('');const [description,setDescription]=useState('');
 const [query,setQuery]=useState('');const [roleFilter,setRoleFilter]=useState('');const [groupFilter,setGroupFilter]=useState('');
 const [courseFilter,setCourseFilter]=useState('');const [specialtyFilter,setSpecialtyFilter]=useState('');
 const [sort,setSort]=useState('name');const [page,setPage]=useState(0);const [selected,setSelected]=useState<string[]>([]);
 const [review,setReview]=useState(false);const [busy,setBusy]=useState(false);const [status,setStatus]=useState('');
 const admin=role==='admin';
 useEffect(()=>{if(!groups.some(g=>g.id===groupId))setGroupId(groups[0]?.id||'');},[groups,groupId]);
 useEffect(()=>{setSelected([]);setReview(false);setPage(0);setStatus('');},[groupId]);
 const emailMap=useMemo(()=>new Map(users.map(u=>[u.id,u.email])),[users]);
 const people:Person[]=useMemo(()=>profiles.map(p=>({...p,email:admin?(emailMap.get(p.id)||''):''})),[profiles,emailMap,admin]);
 const selectedGroup=groups.find(g=>g.id===groupId);
 const assigned=members.filter(m=>m.group_id===groupId);
 const assignedSet=new Set(assigned.map(m=>m.user_id));
 const specialties=Array.from(new Set(profiles.map(p=>p.specialty).filter((v):v is string=>!!v))).sort((a,b)=>a.localeCompare(b,'uk'));
 const courses=Array.from(new Set(profiles.map(p=>p.course).filter((v):v is number=>v!=null))).sort((a,b)=>a-b);
 const filtered=useMemo(()=>{
  const q=query.trim().toLocaleLowerCase('uk');
  return people.filter(p=>{
   if(roleFilter&&p.role!==roleFilter)return false;
   if(courseFilter&&String(p.course??'')!==courseFilter)return false;
   if(specialtyFilter&&p.specialty!==specialtyFilter)return false;
   if(groupFilter==='without'&&members.some(m=>m.user_id===p.id))return false;
   if(groupFilter==='in'&&!members.some(m=>m.user_id===p.id))return false;
   if(groupFilter&&groupFilter!=='without'&&groupFilter!=='in'&&!members.some(m=>m.user_id===p.id&&m.group_id===groupFilter))return false;
   if(q&&![p.full_name,p.email,p.specialty||''].join(' ').toLocaleLowerCase('uk').includes(q))return false;
   return true;
  }).sort((a,b)=>sort==='course'?(a.course??99)-(b.course??99)||a.full_name.localeCompare(b.full_name,'uk'):sort==='role'?a.role.localeCompare(b.role)||a.full_name.localeCompare(b.full_name,'uk'):sort==='email'?a.email.localeCompare(b.email,'uk'):a.full_name.localeCompare(b.full_name,'uk'));
 },[people,query,roleFilter,courseFilter,specialtyFilter,groupFilter,members,sort]);
 const available=filtered.filter(p=>!assignedSet.has(p.id));
 const selectedPeople=people.filter(p=>selected.includes(p.id));
 const countPages=Math.max(1,Math.ceil(available.length/PAGE_SIZE));
 const visible=available.slice(Math.min(page,countPages-1)*PAGE_SIZE,(Math.min(page,countPages-1)+1)*PAGE_SIZE);
 const toggle=(id:string)=>setSelected(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);
 const label=(p:Profile)=>[ROLE_LABEL[p.role],p.course?String(p.course)+' курс':null,p.specialty].filter(Boolean).join(' · ');
 async function createGroup(e:FormEvent){e.preventDefault();if(!supabase||!name.trim())return;setBusy(true);setStatus('');const {error}=await supabase.from('study_groups').insert({name:name.trim(),description:description.trim()});setBusy(false);if(error){onError(error);setStatus(error.code==='23505'?'Група з такою назвою вже існує.':error.message);return;}setName('');setDescription('');onNotice('Навчальну групу створено');await onRefresh();}
 async function assignAll(){if(!supabase||!admin||!groupId||selected.length===0)return;setBusy(true);setStatus('');let added=0;let issue='';const rows=selectedPeople.filter(p=>p.role!=='admin').map(p=>({group_id:groupId,user_id:p.id,member_role:p.role==='teacher'?'teacher':'student'}));
  for(let i=0;i<rows.length;i+=40){const slice=rows.slice(i,i+40);const {error}=await supabase.from('group_members').upsert(slice,{onConflict:'group_id,user_id',ignoreDuplicates:true});if(error){issue=error.message;break;}added+=slice.length;}
  await onRefresh();setBusy(false);if(issue){setStatus('Не всі призначення збережено: '+issue);onError(new Error(issue));}else{setSelected([]);setReview(false);onNotice('Призначення збережено: '+added+'. Дублікати пропущено.');}
 }
 async function remove(m:Membership){if(!supabase||!admin||busy||!window.confirm('Вилучити учасника з цієї групи?'))return;setBusy(true);const {error}=await supabase.from('group_members').delete().eq('id',m.id);setBusy(false);if(error){onError(error);return;}onNotice('Учасника вилучено');await onRefresh();}
 return <section className="panel-page"><div className="page-heading"><div className="eyebrow">НАВЧАЛЬНІ ГРУПИ</div><h1>Учасники та призначення</h1><p>Пошук, фільтри та масове призначення. Усі зміни записуються в Supabase.</p></div>
 <div className="gmanager-layout">
  <div className="panel gmanager-groups"><h3>Групи <span className="bubble">{groups.length}</span></h3>{groups.map(g=><button key={g.id} className={'gmanager-group '+(groupId===g.id?'active':'')} onClick={()=>setGroupId(g.id)}><strong>{g.name}</strong><small>{members.filter(m=>m.group_id===g.id).length} учасників</small></button>)}{!groups.length&&<p className="muted">Груп ще немає</p>}
   {admin&&<form onSubmit={createGroup} className="stack-form gmanager-create"><h3>Нова група</h3><label>Назва<input required maxLength={100} value={name} onChange={e=>setName(e.target.value)} placeholder="Наприклад, ЛІН-41"/></label><label>Опис<input maxLength={500} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Необов'язково"/></label><button className="btn primary" disabled={busy}><Plus size={15}/> Створити групу</button></form>}
  </div>
  <div className="gmanager-main">
   <div className="panel"><h2>{selectedGroup?.name||'Обери групу'}</h2><p>{selectedGroup?.description||'Склад навчальної групи'}</p><h3>Уже призначені · {assigned.length}</h3>{assigned.length?<div className="gmanager-assigned">{assigned.map(m=>{const p=people.find(x=>x.id===m.user_id);return <div className="gmanager-assignee" key={m.id}><span><strong>{p?.full_name||'Користувач'}</strong><small>{p?label(p):m.member_role}</small></span>{admin&&<button className="icon-btn" title="Вилучити" disabled={busy} onClick={()=>void remove(m)}><Trash2 size={16}/></button>}</div>;})}</div>:<p className="muted">У цій групі ще немає учасників</p>}</div>
   {admin&&<div className="panel"><div className="gmanager-heading"><div><h2>Додати учасників</h2><p>Знайди користувачів і вибери потрібних.</p></div><span className="bubble">{selected.length} вибрано</span></div>
    <div className="gmanager-filters"><label className="gmanager-search"><Search size={16}/><input placeholder="Ім’я, прізвище або email" aria-label="Пошук користувачів" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/></label>
    <select aria-label="Роль" value={roleFilter} onChange={e=>{setRoleFilter(e.target.value);setPage(0);}}><option value="">Усі ролі</option>{Object.entries(ROLE_LABEL).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>
    <select aria-label="Група користувача" value={groupFilter} onChange={e=>{setGroupFilter(e.target.value);setPage(0);}}><option value="">Усі групи</option><option value="without">Без групи</option><option value="in">Є в групі</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select>
    <select aria-label="Курс" value={courseFilter} onChange={e=>{setCourseFilter(e.target.value);setPage(0);}}><option value="">Усі курси</option>{courses.map(n=><option key={n} value={n}>{n} курс</option>)}</select>
    <select aria-label="Спеціальність" value={specialtyFilter} onChange={e=>{setSpecialtyFilter(e.target.value);setPage(0);}}><option value="">Усі спеціальності</option>{specialties.map(v=><option key={v}>{v}</option>)}</select>
    <select aria-label="Сортування" value={sort} onChange={e=>setSort(e.target.value)}><option value="name">За алфавітом</option><option value="role">За роллю</option><option value="course">За курсом</option><option value="email">За email</option></select></div>
    <div className="gmanager-results"><div className="gmanager-meta"><span><Filter size={14}/> Доступно для призначення: {available.length}</span><button className="btn light compact" onClick={()=>setSelected(prev=>Array.from(new Set([...prev,...visible.filter(p=>p.role!=='admin').map(p=>p.id)])))}>Обрати сторінку</button><button className="btn light compact" onClick={()=>setSelected([])}>Скинути вибір</button></div>
    {visible.length?visible.map(p=><label className={'gmanager-person '+(selected.includes(p.id)?'picked':'')} key={p.id}><input type="checkbox" disabled={p.role==='admin'} checked={selected.includes(p.id)} onChange={()=>toggle(p.id)}/><span className="avatar">{p.full_name[0]||'?'}</span><span className="gmanager-person-info"><strong>{p.full_name}</strong><small>{label(p)||'Не вказано'} · {members.filter(m=>m.user_id===p.id).map(m=>groups.find(g=>g.id===m.group_id)?.name).filter(Boolean).join(', ')||'Без групи'}</small><small>{p.email||'Email недоступний'}</small>{p.role==='admin'&&<small>Адміністратор не призначається як учасник</small>}</span></label>):<div className="blank-state">За фільтрами користувачів не знайдено</div>}</div>
    <div className="gmanager-bottom"><div className="gmanager-paging"><button className="btn light compact" disabled={page===0} onClick={()=>setPage(p=>p-1)}><ChevronLeft size={15}/></button><span>Сторінка {Math.min(page,countPages-1)+1} / {countPages}</span><button className="btn light compact" disabled={page>=countPages-1} onClick={()=>setPage(p=>p+1)}><ChevronRight size={15}/></button></div><button className="btn primary" disabled={!selected.length||busy||!groupId} onClick={()=>setReview(v=>!v)}><Check size={16}/> Переглянути ({selected.length})</button></div>
    {review&&selected.length>0&&<div className="gmanager-preview"><h3>Підтвердження · {selected.length}</h3><p>Група: <strong>{selectedGroup?.name}</strong>. Студенти додаються як студенти, викладачі — як викладачі.</p><div className="gmanager-chosen">{selectedPeople.map(p=><span key={p.id}>{p.full_name}<button onClick={()=>toggle(p.id)} title="Прибрати"><X size={12}/></button></span>)}</div><button className="btn primary" disabled={busy} onClick={()=>void assignAll()}>{busy?'Збереження…':'Підтвердити призначення'}</button></div>}
    {status&&<div role="alert" className="message error">{status}</div>}
   </div>}
   {admin&&groupId&&<div className="panel"><GroupInvitations groupId={groupId}/></div>}
  </div>
 </div></section>;
}
