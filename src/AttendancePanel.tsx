import {useEffect,useMemo,useState} from 'react';
import {CalendarCheck,Check,RefreshCw} from 'lucide-react';
import {supabase} from './lib/supabase.ts';
import {addDays,dateISO,kyivToday,monthStart,parseISO} from './lib/calendar.ts';
import {type Group,type Lesson,type Membership,type Profile,type Role} from './lib/types.ts';
import './learning.css';
type Mark='present'|'absent'|'late';
type RecordRow={id:string;lesson_id:string;student_id:string;status:Mark;note:string;updated_at:string};
const labels:Record<Mark,string>={present:'Присутній',absent:'Відсутній',late:'Запізнився'};
function lastMonthDay(d:string){const y=Number(d.slice(0,4)),m=Number(d.slice(5,7));return dateISO(new Date(Date.UTC(y,m,0,12)));}
function semester(date:string):[string,string]{const y=Number(date.slice(0,4)),m=Number(date.slice(5,7));return m===1?[(y-1)+'-09-01',y+'-01-31']:m>=9?[y+'-09-01',(y+1)+'-01-31']:[y+'-02-01',y+'-08-31'];}
export default function AttendancePanel({role,viewer,profiles,groups,members,initialLessonId,initialDate}:{
 role:Role;viewer:string;profiles:Profile[];groups:Group[];members:Membership[];initialLessonId?:string|null;initialDate?:string|null;
}){
 const [period,setPeriod]=useState<'month'|'semester'>('month');const [date,setDate]=useState(initialDate||kyivToday());
 const [teacherFilter,setTeacherFilter]=useState(''),[studentFilter,setStudentFilter]=useState(''),[groupFilter,setGroupFilter]=useState('');
 const [lessons,setLessons]=useState<Lesson[]>([]),[marks,setMarks]=useState<RecordRow[]>([]);
 const [loading,setLoading]=useState(false),[saving,setSaving]=useState(''),[error,setError]=useState(''),[success,setSuccess]=useState(''),[refresh,setRefresh]=useState(0);
 const [start,end]=period==='month'?[monthStart(date),lastMonthDay(date)]:semester(date);
 const [chosen,setChosen]=useState(initialLessonId||'');
 useEffect(()=>{if(initialLessonId)setChosen(initialLessonId);},[initialLessonId]);
 useEffect(()=>{if(!supabase)return;let active=true;const db=supabase;setLoading(true);setError('');
  void (async()=>{const first=await db.from('lessons').select('*').gte('lesson_date',start).lte('lesson_date',end).order('lesson_date').limit(2000);
   if(first.error)throw first.error;
   const rows=(first.data||[]) as Lesson[];
   const ids=rows.map(l=>l.id);const all:RecordRow[]=[];
   for(let offset=0;offset<ids.length;offset+=80){const {data,error:err}=await db.from('attendance').select('*').in('lesson_id',ids.slice(offset,offset+80)).limit(5000);if(err)throw err;all.push(...((data||[]) as RecordRow[]));}
   if(active){setLessons(rows);setMarks(all);if(rows.length>=2000)setError('Показано лише перші 2000 занять. Обери коротший період.');}
  })().catch((e:unknown)=>{if(active)setError(e instanceof Error?e.message:String(e));}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[start,end,refresh]);
 const name=new Map(profiles.map(p=>[p.id,p.full_name]));
 const teacher=role==='teacher'?viewer:teacherFilter;
 const filtered=lessons.filter(l=>(!teacher||l.teacher_id===teacher)&&(!groupFilter||l.group_id===groupFilter)&&(!studentFilter||l.student_id===studentFilter||members.some(m=>m.group_id===l.group_id&&m.user_id===studentFilter&&m.member_role==='student')));
 const current=filtered.find(l=>l.id===chosen)||filtered[0];
 const getStudents=(l:Lesson)=>l.student_id?[l.student_id]:members.filter(m=>m.group_id===l.group_id&&m.member_role==='student').map(m=>m.user_id);
 const relevant=new Set(filtered.flatMap(getStudents));
 const personalMarks=marks.filter(m=>role==='student'?m.student_id===viewer:(role==='admin'?!studentFilter||m.student_id===studentFilter:relevant.has(m.student_id)));
 const validMarks=personalMarks.filter(m=>filtered.some(l=>l.id===m.lesson_id));
 const attended=validMarks.filter(m=>m.status==='present').length,absent=validMarks.filter(m=>m.status==='absent').length,late=validMarks.filter(m=>m.status==='late').length;
 const pct=validMarks.length?Math.round(attended/validMarks.length*100):null;
 const people=current?getStudents(current):[];
 const editable=!!current&&(role==='admin'||role==='teacher'&&current.teacher_id===viewer);
 const setMark=async(lesson:Lesson,student:string,status:Mark)=>{
  if(!supabase||!editable)return;setSaving(student);setError('');setSuccess('');
  const {error:e}=await supabase.from('attendance').upsert({lesson_id:lesson.id,student_id:student,status},{onConflict:'lesson_id,student_id'});
  if(e)setError(e.message);
  else{setMarks(old=>[...old.filter(m=>m.lesson_id!==lesson.id||m.student_id!==student),{id:old.find(m=>m.lesson_id===lesson.id&&m.student_id===student)?.id||'new',lesson_id:lesson.id,student_id:student,status,note:'',updated_at:new Date().toISOString()}]);setSuccess('Відвідуваність збережено');}
  setSaving('');
 };
 const shift=(step:number)=>{const d=parseISO(date);if(period==='month'){d.setUTCMonth(d.getUTCMonth()+step);setDate(dateISO(d));}else setDate(addDays(date,step*180));};
 const studentRows=useMemo(()=>profiles.filter(p=>p.role==='student'),[profiles]);
 return <section className="panel-page learning-view"><div className="page-heading"><div className="eyebrow">НАВЧАЛЬНИЙ ЖУРНАЛ</div><h1>Відвідуваність</h1><p>Пропуски та запізнення враховуються тільки за встановленими викладачем відмітками. Не відмічене заняття не вважається пропуском.</p></div>
 <div className="panel learning-toolbar"><div className="learning-row"><button className={'btn '+(period==='month'?'primary':'light')} onClick={()=>setPeriod('month')}>Місяць</button><button className={'btn '+(period==='semester'?'primary':'light')} onClick={()=>setPeriod('semester')}>Семестр</button><button className="btn light compact" onClick={()=>shift(-1)}>←</button><strong>{start} — {end}</strong><button className="btn light compact" onClick={()=>shift(1)}>→</button><button className="btn light compact" onClick={()=>setRefresh(n=>n+1)}><RefreshCw size={15}/> Оновити</button></div>
 <div className="learning-row">{role==='admin'&&<select aria-label="Викладач" value={teacherFilter} onChange={e=>setTeacherFilter(e.target.value)}><option value="">Усі викладачі</option>{profiles.filter(p=>p.role==='teacher').map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}</select>}{role==='admin'&&<select aria-label="Студент" value={studentFilter} onChange={e=>setStudentFilter(e.target.value)}><option value="">Усі студенти</option>{studentRows.map(p=><option value={p.id} key={p.id}>{p.full_name}</option>)}</select>}<select aria-label="Навчальна група" value={groupFilter} onChange={e=>setGroupFilter(e.target.value)}><option value="">Усі групи</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></div></div>
 {loading&&<div className="panel learning-alert">Завантаження записів відвідуваності…</div>}
 {error&&<div className="panel learning-alert learning-danger" role="alert">{error}</div>}
 {success&&<div className="learning-confirm" role="status"><Check size={16}/>{success}</div>}
 <div className="learning-kpis"><div className="panel"><span>Відмічено</span><strong>{validMarks.length}</strong></div><div className="panel"><span>Присутність</span><strong>{pct===null?'—':pct+'%'}</strong></div><div className="panel"><span>Пропуски</span><strong>{absent}</strong></div><div className="panel"><span>Запізнення</span><strong>{late}</strong></div></div>
 <div className="panel"><h2><CalendarCheck size={18}/> Заняття</h2><label>Обери урок<select value={current?.id||''} onChange={e=>setChosen(e.target.value)}><option value="">Немає заняття</option>{filtered.map(l=><option key={l.id} value={l.id}>{l.lesson_date} {l.starts_at.slice(0,5)} · {l.title}</option>)}</select></label>
 {!loading&&!current&&<p className="muted">За вибраний період занять не знайдено.</p>}
 {current&&<><p className="muted">{current.lesson_date} · {current.starts_at.slice(0,5)}–{current.ends_at.slice(0,5)} · {name.get(current.teacher_id||'')||'Викладач не призначений'}</p>
 {people.length?<div className="attendance-table">{people.map(id=>{const mark=marks.find(m=>m.student_id===id&&m.lesson_id===current.id);return <div className="attendance-person" key={id}><span><strong>{name.get(id)||'Студент'}</strong><small>{mark?labels[mark.status]:'Не відмічено'}</small></span>{editable?<div className="attendance-actions">{(['present','absent','late'] as Mark[]).map(status=><button disabled={!!saving} key={status} className={'attendance-pill '+status+(mark?.status===status?' selected':'')} onClick={()=>void setMark(current,id,status)}>{labels[status]}</button>)}</div>:<strong className={'attendance-tag '+(mark?.status||'')}>{mark?labels[mark.status]:'—'}</strong>}</div>;})}</div>:<p className="muted">До цього заняття не закріплені студенти.</p>}</>}
 </div>
 <p className="muted">Відмітки можна виправляти. Кожну зміну статусу журнал зберігає в історії.</p>
 </section>;
}
