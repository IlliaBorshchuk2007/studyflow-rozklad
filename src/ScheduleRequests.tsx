import {useEffect,useState,type FormEvent} from 'react';
import {Check,Clock3,RefreshCw,X} from 'lucide-react';
import {supabase} from './lib/supabase.ts';
import {addDays,kyivToday} from './lib/calendar.ts';
import {type Lesson,type Profile,type Role} from './lib/types.ts';
import './learning.css';
type RequestRow={id:string;lesson_id:string;requested_by:string;reason:string;proposed_date:string;proposed_starts_at:string;proposed_ends_at:string;status:'pending'|'approved'|'rejected';admin_comment:string;created_at:string;decided_at:string|null};
const labels={pending:'Очікує розгляду',approved:'Підтверджено',rejected:'Відхилено'};
export default function ScheduleRequests({role,viewer,profiles,initialLessonId}:{
 role:Role;viewer:string;profiles:Profile[];initialLessonId?:string|null;
}){
 const [requests,setRequests]=useState<RequestRow[]>([]),[lessons,setLessons]=useState<Lesson[]>([]);
 const [lessonId,setLessonId]=useState(initialLessonId||'');const [reason,setReason]=useState('');
 const [date,setDate]=useState(kyivToday()),[starts,setStarts]=useState('09:00'),[ends,setEnds]=useState('10:00');
 const [comments,setComments]=useState<Record<string,string>>({});
 const [loading,setLoading]=useState(false),[busy,setBusy]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState(''),[refresh,setRefresh]=useState(0);
 const viewerName=new Map(profiles.map(p=>[p.id,p.full_name]));
 useEffect(()=>{if(initialLessonId)setLessonId(initialLessonId);},[initialLessonId]);
 useEffect(()=>{if(!supabase)return;let ok=true;setLoading(true);
  void Promise.all([
   supabase.from('schedule_change_requests').select('*').order('created_at',{ascending:false}).limit(250),
   supabase.from('lessons').select('*').gte('lesson_date',addDays(kyivToday(),-30)).lte('lesson_date',addDays(kyivToday(),180)).order('lesson_date').limit(1000)
  ]).then(([a,b])=>{if(!ok)return;if(a.error||b.error)throw a.error||b.error;setRequests((a.data||[]) as RequestRow[]);setLessons((b.data||[]) as Lesson[]);}).catch(e=>{if(ok)setError(e instanceof Error?e.message:String(e));}).finally(()=>{if(ok)setLoading(false);});
  return()=>{ok=false;};
 },[refresh]);
 const chosen=lessons.find(l=>l.id===lessonId);
 useEffect(()=>{if(!chosen)return;setDate(chosen.lesson_date);setStarts(chosen.starts_at.slice(0,5));setEnds(chosen.ends_at.slice(0,5));},[chosen?.id]);
 async function submit(e:FormEvent){e.preventDefault();if(!supabase||!lessonId||reason.trim().length<3)return;setBusy('create');setError('');setMessage('');
  const {error:err}=await supabase.from('schedule_change_requests').insert({lesson_id:lessonId,requested_by:viewer,reason:reason.trim(),proposed_date:date,proposed_starts_at:starts,proposed_ends_at:ends});
  setBusy('');if(err){setError(err.message);return;}setMessage('Заявку надіслано адміністратору');setReason('');setRefresh(n=>n+1);
 }
 async function decide(row:RequestRow,approved:boolean){if(!supabase||role!=='admin')return;const action=approved?'підтвердити':'відхилити';if(!window.confirm('Справді '+action+' цю заявку?'))return;
  setBusy(row.id);setError('');setMessage('');
  const {error:err}=await supabase.rpc('decide_schedule_change',{p_request:row.id,p_approve:approved,p_comment:comments[row.id]||''});
  setBusy('');if(err){setError(err.message);return;}setMessage(approved?'Розклад оновлено, сповіщення створено':'Заявку відхилено, автора повідомлено');setRefresh(n=>n+1);
 }
 const sorted=[...requests].sort((a,b)=>(a.status==='pending'?0:1)-(b.status==='pending'?0:1)||b.created_at.localeCompare(a.created_at));
 return <section className="panel-page learning-view"><div className="page-heading"><div className="eyebrow">ПОГОДЖЕННЯ РОЗКЛАДУ</div><h1>Заявки на перенесення</h1><p>Зміни застосовуються до уроку тільки після схвалення адміністратора та перевірки конфліктів у Supabase.</p></div>
 {role!=='admin'&&<form className="panel stack-form" onSubmit={submit}><h2>Запропонувати перенесення</h2><label>Заняття<select required value={lessonId} onChange={e=>setLessonId(e.target.value)}><option value="">Обери заняття</option>{lessons.map(l=><option key={l.id} value={l.id}>{l.lesson_date} · {l.title}</option>)}</select></label><label>Причина<textarea required rows={3} minLength={3} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label><div className="learning-row"><label>Нова дата<input type="date" required value={date} onChange={e=>setDate(e.target.value)}/></label><label>Початок<input type="time" required value={starts} onChange={e=>setStarts(e.target.value)}/></label><label>Завершення<input type="time" required value={ends} onChange={e=>setEnds(e.target.value)}/></label></div><button disabled={!!busy||!lessonId||starts>=ends} className="btn primary" type="submit">Надіслати заявку</button></form>}
 {error&&<div className="panel learning-alert learning-danger" role="alert">{error}</div>}{message&&<div className="panel learning-alert" role="status">{message}</div>}
 <div className="panel"><div className="learning-row"><h2>Заявки · {requests.length}</h2><button className="btn light compact" onClick={()=>setRefresh(n=>n+1)}><RefreshCw size={15}/> Оновити</button></div>
 {loading&&<p>Завантаження…</p>}
 {sorted.length?sorted.map(r=><div className="request-card" key={r.id}><div className="learning-row"><strong>{lessons.find(l=>l.id===r.lesson_id)?.title||'Заняття'} · {viewerName.get(r.requested_by)||'Користувач'}</strong><span className={'status request-status '+r.status}>{labels[r.status]}</span></div><p>{r.reason}</p><div className="request-dates"><Clock3 size={15}/> Нова дата: <strong>{r.proposed_date} · {r.proposed_starts_at.slice(0,5)}–{r.proposed_ends_at.slice(0,5)}</strong></div><small>Створено: {new Date(r.created_at).toLocaleString('uk-UA')}</small>
 {r.admin_comment&&<p>Коментар адміністратора: {r.admin_comment}</p>}
 {role==='admin'&&r.status==='pending'&&<div className="request-decide"><label>Коментар<input maxLength={1000} placeholder="Необов'язково" value={comments[r.id]||''} onChange={e=>setComments(old=>({...old,[r.id]:e.target.value}))}/></label><button disabled={!!busy} className="btn primary" onClick={()=>void decide(r,true)}><Check size={15}/> Підтвердити</button><button disabled={!!busy} className="btn light" onClick={()=>void decide(r,false)}><X size={15}/> Відхилити</button></div>}</div>):!loading&&<div className="blank-state">Заявок ще немає</div>}
 </div></section>;
}
