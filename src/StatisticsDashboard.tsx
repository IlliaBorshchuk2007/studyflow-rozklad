import {useEffect,useMemo,useState} from 'react';
import {ArrowRight,BarChart3,CalendarDays,ChevronLeft,ChevronRight,RefreshCw} from 'lucide-react';
import {supabase} from './lib/supabase.ts';
import {addDays,dateISO,monthStart,parseISO,weekStart,kyivToday} from './lib/calendar.ts';
import {STATUS_LABEL,type AuditEntry,type Group,type Lesson,type LessonStatus,type Membership,type Profile,type Role} from './lib/types.ts';
import './dashboard.css';

type Period='day'|'week'|'month'|'semester'|'custom';
type Bucket={label:string;date:string;count:number};
type ChartRow={id:string;name:string;value:number;completed:number;minutes:number};
const COLORS:{[K in LessonStatus]:string}={scheduled:'#6b8af1',completed:'#25ae80',cancelled:'#eb7082',rescheduled:'#f3b953'};
const lastDay=(y:number,m:number)=>dateISO(new Date(Date.UTC(y,m,0,12)));
const lengthDays=(a:string,b:string)=>Math.round((parseISO(b).getTime()-parseISO(a).getTime())/86400000)+1;
const pickPeriod=(p:Period,date:string,customStart:string,customEnd:string)=>{
 const d=parseISO(date),y=d.getUTCFullYear(),m=d.getUTCMonth()+1;
 if(p==='day')return [date,date] as const;
 if(p==='week')return [weekStart(date),addDays(weekStart(date),6)] as const;
 if(p==='month')return [monthStart(date),lastDay(y,m)] as const;
 if(p==='semester'){
  if(m===1)return [String(y-1)+'-09-01',String(y)+'-01-31'] as const;
  if(m>=9)return [String(y)+'-09-01',String(y+1)+'-01-31'] as const;
  return [String(y)+'-02-01',String(y)+'-08-31'] as const;
 }
 return [customStart,customEnd] as const;
};
async function getAll<T>(table:'lessons'|'lesson_audit',first:string,last:string,dateField:string):Promise<T[]>{
 if(!supabase)throw new Error('Немає підключення Supabase');
 let all:T[]=[];
 for(let offset=0;offset<50000;offset+=500){
  const {data,error}=await supabase.from(table).select('*').gte(dateField,first).lte(dateField,last).order(dateField).range(offset,offset+499);
  if(error)throw error;
  const rows=(data||[]) as T[];all=all.concat(rows);
  if(rows.length<500)return all;
 }
 throw new Error('Забагато записів для завантаження. Зменши діапазон дат.');
}
function tally<T extends string>(values:T[],keys:T[]):Record<T,number>{
 return Object.fromEntries(keys.map(key=>[key,values.filter(v=>v===key).length])) as Record<T,number>;
}
function percentDelta(now:number,before:number){if(before===0)return now===0?'0%': 'Новий показник';return ((now-before)/before*100>=0?'+':'')+((now-before)/before*100).toFixed(1)+'%';}
function dateBuckets(data:Lesson[],start:string,end:string,p:Period):Bucket[]{
 const span=lengthDays(start,end);
 const step=p==='semester'||span>45?7:1;
 const bins:Bucket[]=[];
 for(let i=0;i<span;i+=step){const begin=addDays(start,i),finish=addDays(start,Math.min(span-1,i+step-1));bins.push({date:begin,label:step===1?begin.slice(5):begin.slice(5)+'–'+finish.slice(5),count:data.filter(l=>l.lesson_date>=begin&&l.lesson_date<=finish).length});}
 return bins;
}
const order:LessonStatus[]=['scheduled','completed','rescheduled','cancelled'];

export default function StatisticsDashboard({profiles,groups,members,role,onOpenLessons,onOpenUsers}:{
 profiles:Profile[];groups:Group[];members:Membership[];role:Role;viewer:string;
 onOpenLessons:(date:string,opts?:{status?:LessonStatus;teacherId?:string;groupId?:string;subject?:string})=>void;
 onOpenUsers:()=>void;
}){
 const today=kyivToday();const [period,setPeriod]=useState<Period>('week');
 const [date,setDate]=useState(today);const [customStart,setCustomStart]=useState(today);const [customEnd,setCustomEnd]=useState(today);
 const [teacherId,setTeacherId]=useState(''),[studentId,setStudentId]=useState(''),[groupId,setGroupId]=useState(''),[subject,setSubject]=useState('');
 const [data,setData]=useState<Lesson[]>([]),[previous,setPrevious]=useState<Lesson[]>([]),[audit,setAudit]=useState<AuditEntry[]>([]);
 const [loading,setLoading]=useState(false),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);
 const [activityKind,setActivityKind]=useState<'created'|'rescheduled'|'cancelled'>('created');
 const [chartGrain,setChartGrain]=useState<'day'|'week'|'month'>('day');
 const [showCompare,setShowCompare]=useState(true);
 const [start,end]=pickPeriod(period,date,customStart,customEnd);
 const invalid=start>end||!start||!end||lengthDays(start,end)>366;
 const span=!invalid?lengthDays(start,end):0;
 const previousStart=addDays(start,-span),previousEnd=addDays(start,-1);
 useEffect(()=>{if(invalid){setError('Обери правильні дати (не більше 366 днів).');setData([]);setPrevious([]);return;}
  let active=true;setLoading(true);setError('');
  void Promise.all([
    getAll<Lesson>('lessons',start,end,'lesson_date'),
    getAll<Lesson>('lessons',previousStart,previousEnd,'lesson_date'),
    role!=='student'?getAll<AuditEntry>('lesson_audit',start+'T00:00:00+00:00',end+'T23:59:59+00:00','occurred_at'):Promise.resolve([] as AuditEntry[])
  ]).then(([a,b,c])=>{if(!active)return;setData(a);setPrevious(b);setAudit(c);}).catch(e=>{if(active)setError(e instanceof Error?e.message:String(e));}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[start,end,previousStart,previousEnd,invalid,role,refresh]);
 const groupMembers=useMemo(()=>new Map(groups.map(g=>[g.id,members.filter(m=>m.group_id===g.id&&m.member_role==='student').map(m=>m.user_id)])),[groups,members]);
 const accept=(l:Lesson)=>{
  if(teacherId&&l.teacher_id!==teacherId)return false;
  if(groupId&&l.group_id!==groupId)return false;
  if(studentId&&l.student_id!==studentId&&!(l.group_id&&(groupMembers.get(l.group_id)||[]).includes(studentId)))return false;
  if(subject&&!l.title.toLocaleLowerCase('uk').includes(subject.toLocaleLowerCase('uk')))return false;
  return true;
 };
 const lessons=data.filter(accept),prior=previous.filter(accept);
 const count=tally(lessons.map(l=>l.status),order);
 const oldCount=tally(prior.map(l=>l.status),order);
 const teachers=profiles.filter(p=>p.role==='teacher'),students=profiles.filter(p=>p.role==='student');
 const teacherRows:ChartRow[]=teachers.map(t=>{const ls=lessons.filter(l=>l.teacher_id===t.id);return {id:t.id,name:t.full_name,value:ls.length,completed:ls.filter(l=>l.status==='completed').length,minutes:ls.reduce((a,l)=>a+(l.status==='cancelled'?0:l.duration_minutes),0)};}).filter(r=>r.value>0).sort((a,b)=>b.minutes-a.minutes);
 const groupRows:ChartRow[]=groups.map(g=>{const ls=lessons.filter(l=>l.group_id===g.id);return {id:g.id,name:g.name,value:ls.length,completed:ls.filter(l=>l.status==='completed').length,minutes:ls.reduce((a,l)=>a+(l.status==='cancelled'?0:l.duration_minutes),0)};}).filter(r=>r.value>0).sort((a,b)=>b.value-a.value);
 const relevantStudents=students.filter(p=>!groupId||(groupMembers.get(groupId)||[]).includes(p.id));
 const courses=Object.entries(relevantStudents.reduce((out,p)=>{if(p.course!=null)out[p.course]=(out[p.course]||0)+1;return out;},{} as Record<string,number>)).sort((a,b)=>+a[0]-(+b[0]));
 const special=Object.entries(relevantStudents.reduce((out,p)=>{if(p.specialty)out[p.specialty]=(out[p.specialty]||0)+1;return out;},{} as Record<string,number>)).sort((a,b)=>b[1]-a[1]);
 const studentGroups=groups.map(g=>({id:g.id,name:g.name,count:(groupMembers.get(g.id)||[]).length}));
 const events=audit.filter(h=>{
  const payload=(h.new_data||h.old_data||{}) as Record<string,unknown>;
  if(teacherId&&payload.teacher_id!==teacherId)return false;
  if(groupId&&payload.group_id!==groupId)return false;
  if(studentId&&payload.student_id!==studentId&&!(typeof payload.group_id==='string'&&(groupMembers.get(payload.group_id)||[]).includes(studentId)))return false;
  if(subject&&!(String(payload.title||h.lesson_title).toLocaleLowerCase('uk').includes(subject.toLocaleLowerCase('uk'))))return false;
  return true;
 });
 const eventCount={created:events.filter(h=>h.action==='created').length,rescheduled:events.filter(h=>h.action==='rescheduled').length,cancelled:events.filter(h=>h.action==='updated'&&(h.new_data as Record<string,unknown>|null)?.status==='cancelled'&&(h.old_data as Record<string,unknown>|null)?.status!=='cancelled').length};
 const keys=['created','rescheduled','cancelled'] as const;
 const currentEvents=events.filter(h=>activityKind==='created'?h.action==='created':activityKind==='rescheduled'?h.action==='rescheduled':h.action==='updated'&&(h.new_data as Record<string,unknown>|null)?.status==='cancelled'&&(h.old_data as Record<string,unknown>|null)?.status!=='cancelled');
 const binDate=chartGrain==='month'?(d:string)=>d.slice(0,7):chartGrain==='week'?(d:string)=>weekStart(d):(d:string)=>d;
 const activityCounts=new Map<string,number>();
 for(const h of currentEvents){const d=binDate(h.occurred_at.slice(0,10));activityCounts.set(d,(activityCounts.get(d)||0)+1);}
 const activityData=Array.from(activityCounts,([date,count])=>({date,count})).sort((a,b)=>a.date.localeCompare(b.date));
 const totalTeachersWithLessons=teacherRows.length,averageTeacher=totalTeachersWithLessons?Math.round(teacherRows.reduce((s,r)=>s+r.minutes,0)/totalTeachersWithLessons):null;
 const completionRate=lessons.length?(count.completed/lessons.length*100):null;
 const bins=dateBuckets(lessons,start,end,period);
 const maxBin=Math.max(1,...bins.map(b=>b.count));
 const maxTeacher=Math.max(1,...teacherRows.map(r=>r.value)),maxGroup=Math.max(1,...groupRows.map(r=>r.value));
 const totalStatus=lessons.length;
 const degs=order.map(k=>360*(count[k]/Math.max(1,totalStatus)));
 let at=0;const gradient='conic-gradient('+order.map((k,i)=>{const lo=at;at+=degs[i];return COLORS[k]+' '+lo.toFixed(2)+'deg '+at.toFixed(2)+'deg';}).join(', ')+')';
 const jump=(opts?:{status?:LessonStatus;teacherId?:string;groupId?:string;subject?:string},day=start)=>onOpenLessons(day,{teacherId,groupId,subject,...opts});
 const changeDate=(dir:number)=>{
  if(period==='custom')return;
  setDate(v=>addDays(v,dir*(period==='day'?1:period==='week'?7:period==='month'?30:160)));
 };
 const studentVisibility=role==='admin'?'Усього в системі':'Доступні вашій ролі';
 return <section className="panel-page an-dashboard">
 <div className="page-heading"><div className="eyebrow">НАВЧАЛЬНА АНАЛІТИКА</div><h1>Статистика StudyFlow</h1><p>Справжні дані Supabase. Показники залежать від ролі, періоду та обраних фільтрів.</p></div>
 <div className="panel an-filters"><div className="an-periods">{(['day','week','month','semester','custom'] as Period[]).map((p,i)=><button key={p} className={'btn '+(p===period?'primary':'light')} onClick={()=>setPeriod(p)}>{['День','Тиждень','Місяць','Семестр','Свої дати'][i]}</button>)}</div>
 <div className="an-row">{period==='custom'?<><label>Від<input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)}/></label><label>До<input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)}/></label></>:<><button className="btn light compact" onClick={()=>changeDate(-1)}><ChevronLeft size={16}/></button><strong>{start} — {end}</strong><button className="btn light compact" onClick={()=>changeDate(1)}><ChevronRight size={16}/></button><button className="btn light compact" onClick={()=>setDate(today)}>Сьогодні</button></>}<button className="btn light compact" onClick={()=>setRefresh(x=>x+1)}><RefreshCw size={15}/> Оновити</button></div>
 <div className="an-row an-dropdowns"><select aria-label="Викладач" value={teacherId} onChange={e=>setTeacherId(e.target.value)}><option value="">Усі викладачі</option>{teachers.map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}</select><select aria-label="Студент" value={studentId} onChange={e=>setStudentId(e.target.value)}><option value="">Усі студенти</option>{students.map(p=><option key={p.id} value={p.id}>{p.full_name}</option>)}</select><select aria-label="Група" value={groupId} onChange={e=>setGroupId(e.target.value)}><option value="">Усі групи</option>{groups.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><input aria-label="Предмет" placeholder="Пошук предмета" value={subject} onChange={e=>setSubject(e.target.value)}/></div>
 <label className="an-compare"><input type="checkbox" checked={showCompare} onChange={e=>setShowCompare(e.target.checked)}/> Порівнювати з попереднім таким самим періодом</label>
 <small>Семестри умовно: вересень–січень і лютий–серпень; точні дати можна обрати вручну.</small></div>
 {loading&&<div className="panel an-info" role="status"><RefreshCw size={18}/> Завантаження навчальної статистики…</div>}
 {error&&<div className="panel an-info an-error" role="alert">{error} <button className="btn light compact" onClick={()=>setRefresh(n=>n+1)}>Повторити</button></div>}
 {!loading&&!error&&<>
 <div className="an-kpis">
 {([['Всього занять',lessons.length,'Усі уроки у вибраному періоді, включно зі скасованими.',undefined],['Заплановано',count.scheduled,'Заняття зі статусом «Заплановано».','scheduled'],['Проведено',count.completed,'Заняття, позначені як проведені.','completed'],['Перенесено',count.rescheduled,'Актуальні уроки зі статусом перенесення.','rescheduled'],['Скасовано',count.cancelled,'Заняття зі статусом скасування.','cancelled']] as [string,number,string,LessonStatus|undefined][]).map(([name,val,tip,status])=><button className="an-kpi" key={name} title={tip} onClick={()=>jump(status?{status}:undefined)}><span>{name} <small title={tip}>ⓘ</small></span><strong>{val}</strong><span>{showCompare?percentDelta(val,status?oldCount[status]:prior.length)+' до попереднього':'Відкрити заняття'} <ArrowRight size={13}/></span></button>)}
 <button className="an-kpi" onClick={()=>jump()} title="Проведені / усі уроки вибраного періоду"><span>Частка проведених ⓘ</span><strong>{completionRate==null?'—':completionRate.toFixed(1)+'%'}</strong><span>{completionRate==null?'Немає занять':'Відкрити розклад'}</span></button>
 <div className="an-kpi" title="Середня сумарна тривалість нескасованих уроків на викладача, який має уроки у вибраному періоді"><span>На викладача ⓘ</span><strong>{averageTeacher==null?'—':(averageTeacher/60).toFixed(1)+' год'}</strong><span>{averageTeacher==null?'Немає даних':'Середнє навантаження'}</span></div>
 <button className="an-kpi" onClick={onOpenUsers}><span>Студенти / викладачі / групи</span><strong>{students.length} / {teachers.length} / {groups.length}</strong><span>{studentVisibility} <ArrowRight size={13}/></span></button>
 </div>
 {!lessons.length&&<div className="panel an-info"><CalendarDays size={21}/> За обраними фільтрами занять немає. Зміни період або критерії.</div>}
 <div className="an-charts">
 <div className="panel an-chart"><h2><BarChart3 size={18}/> Динаміка занять</h2><p>Кількість занять за {bins.length>40?'тижнями':'днями'}; натисни на стовпчик, щоб перейти в календар.</p><svg className="an-line" viewBox="0 0 620 128" preserveAspectRatio="none" role="img" aria-label="Лінійний графік кількості занять">{bins.length>1&&<polyline fill="none" stroke="#6a7ff1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={bins.map((b,i)=>String(10+i*600/(bins.length-1))+','+String(116-b.count/maxBin*100)).join(' ')}/>} {bins.map((b,i)=><circle key={b.date} cx={bins.length===1?310:10+i*600/(bins.length-1)} cy={116-b.count/maxBin*100} r="4.5" fill="#6a7ff1"><title>{b.label}: {b.count}</title></circle>)}</svg><div className="an-timeline">{bins.map(b=><button key={b.date} className="an-tick" onClick={()=>jump(undefined,b.date)} title={b.label+': '+b.count}><strong>{b.count}</strong><div className="an-track"><div style={{height:(b.count/maxBin*100)+'%'}}/></div><small>{b.label}</small></button>)}</div></div>
 <div className="panel an-chart"><h2>Статуси занять</h2><p>Співвідношення поточних статусів для вибраного періоду.</p>{totalStatus?<div className="an-pie-layout"><div className="an-donut" style={{background:gradient}}><span>{totalStatus}<small>занять</small></span></div><div className="an-legend">{order.map(k=><button key={k} onClick={()=>jump({status:k})}><i style={{background:COLORS[k]}}/>{STATUS_LABEL[k]}<strong>{count[k]}</strong></button>)}</div></div>:<div className="blank-state">Немає даних для діаграми</div>}</div>
 <div className="panel an-chart"><h2>Навантаження викладачів</h2><p>Рейтинг за обсягом занять; тривалість у підказці.</p>{teacherRows.length?teacherRows.slice(0,10).map(r=><button className="an-bar-row" title={r.minutes+' хв · проведено '+r.completed} key={r.id} onClick={()=>jump({teacherId:r.id})}><span>{r.name}</span><div><i style={{width:r.value/maxTeacher*100+'%',background:'#6a7ff1'}}/></div><strong>{r.value}</strong></button>):<div className="blank-state">У вибраному періоді немає призначених викладачів</div>}</div>
 <div className="panel an-chart"><h2>Навантаження навчальних груп</h2><p>Кількість занять у групі, а не кількість учасників.</p>{groupRows.length?groupRows.slice(0,10).map(r=><button className="an-bar-row" key={r.id} onClick={()=>jump({groupId:r.id})}><span>{r.name}</span><div><i style={{width:r.value/maxGroup*100+'%',background:'#25ae80'}}/></div><strong>{r.value}</strong></button>):<div className="blank-state">Групових занять немає</div>}</div>
 <div className="panel an-chart"><h2>Розподіл студентів</h2><p>Профілі студентів із заповненими академічними полями, без припущень.</p>
 <h3>За курсами</h3>{courses.length?courses.map(([course,n])=><div className="an-dist" key={course}><span>{course} курс</span><strong>{n}</strong></div>):<p className="muted">Курси ще не заповнені.</p>}
 <h3>За спеціальностями</h3>{special.length?special.slice(0,12).map(([spec,n])=><div className="an-dist" key={spec}><span>{spec}</span><strong>{n}</strong></div>):<p className="muted">Спеціальності ще не заповнені.</p>}
 <h3>За групами</h3>{studentGroups.length?studentGroups.map(g=><div className="an-dist" key={g.id}><span>{g.name}</span><strong>{g.count}</strong></div>):<p className="muted">Груп немає.</p>}
 </div>
 <div className="panel an-chart"><h2>Динаміка змін</h2><p>Події з журналу аудиту Supabase; це не поточні статуси занять.</p>{role==='student'?<p className="muted">Журнал адміністративних дій недоступний для ролі студента.</p>:<><div className="an-periods">{keys.map(k=><button key={k} className={'btn '+(activityKind===k?'primary':'light')} onClick={()=>setActivityKind(k)}>{({created:'Створення',rescheduled:'Перенесення',cancelled:'Скасування'} as const)[k]} · {eventCount[k]}</button>)}</div><div className="an-periods">{(['day','week','month'] as const).map(k=><button className={'btn compact '+(chartGrain===k?'primary':'light')} key={k} onClick={()=>setChartGrain(k)}>{({day:'Дні',week:'Тижні',month:'Місяці'} as const)[k]}</button>)}</div>{activityData.length?activityData.map(b=><div className="an-dist" key={b.date}><span>{b.date}</span><strong>{b.count}</strong></div>):<p className="muted">Подій цього типу за період не було.</p>}</>}
 </div>
 </div>
 <p className="an-footnote">Аналітика враховує тільки записи, дозволені вашій ролі політиками Supabase. Дані профілів і складу груп можуть бути неповними. Порівняння — з попереднім періодом такої самої тривалості.</p>
 </>}
 </section>;
}
