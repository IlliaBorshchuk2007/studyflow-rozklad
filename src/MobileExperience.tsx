import {ArrowRight,Bell,CalendarDays,ChevronLeft,ChevronRight,Clock3,Plus,Search} from 'lucide-react';
import {SHORT_DAYS,showDate} from './lib/calendar.ts';
import {STATUS_LABEL,type Lesson,type Notice,type RescheduleEvent} from './lib/types.ts';

const clock=(s:string)=>s.slice(0,5);
const dateLabel=(date:string)=>showDate(date,{day:'numeric',month:'long'});
type LessonCardProps={lesson:Lesson;teacher:string;group:string;onOpen:(l:Lesson)=>void};
export function CompactLesson({lesson,teacher,group,onOpen}:LessonCardProps){
  return <button type="button" className={`mobile-lesson mobile-lesson-${lesson.status}`} onClick={()=>onOpen(lesson)} aria-label={`Деталі заняття ${lesson.title}, ${clock(lesson.starts_at)}`}>
    <span className="mobile-lesson-time"><Clock3 size={14}/>{clock(lesson.starts_at)}<small>{clock(lesson.ends_at)}</small></span>
    <span className="mobile-lesson-data"><strong>{lesson.title}</strong><span>{teacher||group||'Заняття'}</span></span>
    <span className="mobile-lesson-tail"><span className={`mobile-status mobile-status-${lesson.status}`}>{STATUS_LABEL[lesson.status]}</span><ChevronRight size={16}/></span>
  </button>;
}
type WeekProps={mode:'day'|'week';dates:string[];date:string;today:string;lessons:Lesson[];reschedules:RescheduleEvent[];teacherMap:Record<string,string>;groupMap:Record<string,string>;loading:boolean;canCreate:boolean;onDay:(d:string)=>void;onOpen:(l:Lesson)=>void;onCreate:(d:string)=>void;onMove:(d:string)=>void};
export function MobileWeekView({mode,dates,date,today,lessons,reschedules,teacherMap,groupMap,loading,canCreate,onDay,onOpen,onCreate,onMove}:WeekProps){
 const shown=mode==='day'?[date]:dates;
 const exists=shown.some(d=>lessons.some(l=>l.lesson_date===d)||reschedules.some(r=>r.old_date===d));
 return <div className="mobile-week-view" aria-label="Мобільний розклад">
   <div className="mobile-day-strip" aria-label="Дні тижня">{dates.map((d,i)=><button type="button" aria-pressed={d===date} className={d===date?'selected':''} key={d} onClick={()=>onDay(d)}><span>{SHORT_DAYS[i]}</span><strong>{Number(d.slice(8))}</strong>{lessons.some(l=>l.lesson_date===d)&&<i aria-hidden="true"/>}</button>)}</div>
   {loading&&<div className="mobile-loading" role="status">Завантаження розкладу…</div>}
   {!loading&&!exists&&<div className="mobile-empty"><CalendarDays size={24}/><strong>Немає занять</strong><span>На вибраний період занять не знайдено.</span></div>}
   {!loading&&shown.map(d=>{
      const daily=lessons.filter(l=>l.lesson_date===d);
      const moved=reschedules.filter(r=>r.old_date===d);
      if(mode==='week'&&!daily.length&&!moved.length)return null;
      return <section className="mobile-day-section" key={d}>
        <div className="mobile-day-heading"><div><strong>{dateLabel(d)}</strong><span>{d===today?'Сьогодні · ':''}{daily.length} занять</span></div>{canCreate&&<button type="button" className="mobile-add-day" onClick={()=>onCreate(d)} aria-label={`Додати заняття на ${dateLabel(d)}`}><Plus size={17}/></button>}</div>
        <div className="mobile-lesson-stack">{daily.map(l=><CompactLesson key={l.id} lesson={l} teacher={teacherMap[l.teacher_id||'']||''} group={groupMap[l.group_id||'']||''} onOpen={onOpen}/>)}
        {moved.map(m=><button key={m.id} className="mobile-moved-card" type="button" onClick={()=>onMove(m.new_date)}><span>Перенесене заняття</span><strong>{m.lesson_title}</strong><small>Було {clock(m.old_starts_at)} · Нова дата: {dateLabel(m.new_date)}, {clock(m.new_starts_at)}</small><span className="mobile-moved-link">Перейти до нової дати <ArrowRight size={13}/></span></button>)}
        {!daily.length&&!moved.length&&<p className="mobile-day-empty">На цей день занять немає.</p>}</div>
      </section>;
   })}
 </div>;
}
type WorkspaceProps={mode:'home'|'lessons';date:string;today:string;lessons:Lesson[];notices:Notice[];teacherMap:Record<string,string>;groupMap:Record<string,string>;loading:boolean;canCreate:boolean;search:string;status:string;groupId:string;teacherId:string;groups:{id:string;name:string}[];teachers:{id:string;full_name:string}[];onGroup:(s:string)=>void;onTeacher:(s:string)=>void;onSearch:(s:string)=>void;onStatus:(s:string)=>void;onPrev:()=>void;onNext:()=>void;onToday:()=>void;onOpen:(l:Lesson)=>void;onCreate:()=>void;onSchedule:()=>void;onNotices:()=>void};
export function MobileWorkspace({mode,date,today,lessons,notices,teacherMap,groupMap,loading,canCreate,search,status,groupId,teacherId,groups,teachers,onGroup,onTeacher,onSearch,onStatus,onPrev,onNext,onToday,onOpen,onCreate,onSchedule,onNotices}:WorkspaceProps){
 const listed=mode==='lessons'?lessons.filter(l=>l.lesson_date.slice(0,7)===date.slice(0,7)):lessons;
 const upcoming=lessons.filter(l=>l.lesson_date>=today&&l.status!=='cancelled').slice(0,4);
 const unread=notices.filter(n=>!n.read_at);
 return <section className="mobile-workspace">
   {mode==='home'?<>
    <header className="mobile-workspace-head"><div><span className="eyebrow">Borshchuk Education</span><h1>Головна</h1><p>Твій навчальний простір</p></div><span className="mobile-date-chip">{dateLabel(today)}</span></header>
    <div className="mobile-summary"><button type="button" onClick={onSchedule}><CalendarDays size={19}/><span>Заняття цього тижня</span><strong>{lessons.length}</strong></button><button type="button" onClick={onNotices}><Bell size={19}/><span>Нові сповіщення</span><strong>{unread.length}</strong></button></div>
    <div className="mobile-section-title"><h2>Найближчі заняття</h2><button type="button" onClick={onSchedule}>До розкладу <ArrowRight size={15}/></button></div>
    {loading?<p role="status" className="mobile-loading">Завантаження занять…</p>:upcoming.length?<div className="mobile-lesson-stack">{upcoming.map(l=><div key={l.id}><small className="mobile-list-date">{dateLabel(l.lesson_date)}</small><CompactLesson lesson={l} teacher={teacherMap[l.teacher_id||'']||''} group={groupMap[l.group_id||'']||''} onOpen={onOpen}/></div>)}</div>:<div className="mobile-empty"><CalendarDays size={22}/><strong>Занять цього тижня немає</strong><span>Перевір інший тиждень у розкладі.</span></div>}
    <div className="mobile-section-title"><h2>Останні сповіщення</h2><button type="button" onClick={onNotices}>Усі <ArrowRight size={15}/></button></div>
    <div className="mobile-recent-notices">{notices.slice(0,3).map(n=><button type="button" key={n.id} onClick={onNotices}><Bell size={16}/><span>{n.message}</span><ChevronRight size={16}/></button>)}{!notices.length&&<p>Нових повідомлень поки немає.</p>}</div>
   </>:<>
    <header className="mobile-workspace-head"><div><span className="eyebrow">НАВЧАЛЬНИЙ ПРОЦЕС</span><h1>Заняття</h1><p>Список занять за вибраний місяць</p></div>{canCreate&&<button type="button" aria-label="Додати заняття" className="mobile-primary-icon" onClick={onCreate}><Plus size={21}/></button>}</header>
    <div className="mobile-period-picker"><button type="button" aria-label="Попередній місяць" onClick={onPrev}><ChevronLeft size={19}/></button><strong>{showDate(date,{month:'long',year:'numeric'})}</strong><button type="button" aria-label="Наступний місяць" onClick={onNext}><ChevronRight size={19}/></button><button type="button" className="mobile-today-btn" onClick={onToday}>Сьогодні</button></div>
    <div className="mobile-list-filters"><label><Search size={17}/><input aria-label="Пошук занять у списку" value={search} onChange={e=>onSearch(e.target.value)} placeholder="Пошук предмета чи викладача"/></label><select aria-label="Фільтр статусу занять" value={status} onChange={e=>onStatus(e.target.value)}><option value="">Усі статуси</option>{Object.entries(STATUS_LABEL).map(([key,value])=><option value={key} key={key}>{value}</option>)}</select><select aria-label="Фільтр навчальної групи" value={groupId} onChange={e=>onGroup(e.target.value)}><option value="">Усі групи</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select>{teachers.length>0&&<select aria-label="Фільтр викладача" value={teacherId} onChange={e=>onTeacher(e.target.value)}><option value="">Усі викладачі</option>{teachers.map(t=><option key={t.id} value={t.id}>{t.full_name}</option>)}</select>}</div>
    <div className="mobile-section-title"><h2>Усі заняття</h2><span>{listed.length} результатів</span></div>
    {loading?<p role="status" className="mobile-loading">Завантаження занять…</p>:listed.length?<div className="mobile-lesson-stack">{listed.map(l=><div key={l.id}><small className="mobile-list-date">{dateLabel(l.lesson_date)}</small><CompactLesson lesson={l} teacher={teacherMap[l.teacher_id||'']||''} group={groupMap[l.group_id||'']||''} onOpen={onOpen}/></div>)}</div>:<div className="mobile-empty"><Search size={22}/><strong>Занять не знайдено</strong><span>Зміни фільтр або обери інший місяць.</span></div>}
   </>}
 </section>;
}
