import {useMemo,useState} from 'react';
import {ArrowRight,ArrowUpRight,Bell,BookOpen,CalendarDays,CheckCircle2,ChevronLeft,ChevronRight,Clock3,GraduationCap,MapPin,Moon,Plus,Search,SlidersHorizontal,Sun,UsersRound,X,ChartNoAxesCombined} from 'lucide-react';
import {addDays,addMonths,kyivToday,monthCells,parseISO,showDate,weekDays,weekStart} from './lib/calendar.ts';
import './design-preview.css';

type Page='schedule'|'attendance'|'groups'|'statistics'|'notifications'|'users'|'requests';
type DemoRole='admin'|'teacher'|'student';
const roleLabels:Record<DemoRole,string>={admin:'Адміністратор',teacher:'Викладач',student:'Студент'};
const roleName:Record<DemoRole,string>={admin:'Адміністратор StudyFlow',teacher:'Олена Коваленко',student:'Студент КН-31'};
type View='day'|'week'|'month';
type Status='scheduled'|'completed'|'rescheduled'|'cancelled';
type Event={id:string;day:number;start:string;end:string;title:string;teacher:string;room:string;kind:string;status:Status;color:string};
const events:Event[]=[
{id:'1',day:0,start:'09:00',end:'10:20',title:'Дискретна математика',teacher:'Олена Коваленко',room:'Ауд. 301',kind:'Лекція',status:'completed',color:'green'},
{id:'2',day:0,start:'11:10',end:'12:30',title:'Англійська мова',teacher:'Марія Бондар',room:'Ауд. 218',kind:'Практична',status:'scheduled',color:'purple'},
{id:'3',day:0,start:'14:20',end:'15:40',title:'Програмування',teacher:'Сергій Іваненко',room:'Ауд. 412',kind:'Лабораторна',status:'scheduled',color:'orange'},
{id:'4',day:1,start:'09:40',end:'11:00',title:'Бази даних',teacher:'Андрій Романчук',room:'Ауд. 203',kind:'Практична',status:'completed',color:'blue'},
{id:'5',day:1,start:'13:10',end:'14:30',title:'Вебтехнології',teacher:'Катерина Литвин',room:'Онлайн',kind:'Лекція',status:'rescheduled',color:'sand'},
{id:'6',day:2,start:'10:10',end:'11:30',title:'Операційні системи',teacher:'Дмитро Мельник',room:'Ауд. 204',kind:'Лекція',status:'scheduled',color:'green'},
{id:'7',day:2,start:'15:00',end:'16:20',title:'Дизайн інтерфейсів',teacher:'Віктор Шевчук',room:'Онлайн',kind:'Практична',status:'scheduled',color:'purple'},
{id:'8',day:3,start:'09:00',end:'10:20',title:'Математика',teacher:'Олена Коваленко',room:'Ауд. 301',kind:'Лекція',status:'scheduled',color:'blue'},
{id:'9',day:3,start:'12:30',end:'13:50',title:'Комп’ютерні мережі',teacher:'Ігор Романюк',room:'Ауд. 305',kind:'Лабораторна',status:'scheduled',color:'orange'},
{id:'10',day:4,start:'09:30',end:'10:50',title:'Англійська мова',teacher:'Марія Бондар',room:'Ауд. 218',kind:'Практична',status:'cancelled',color:'rose'},
{id:'11',day:4,start:'13:00',end:'14:20',title:'Теорія ймовірностей',teacher:'Олена Коваленко',room:'Ауд. 301',kind:'Лекція',status:'scheduled',color:'green'},
{id:'12',day:5,start:'11:00',end:'12:20',title:'Розмовний клуб',teacher:'Марія Бондар',room:'Онлайн',kind:'Додаткове',status:'scheduled',color:'purple'}
];
const statuses:Record<Status,string>={scheduled:'Заплановано',completed:'Проведено',rescheduled:'Перенесено',cancelled:'Скасовано'};
const menu:[Page,string,typeof CalendarDays][]=[['schedule','Розклад',CalendarDays],['attendance','Відвідуваність',CheckCircle2],['groups','Навчальні групи',UsersRound],['statistics','Статистика',ChartNoAxesCombined],['requests','Заявки',CalendarDays],['users','Користувачі',UsersRound],['notifications','Сповіщення',Bell]];
const accessible=(page:Page,role:DemoRole)=>page!=='users'||role==='admin';
const eventForRole=(e:Event,role:DemoRole)=>role==='admin'||(role==='teacher'?e.teacher==='Олена Коваленко':e.id!=='12');
const labels=['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];
const minutes=(time:string)=>Number(time.slice(0,2))*60+Number(time.slice(3,5));
const fmt=(d:string)=>showDate(d,{day:'numeric',month:'long',year:'numeric'});
function LessonTile({lesson,open,compact=false}:{lesson:Event;open:(event:Event)=>void;compact?:boolean}){
return <button type="button" className={'dp-lesson dp-color-'+lesson.color+(lesson.status==='cancelled'?' dp-cancelled':'')} onClick={()=>open(lesson)}>
<span className="dp-l-time">{lesson.start}–{lesson.end}</span><strong>{lesson.title}</strong>
{!compact&&<span className="dp-l-sub">{lesson.kind} · {lesson.teacher}</span>}
<span className={'dp-l-status dp-s-'+lesson.status}>{statuses[lesson.status]}</span></button>;
}
export default function DesignPreview(){
const [page,setPage]=useState<Page>('schedule');
const [role,setRole]=useState<DemoRole>('admin');
const [view,setView]=useState<View>('week');
const [date,setDate]=useState(kyivToday());
const [filter,setFilter]=useState<Status|'all'>('all');
const [query,setQuery]=useState('');
const [dark,setDark]=useState(false);
const [focused,setFocused]=useState<Event|null>(null);
const [about,setAbout]=useState(false);
const today=kyivToday();
const days=weekDays(date);
const results=useMemo(()=>events.filter(e=>eventForRole(e,role)&&(filter==='all'||e.status===filter)&&(!query||[e.title,e.teacher,e.room].join(' ').toLocaleLowerCase('uk').includes(query.toLocaleLowerCase('uk')))),[filter,query,role]);
const roleMenu=menu.filter(([key])=>accessible(key,role));
const switchRole=(newRole:DemoRole)=>{setRole(newRole);setPage('schedule');setQuery('');setFilter('all');setView('week');};
const forDay=(d:string)=>results.filter(e=>addDays(weekStart(d),e.day)===d);
const selected=forDay(date);
const jump=(delta:number)=>setDate(d=>view==='week'?addDays(d,delta*7):view==='day'?addDays(d,delta):addMonths(d,delta));
const pageLabel=roleMenu.find(x=>x[0]===page)?.[1]||'Розклад';
return <div className={'dp-shell'+(dark?' dp-dark':'')}>
<aside className="dp-sidebar">
<div className="dp-brand"><span className="dp-brand-icon"><BookOpen size={20}/></span><div><strong>studyflow<span>.</span></strong><small>Навчальна платформа</small></div></div>
<div className="dp-side-role"><label htmlFor="dp-role-sidebar">РЕЖИМ ПЕРЕГЛЯДУ</label><select id="dp-role-sidebar" aria-label="Переглянути сайт як" value={role} onChange={e=>switchRole(e.target.value as DemoRole)}>{(Object.keys(roleLabels) as DemoRole[]).map(key=><option key={key} value={key}>{roleLabels[key]}</option>)}</select></div>
<span className="dp-sidebar-caption">РОБОЧИЙ ПРОСТІР</span>
<nav className="dp-nav">{roleMenu.map(([key,label,Icon])=><button key={key} className={'dp-nav-item'+(page===key?' active':'')} onClick={()=>setPage(key)}><Icon size={18}/><span>{label}</span>{key==='notifications'&&<i className="dp-dot"/>}</button>)}</nav>
<div className="dp-spacer"/>
<div className="dp-aside-note"><strong>Попередній перегляд</strong><small>Інтерфейс ролі: {roleLabels[role]}. Жодних змін у робочих даних.</small></div>
<div className="dp-profile"><div className="dp-avatar">{role==='admin'?'А':role==='teacher'?'В':'С'}</div><div><strong>{roleName[role]}</strong><small>{roleLabels[role]} · Демо</small></div></div>
</aside>
<div className="dp-main">
<header className="dp-topbar"><div className="dp-breadcrumb">Мій простір <ChevronRight size={14}/> <strong>{pageLabel}</strong></div><div className="dp-top-right"><label className="dp-top-role">Роль <select aria-label="Роль для тестування" value={role} onChange={e=>switchRole(e.target.value as DemoRole)}>{(Object.keys(roleLabels) as DemoRole[]).map(key=><option key={key} value={key}>{roleLabels[key]}</option>)}</select></label><span className="dp-top-preview"><span/> Preview</span><button className="dp-icon-btn" onClick={()=>setDark(!dark)} aria-label="Перемкнути тему">{dark?<Sun size={18}/>:<Moon size={18}/>}</button><button className="dp-icon-btn" onClick={()=>setPage('notifications')} aria-label="Сповіщення"><Bell size={18}/></button><span className="dp-avatar">{role==='admin'?'А':role==='teacher'?'В':'С'}</span></div></header>
<main className="dp-content">
<div className="dp-preview-note"><span><strong>Тестова версія дизайну</strong> · Роль: {roleLabels[role]} · Демонстраційні дані, без запису до бази</span><a href="https://studyflow-rozklad.vercel.app" target="_blank" rel="noreferrer">Поточний сайт <ArrowUpRight size={14}/></a></div>
{page==='schedule'&&<>
<section className="dp-hero"><div><span className="dp-eyebrow">{role==='admin'?'КЕРУВАННЯ НАВЧАЛЬНИМ ПРОЦЕСОМ':role==='teacher'?'ПЕРСОНАЛЬНИЙ РОЗКЛАД ВИКЛАДАЧА':'НАВЧАЛЬНИЙ РОЗКЛАД'}</span><h1>{role==='admin'?'Розклад закладу':role==='teacher'?'Мої заняття':'Мій розклад'}<span>.</span></h1><p>{role==='admin'?'Усі заняття, групи та викладачі в одному календарі.':role==='teacher'?'Переглядайте свої заняття та керуйте навчальним часом.':'Заняття, викладачі й зміни в одному місці.'}</p></div><button className="dp-btn dark" onClick={()=>setAbout(true)}>{role==='student'?<CalendarDays size={16}/>:<Plus size={16}/>} {role==='student'?'Про цей дизайн':'Створити заняття'}</button></section>
<section className="dp-calendar">
<div className="dp-calendar-head"><div><span className="dp-eyebrow">КАЛЕНДАР ЗАНЯТЬ</span><h2>{view==='month'?showDate(date,{month:'long',year:'numeric'}):view==='day'?fmt(date):showDate(days[0],{day:'numeric',month:'long'})+' — '+fmt(days[6])}</h2></div><div className="dp-head-controls"><button className="dp-arrow" aria-label="Назад" onClick={()=>jump(-1)}><ChevronLeft size={18}/></button><button className="dp-btn outline" onClick={()=>setDate(today)}>Сьогодні</button><button className="dp-arrow" aria-label="Вперед" onClick={()=>jump(1)}><ChevronRight size={18}/></button><div className="dp-view-switch">{(['day','week','month'] as View[]).map((v,i)=><button key={v} className={view===v?'current':''} onClick={()=>setView(v)}>{['День','Тиждень','Місяць'][i]}</button>)}</div></div></div>
<div className="dp-filters"><label className="dp-search"><Search size={16}/><input placeholder="Предмет або викладач…" aria-label="Пошук" value={query} onChange={e=>setQuery(e.target.value)}/></label><label className="dp-status-select"><SlidersHorizontal size={16}/><select aria-label="Статус" value={filter} onChange={e=>setFilter(e.target.value as Status|'all')}><option value="all">Усі статуси</option>{(Object.keys(statuses) as Status[]).map(s=><option key={s} value={s}>{statuses[s]}</option>)}</select></label><small>{results.length} занять · {roleLabels[role]}</small></div>
{view==='week'&&<><div className="dp-week-scroll"><div className="dp-week-grid"><div className="dp-grid-corner"/>{days.map((d,i)=><button key={d} className={'dp-weekday'+(d===today?' today':'')} onClick={()=>{setDate(d);setView('day');}}><small>{labels[i]}</small><strong>{parseISO(d).getUTCDate()}</strong></button>)}<div className="dp-hour-labels">{Array.from({length:12},(_,i)=><span key={i}>{String(i+8).padStart(2,'0')}:00</span>)}</div>{days.map((d,i)=><div key={d} className={'dp-day-track'+(d===today?' today':'')}>{results.filter(e=>e.day===i).map(e=><div key={e.id} className="dp-pos" style={{top:(minutes(e.start)-480)/60*74,height:Math.max(55,(minutes(e.end)-minutes(e.start))/60*74)}}><LessonTile lesson={e} open={setFocused} compact/></div>)}{!results.some(e=>e.day===i)&&<span className="dp-free-day">Немає занять</span>}</div>)}</div></div><div className="dp-mobile-week"><div className="dp-day-selector">{days.map((d,i)=><button key={d} className={date===d?'selected':''} onClick={()=>setDate(d)}><small>{labels[i]}</small><strong>{parseISO(d).getUTCDate()}</strong>{results.some(e=>e.day===i)&&<i/>}</button>)}</div><div className="dp-day-lessons">{selected.length?selected.map(e=><LessonTile key={e.id} lesson={e} open={setFocused}/>):<p className="dp-empty">На цей день занять немає.</p>}</div></div></>}
{view==='day'&&<div className="dp-day-view"><div className="dp-day-view-heading"><CalendarDays size={17}/>{fmt(date)}<span>{selected.length} занять</span></div>{selected.length?selected.map(e=><div key={e.id} className="dp-agenda-item"><div className="dp-agenda-time"><strong>{e.start}</strong><small>{e.end}</small></div><div className="dp-agenda-rail"/><LessonTile lesson={e} open={setFocused}/></div>):<p className="dp-empty">На обраний день занять немає.</p>}</div>}
{view==='month'&&<div className="dp-month-grid">{labels.map(label=><span className="dp-month-label" key={label}>{label}</span>)}{monthCells(date).map(d=><button key={d} className={'dp-month-day'+(d.slice(0,7)!==date.slice(0,7)?' other':'')+(d===today?' today':'')} onClick={()=>{setDate(d);setView('day');}}><strong>{parseISO(d).getUTCDate()}</strong>{forDay(d).slice(0,3).map(e=><span key={e.id} className={'dp-month-event dp-color-'+e.color}>{e.title}</span>)}</button>)}</div>}
<div className="dp-calendar-foot"><span><CheckCircle2 size={15}/> Календар, у якому легко орієнтуватися</span><span>Час за Києвом</span></div>
</section>
<div className="dp-bottom-cards"><section className="dp-small-card"><div className="dp-card-head"><div><span className="dp-eyebrow">НЕ ПРОПУСТИ</span><h3>Найближчі заняття</h3></div><button onClick={()=>{setView('day');setDate(days[0]);}}>До списку <ArrowRight size={14}/></button></div>{results.slice().sort((a,b)=>a.day-b.day||a.start.localeCompare(b.start)).slice(0,4).map(e=><button key={e.id} className="dp-upcoming" onClick={()=>setFocused(e)}><span className={'dp-upcoming-dot dp-color-'+e.color}/><div><strong>{e.title}</strong><small>{labels[e.day]}, {e.start} · {e.room}</small></div><ArrowUpRight size={15}/></button>)}</section><section className="dp-small-card dp-quiet-card"><span className="dp-eyebrow">ОГЛЯД РОБОЧОГО ПРОСТОРУ</span><h3>{role==='admin'?'Керування розкладом':role==='teacher'?'Навчальне навантаження':'План навчального тижня'}</h3><p>{role==='admin'?'Керуйте групами, заняттями й замінами викладачів.':role==='teacher'?'Контролюйте свої уроки, відвідуваність і заявки.':'Швидко знаходьте час, аудиторію та викладача кожного уроку.'}</p><div className="dp-overview-stat"><strong>{results.length}</strong><span>занять у вибраній ролі</span></div><button onClick={()=>setPage(role==='student'?'attendance':'statistics')}>Переглянути показники <ArrowRight size={15}/></button></section></div>
</>}
{page!=='schedule'&&<section className="dp-other-page"><span className="dp-eyebrow">ПЕРЕГЛЯД ДИЗАЙНУ</span><h1>{pageLabel}</h1><p>Так виглядатимуть інші розділи в одному мінімалістичному стилі. У тесті вони не підключені до бази.</p><div className="dp-preview-cards">{page==='requests'?<><div><small>Очікують розгляду</small><strong>{role==='admin'?'4':'1'}</strong></div><div><small>Підтверджені</small><strong>3</strong></div></>:page==='users'?<><div><small>Користувачі</small><strong>128</strong></div><div><small>Викладачі</small><strong>18</strong></div><div><small>Навчальні групи</small><strong>8</strong></div></>:page==='statistics'?<><div><small>Занять за тиждень</small><strong>12</strong></div><div><small>Проведено</small><strong>4</strong></div><div><small>Перенесено</small><strong>1</strong></div></>:page==='attendance'?<><div><small>Відвідуваність</small><strong>92%</strong></div><div><small>Пропуски</small><strong>2</strong></div><div><small>Запізнення</small><strong>1</strong></div></>:page==='groups'?<><div><small>Група</small><strong>КН-31</strong></div><div><small>Студентів</small><strong>24</strong></div></>:<><div><small>Нове повідомлення</small><strong>Перенесено заняття</strong></div><div><small>Нагадування</small><strong>Завтра о 09:00</strong></div></>}</div><button className="dp-btn dark" onClick={()=>setPage('schedule')}><ArrowRight size={16}/> Повернутися до розкладу</button></section>}
<footer className="dp-footer">studyflow. <span>· концепт інтерфейсу · нічого не записується в базу</span></footer></main></div>
<nav className="dp-mobile-nav">{roleMenu.filter(([key])=>key!=='users'&&key!=='requests').map(([key,label,Icon])=><button key={key} className={page===key?'active':''} onClick={()=>setPage(key)}><Icon size={19}/><span>{key==='attendance'?'Журнал':key==='statistics'?'Дані':key==='groups'?'Групи':key==='notifications'?'Новини':label}</span></button>)}</nav>
{focused&&<div className="dp-modal-backdrop" onClick={()=>setFocused(null)}><section className="dp-modal" role="dialog" aria-modal="true" aria-labelledby="dp-detail-title" onClick={e=>e.stopPropagation()}><div className="dp-modal-top"><span className="dp-eyebrow">ДЕТАЛІ ЗАНЯТТЯ</span><button className="dp-icon-btn" aria-label="Закрити" onClick={()=>setFocused(null)}><X size={19}/></button></div><h2 id="dp-detail-title">{focused.title}</h2><span className={'dp-l-status dp-s-'+focused.status}>{statuses[focused.status]}</span><div className="dp-detail-list"><span><CalendarDays size={17}/>{fmt(addDays(weekStart(date),focused.day))}</span><span><Clock3 size={17}/>{focused.start}–{focused.end}</span><span><GraduationCap size={17}/>{focused.teacher}</span><span><MapPin size={17}/>{focused.room}</span></div><p>Це приклад оформлення заняття. Усі дані демонстраційні.</p><button className="dp-btn dark" onClick={()=>setFocused(null)}>Зрозуміло</button></section></div>}
{about&&<div className="dp-modal-backdrop" onClick={()=>setAbout(false)}><section className="dp-modal" role="dialog" aria-modal="true" aria-labelledby="dp-about-title" onClick={e=>e.stopPropagation()}><div className="dp-modal-top"><span className="dp-eyebrow">ПРО ДИЗАЙН</span><button className="dp-icon-btn" aria-label="Закрити" onClick={()=>setAbout(false)}><X size={19}/></button></div><h2 id="dp-about-title">Тихий простір для навчання</h2><p>Стриманий інтерфейс навчальної платформи: чітка структура, таблиці, календар і нейтральна палітра. Перемикайте ролі адміністратора, викладача та студента, щоб перевірити навігацію і розклад кожного. Це окремий дизайн-макет, тому створення занять і редагування вимкнені.</p><button className="dp-btn dark" onClick={()=>setAbout(false)}>Повернутися до перегляду</button></section></div>}
</div>;
}
