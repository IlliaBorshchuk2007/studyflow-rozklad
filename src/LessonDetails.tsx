import { useEffect } from 'react';
import { ArrowRight, CalendarDays, Clock3, Link2, Pencil, UserRound, UsersRound, X } from 'lucide-react';
import { STATUS_LABEL, type Lesson, type RescheduleEvent } from './lib/types.ts';
import { safeLink } from './lib/calendar.ts';

const formatDate=(date:string)=>new Intl.DateTimeFormat('uk-UA',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
const formatTime=(time:string)=>time.slice(0,5);

export default function LessonDetails({lesson,teacher,students,group,history,canEdit,onEdit,onAttendance,onRequest,originalTeacher,onClose}:{
 lesson:Lesson;teacher:string;students:string[];group:string;history:RescheduleEvent[];
 canEdit:boolean;onEdit:()=>void;onAttendance:()=>void;onRequest:()=>void;originalTeacher:string;onClose:()=>void;
}){
 useEffect(()=>{const handle=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};
  window.addEventListener('keydown',handle);
  return()=>window.removeEventListener('keydown',handle);
 },[onClose]);
 const meeting=safeLink(lesson.link);
 const materials=safeLink(lesson.materials_url);
 return <div className="overlay lesson-details-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
  <section className="dialog lesson-details" role="dialog" aria-modal="true" aria-labelledby="lesson-details-title">
   <div className="dialog-head"><div><div className="eyebrow">ІНФОРМАЦІЯ ПРО ЗАНЯТТЯ</div><h2 id="lesson-details-title">{lesson.title}</h2><span className={`status status-${lesson.status}`}>{STATUS_LABEL[lesson.status]}</span></div><button autoFocus className="icon-btn" onClick={onClose} aria-label="Закрити деталі заняття"><X size={20}/></button></div>
   <div className="lesson-details-content">
    <div className="detail-row"><CalendarDays size={18}/><div><strong>Дата</strong><span>{formatDate(lesson.lesson_date)}</span></div></div>
    <div className="detail-row"><Clock3 size={18}/><div><strong>Час</strong><span>{formatTime(lesson.starts_at)}–{formatTime(lesson.ends_at)} · {lesson.duration_minutes} хв</span></div></div>
    <div className="detail-row"><UserRound size={18}/><div><strong>Викладач</strong><span>{teacher||'Не призначений'}</span>{originalTeacher&&originalTeacher!==teacher&&<small>Заміна викладача: {originalTeacher}{lesson.substitution_reason?' · '+lesson.substitution_reason:''}</small>}</div></div>
    <div className="detail-row"><UsersRound size={18}/><div><strong>Студенти / група</strong><span>{group||students.join(', ')||'Не призначено'}</span>{group&&students.length>0&&<small>{students.join(', ')}</small>}</div></div>
    <div className="detail-row"><Link2 size={18}/><div><strong>Місце або посилання</strong>{lesson.room&&<span>{lesson.room}</span>}{meeting?<a href={meeting} target="_blank" rel="noreferrer">Відкрити онлайн-заняття <ArrowRight size={14}/></a>:!lesson.room&&<span>Не зазначено</span>}</div></div>
    {lesson.note&&<div className="detail-note"><strong>Примітки</strong><p>{lesson.note}</p></div>}
    {lesson.homework&&<div className="detail-note"><strong>Домашнє завдання</strong><p>{lesson.homework}</p></div>}
    {materials&&<div className="detail-note"><a href={materials} target="_blank" rel="noreferrer">Матеріали заняття <ArrowRight size={14}/></a></div>}
    {history.length>0&&<section className="detail-moves"><h3>Історія перенесень</h3>{history.map(item=><div className="detail-move" key={item.id}><div><small>Було</small><span>{formatDate(item.old_date)} · {formatTime(item.old_starts_at)}–{formatTime(item.old_ends_at)}</span></div><ArrowRight size={17}/><div><small>Стало</small><span>{formatDate(item.new_date)} · {formatTime(item.new_starts_at)}–{formatTime(item.new_ends_at)}</span></div></div>)}</section>}
   </div>
   <div className="dialog-actions"><button className="btn light" onClick={onAttendance}>Відвідуваність</button><button className="btn light" onClick={onRequest}>Заявка на перенесення</button>{canEdit&&<button className="btn primary" onClick={onEdit}><Pencil size={16}/> Редагувати / перенести</button>}<button className="btn light" onClick={onClose}>Закрити</button></div>
  </section>
 </div>;
}
