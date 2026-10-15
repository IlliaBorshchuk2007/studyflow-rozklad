import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, LayoutDashboard, ChartNoAxesColumnIncreasing, UserRound, Plus,
  Clock3, ChevronRight, ArrowUpRight, Link2, Pencil, Trash2, X, Save,
  BookOpenText, Copy, Check, Info, RefreshCw, GraduationCap, Sparkles,
  CalendarClock, ArrowRight, UsersRound, CircleAlert, Wifi, WifiOff,
} from 'lucide-react';
import { supabase, isConfigured } from './lib/supabase';
import {
  DAYS, DEMO_LESSONS, currentWeekDates, defaultLesson, durationText, fromMinutes,
  kyivNow, lessonColor, loadOrCreateProfile, nextLesson, prettyTime, safeUrl,
  saveProfile, sortLessons, toMinutes,
} from './lib/utils';

const DURATIONS = [15, 25, 30, 45, 50, 60, 75, 90, 120, 150, 180, 240];
const formatNumber = (n) => new Intl.NumberFormat('uk-UA').format(n);

function initialDemo() {
  try {
    const stored = localStorage.getItem('lesson-planner-demo');
    if (stored !== null) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* use sample */ }
  return DEMO_LESSONS;
}

function Avatar({ name, size = 'normal' }) {
  return <span className={`avatar avatar-${size}`} aria-hidden="true">{name?.trim()?.[0]?.toUpperCase() || 'Г'}</span>;
}

function Sidebar({ profile, stats, onNavigate }) {
  const menu = [
    { id: 'schedule', icon: CalendarDays, text: 'Розклад занять' },
    { id: 'statistics', icon: ChartNoAxesColumnIncreasing, text: 'Статистика' },
    { id: 'profile', icon: UserRound, text: 'Мій профіль' },
  ];
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><BookOpenText size={23} strokeWidth={2.3} /></div>
        <div><div className="brand-title">study<span>flow.</span></div><div className="brand-subtitle">твій навчальний простір</div></div>
      </div>
      <div className="sidebar-middle">
        <div className="sidebar-label">РОБОЧИЙ ПРОСТІР</div>
        <nav className="sidebar-nav" aria-label="Навігація">
          {menu.map(({ id, icon: Icon, text }, i) => (
            <button key={id} className={`nav-link ${i === 0 ? 'nav-primary' : ''}`} onClick={() => onNavigate(id)}>
              <Icon size={19} strokeWidth={2} /><span>{text}</span>{i === 0 && <ChevronRight size={16} className="nav-arrow" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-label second-label">ВАШ ТИЖДЕНЬ</div>
        <div className="sidebar-summary">
          <span className="summary-icon"><GraduationCap size={20} /></span>
          <span><strong>{stats.count} занять</strong><small>у спільному розкладі</small></span>
        </div>
        <div className="sidebar-summary">
          <span className="summary-icon lavender"><Clock3 size={19} /></span>
          <span><strong>{durationText(stats.minutes)}</strong><small>навчання за тиждень</small></span>
        </div>
      </div>
      <div className="sidebar-bottom">
        <div className="mini-quote"><Sparkles size={17} /><span>Маленькі кроки щодня — великі результати.</span></div>
        <button className="sidebar-profile" onClick={() => onNavigate('profile')}>
          <Avatar name={profile.name} />
          <span><strong>{profile.name}</strong><small>Мій профіль</small></span>
          <ChevronRight size={17} />
        </button>
      </div>
    </aside>
  );
}

function StatCard({ icon: Icon, variant, label, value, subtext, badge }) {
  return (
    <div className="stat-card">
      <div className="stat-top"><div className={`stat-icon ${variant}`}><Icon size={19} strokeWidth={2.1} /></div>{badge && <span className="stat-badge">{badge}</span>}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-desc">{subtext}</div>
    </div>
  );
}

function LessonCard({ lesson, onEdit }) {
  const link = safeUrl(lesson.link);
  return (
    <article className={`lesson-card subject-${lessonColor(lesson.title)}`}>
      <div className="lesson-top"><span className="lesson-time"><Clock3 size={12} />{prettyTime(lesson.starts_at)}–{prettyTime(lesson.ends_at)}</span><button className="lesson-edit" aria-label={`Редагувати ${lesson.title}`} title="Редагувати урок" onClick={() => onEdit(lesson)}><Pencil size={14} /></button></div>
      <div className="lesson-name">{lesson.title}</div>
      <div className="lesson-length">{durationText(lesson.duration_minutes)}</div>
      {lesson.note && <div className="lesson-note" title={lesson.note}>{lesson.note}</div>}
      {link && <a className="lesson-link" href={link} target="_blank" rel="noopener noreferrer" title="Відкрити посилання"><Link2 size={13} />Посилання <ArrowUpRight size={12} /></a>}
    </article>
  );
}

function WeekBoard({ lessons, now, dates, onAdd, onEdit, loading }) {
  return (
    <div className="week-board" aria-label="Розклад на сім днів">
      {dates.map((day) => {
        const dayLessons = lessons.filter((lesson) => lesson.day_of_week === day.id);
        return (
          <div className={`day-column ${now.day === day.id ? 'day-today' : ''}`} key={day.id}>
            <div className="day-head">
              <div className="day-head-top"><span className="day-short">{day.short}</span><span className="day-date">{day.dateLabel}</span></div>
              <div className="day-name">{day.name}</div>
              <div className="day-caption">{now.day === day.id ? <span className="today-pill">● Сьогодні</span> : <span>{dayLessons.length} {dayLessons.length === 1 ? 'заняття' : 'занять'}</span>}</div>
            </div>
            <div className="day-body">
              {loading ? <div className="lesson-placeholder">Завантаження…</div> : dayLessons.length ? dayLessons.map((lesson) => <LessonCard key={lesson.id} lesson={lesson} onEdit={onEdit} />) : <div className="day-empty"><div className="empty-icon"><CalendarDays size={21} strokeWidth={1.5} /></div><span>Поки вільно</span><small>Час для себе ✨</small></div>}
              <button className="day-add" onClick={() => onAdd(day.id)}><Plus size={15} />Додати урок</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Statistics({ lessons, stats, profile }) {
  const max = Math.max(1, ...DAYS.map((day) => lessons.filter((lesson) => lesson.day_of_week === day.id).length));
  const personal = lessons.filter((lesson) => lesson.created_by === profile.id);
  const ownMinutes = personal.reduce((total, lesson) => total + lesson.duration_minutes, 0);
  const avg = stats.count ? Math.round(stats.minutes / stats.count) : 0;
  const busiest = DAYS.find((day) => day.id === stats.busiestDay);
  return (
    <section id="statistics" className="analytics-section">
      <div className="section-heading"><div><div className="eyebrow">АНАЛІТИКА</div><h2>Тиждень у цифрах <span className="heading-emoji">📊</span></h2><p>Подивись, як розподіляється навчальний час.</p></div></div>
      <div className="analytics-grid">
        <div className="panel activity-panel">
          <div className="panel-heading"><div><h3>Активність за днями</h3><p>Кількість занять протягом тижня</p></div><div className="tiny-icon"><ChartNoAxesColumnIncreasing size={19} /></div></div>
          <div className="activity-chart">
            {DAYS.map((day) => {
              const count = lessons.filter((lesson) => lesson.day_of_week === day.id).length;
              return <div className="bar-group" key={day.id}><div className="bar-number">{count || ''}</div><div className="bar-track"><div className={`bar-fill ${stats.busiestDay === day.id && count > 0 ? 'bar-highlight' : ''}`} style={{ height: `${Math.max(count ? 8 : 0, (count / max) * 100)}%` }} /></div><span className="bar-label">{day.short}</span></div>;
            })}
          </div>
        </div>
        <div className="panel insights-panel"><div className="panel-heading"><div><h3>Підсумки розкладу</h3><p>Невеликі спостереження</p></div><div className="tiny-icon orange-icon"><Sparkles size={19} /></div></div>
          <div className="insight-row"><div className="insight-symbol lavender"><Clock3 size={18} /></div><div><small>Середня тривалість уроку</small><strong>{stats.count ? durationText(avg) : 'Немає уроків'}</strong></div></div>
          <div className="insight-row"><div className="insight-symbol mint"><CalendarClock size={18} /></div><div><small>Найзавантаженіший день</small><strong>{busiest?.name || 'Ще не визначено'}</strong></div></div>
          <div className="insight-row"><div className="insight-symbol amber"><UsersRound size={18} /></div><div><small>Додано з твого браузера</small><strong>{personal.length} занять · {durationText(ownMinutes)}</strong></div></div>
        </div>
      </div>
    </section>
  );
}

function ProfilePanel({ profile, onSave, lessons }) {
  const [draft, setDraft] = useState(profile.name);
  useEffect(() => setDraft(profile.name), [profile.name]);
  const own = lessons.filter((lesson) => lesson.created_by === profile.id);
  const minutes = own.reduce((sum, lesson) => sum + lesson.duration_minutes, 0);
  function submit(e) {
    e.preventDefault();
    const name = draft.trim().slice(0, 32);
    if (!name) return;
    onSave({ ...profile, name });
  }
  return (
    <section id="profile" className="profile-section">
      <div className="section-heading"><div><div className="eyebrow">ОСОБИСТЕ</div><h2>Мій профіль <span className="heading-emoji">👋</span></h2><p>Трохи статистики, яка належить саме цьому браузеру.</p></div></div>
      <div className="profile-panel panel">
        <div className="profile-left"><Avatar name={profile.name} size="big" /><div><h3>{profile.name}</h3><p>Локальний профіль без реєстрації</p><span className="profile-tag"><Check size={12} /> Готовий до навчання</span></div></div>
        <div className="profile-edit"><form onSubmit={submit}><label htmlFor="profile-name">Твоє імʼя або псевдонім</label><div className="name-controls"><input id="profile-name" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={32} placeholder="Як до тебе звертатися?" required /><button type="submit" className="button button-dark"><Save size={16} />Зберегти</button></div></form><small>Імʼя показуватиметься для нових уроків. Це не захищений обліковий запис.</small></div>
        <div className="profile-mini-stats"><div><strong>{own.length}</strong><span>Створено уроків</span></div><div><strong>{durationText(minutes)}</strong><span>Заплановано тобою</span></div></div>
      </div>
    </section>
  );
}

function LessonDialog({ initial, onClose, onSave, onDelete, saving }) {
  const editing = Boolean(initial?.id);
  const [form, setForm] = useState(() => initial || defaultLesson());
  const [validation, setValidation] = useState('');
  const diff = toMinutes(form.ends_at) - toMinutes(form.starts_at);
  const durationChoices = [...new Set([...DURATIONS, ...(diff > 0 && diff <= 480 ? [diff] : [])])].sort((a, b) => a - b);

  useEffect(() => {
    const esc = (event) => { if (event.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose, saving]);

  function changeTime(field, value) {
    setValidation('');
    setForm((prev) => {
      if (field === 'starts_at') {
        const start = toMinutes(value);
        const end = Math.min(start + Math.max(15, prev.duration_minutes), 1439);
        return { ...prev, starts_at: value, ends_at: fromMinutes(end), duration_minutes: end - start };
      }
      return { ...prev, ends_at: value, duration_minutes: toMinutes(value) - toMinutes(prev.starts_at) };
    });
  }

  function changeDuration(value) {
    const duration = Number(value);
    const end = toMinutes(form.starts_at) + duration;
    if (end >= 1440) {
      setValidation('Час завершення має бути до 23:59. Обери раніший початок або коротший урок.');
      return;
    }
    setValidation('');
    setForm((prev) => ({ ...prev, duration_minutes: duration, ends_at: fromMinutes(end) }));
  }

  async function submit(e) {
    e.preventDefault();
    const title = form.title.trim();
    const minutes = toMinutes(form.ends_at) - toMinutes(form.starts_at);
    if (!title || title.length > 120) return setValidation('Назва уроку має містити від 1 до 120 символів.');
    if (!form.starts_at || !form.ends_at || minutes < 1 || minutes > 480) return setValidation('Кінець уроку має бути пізніше початку; тривалість — до 8 годин.');
    if (form.note.length > 500) return setValidation('Примітка має містити не більш як 500 символів.');
    if (form.link.trim() && !safeUrl(form.link)) return setValidation('Посилання повинно починатися з https:// або http://');
    setValidation('');
    await onSave({ title, day_of_week: Number(form.day_of_week), starts_at: prettyTime(form.starts_at), ends_at: prettyTime(form.ends_at), duration_minutes: minutes, note: form.note.trim(), link: safeUrl(form.link) });
  }
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="lesson-modal-title">
        <div className="modal-head"><div><div className="eyebrow">{editing ? 'РЕДАГУВАННЯ' : 'НОВИЙ ЗАПИС'}</div><h2 id="lesson-modal-title">{editing ? 'Редагувати урок' : 'Додати заняття'}</h2><p>Обери день, час і тривалість уроку.</p></div><button className="icon-button" onClick={onClose} disabled={saving} aria-label="Закрити"><X size={19} /></button></div>
        <form onSubmit={submit} className="lesson-form">
          <label className="field"><span>Назва уроку <b>*</b></span><input autoFocus required maxLength={120} placeholder="Наприклад, Англійська мова" value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} /></label>
          <label className="field"><span>День тижня <b>*</b></span><select value={form.day_of_week} onChange={(e) => setForm((prev) => ({ ...prev, day_of_week: Number(e.target.value) }))}>{DAYS.map((day) => <option key={day.id} value={day.id}>{day.name}</option>)}</select></label>
          <div className="form-triple"><label className="field"><span>Початок <b>*</b></span><input type="time" step="60" required value={prettyTime(form.starts_at)} onChange={(e) => changeTime('starts_at', e.target.value)} /></label><label className="field"><span>Завершення <b>*</b></span><input type="time" step="60" required value={prettyTime(form.ends_at)} onChange={(e) => changeTime('ends_at', e.target.value)} /></label><label className="field"><span>Тривалість</span><select value={diff > 0 && diff <= 480 ? diff : ''} onChange={(e) => changeDuration(e.target.value)}><option value="" disabled>—</option>{durationChoices.map((minutes) => <option value={minutes} key={minutes}>{minutes} хв</option>)}</select></label></div>
          <div className="form-hint"><Info size={14} /> Зміни тривалість — час завершення оновиться автоматично.</div>
          <label className="field"><span>Примітка <em>необовʼязково</em></span><textarea value={form.note} onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))} maxLength={500} rows={3} placeholder="Тема, кабінет, домашнє завдання…" /></label>
          <label className="field"><span>Посилання <em>необовʼязково</em></span><div className="input-with-icon"><Link2 size={17} /><input type="url" maxLength={500} value={form.link} onChange={(e) => setForm((prev) => ({ ...prev, link: e.target.value }))} placeholder="https://meet.google.com/…" /></div></label>
          {validation && <div className="form-error" role="alert"><CircleAlert size={17} />{validation}</div>}
          <div className="modal-footer">{editing && <button type="button" className="button button-danger" disabled={saving} onClick={onDelete}><Trash2 size={16} />Видалити</button>}<div className="modal-footer-right"><button type="button" className="button button-plain" disabled={saving} onClick={onClose}>Скасувати</button><button type="submit" className="button button-primary" disabled={saving}><Save size={16} />{saving ? 'Зберігаємо…' : 'Зберегти урок'}</button></div></div>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const [profile, setProfile] = useState(loadOrCreateProfile);
  const [lessons, setLessons] = useState(() => isConfigured ? [] : initialDemo());
  const [loading, setLoading] = useState(isConfigured);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(kyivNow);
  const [online, setOnline] = useState(true);

  const notify = useCallback((message, type = 'success') => setToast({ message, type }), []);
  const fetchLessons = useCallback(async (silent = false) => {
    if (!supabase) return;
    if (!silent) setLoading(true);
    const { data, error: fetchError } = await supabase.from('lessons').select('*').order('day_of_week').order('starts_at');
    if (fetchError) {
      setError(`Не вдалося завантажити уроки: ${fetchError.message}. Перевір SQL-схему та ключ.`);
    } else {
      setLessons(sortLessons(data || []));
      setError('');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    fetchLessons();
    const channel = supabase.channel('weekly-lessons-public')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lessons' }, () => fetchLessons(true))
      .subscribe((status) => setOnline(status === 'SUBSCRIBED'));
    const interval = window.setInterval(() => fetchLessons(true), 45000); // резервний шлях, якщо Realtime недоступний
    const onVisible = () => { if (document.visibilityState === 'visible') fetchLessons(true); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); supabase.removeChannel(channel); };
  }, [fetchLessons]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(kyivNow()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (supabase) return;
    try { localStorage.setItem('lesson-planner-demo', JSON.stringify(lessons)); } catch { /* ignore */ }
  }, [lessons]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const dates = useMemo(() => currentWeekDates(now), [now]);
  const stats = useMemo(() => {
    const minutes = lessons.reduce((sum, lesson) => sum + lesson.duration_minutes, 0);
    const byDay = DAYS.map((day) => ({ day: day.id, count: lessons.filter((lesson) => lesson.day_of_week === day.id).length }));
    const maxDay = byDay.reduce((best, item) => item.count > best.count ? item : best, { day: null, count: 0 });
    return { count: lessons.length, minutes, busiestDay: maxDay.day, next: nextLesson(lessons, now) };
  }, [lessons, now]);

  const openAdd = useCallback((day) => setModal({ lesson: defaultLesson(day), editing: false }), []);
  const openEdit = useCallback((lesson) => setModal({ lesson, editing: true }), []);
  const closeModal = useCallback(() => setModal(null), []);

  async function saveLesson(payload) {
    if (!modal) return;
    setSaving(true);
    try {
      if (supabase) {
        const data = modal.editing ? supabase.from('lessons').update(payload).eq('id', modal.lesson.id)
          : supabase.from('lessons').insert({ ...payload, created_by: profile.id, created_by_name: profile.name });
        const { error: saveError } = await data;
        if (saveError) throw saveError;
        await fetchLessons(true);
      } else if (modal.editing) {
        setLessons((items) => sortLessons(items.map((lesson) => lesson.id === modal.lesson.id ? { ...lesson, ...payload } : lesson)));
      } else {
        setLessons((items) => sortLessons([...items, { ...payload, id: crypto.randomUUID(), created_by: profile.id, created_by_name: profile.name }]));
      }
      closeModal();
      notify(modal.editing ? 'Урок успішно оновлено' : 'Новий урок додано до розкладу');
    } catch (saveError) {
      notify(`Помилка збереження: ${saveError.message}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function deleteLesson() {
    if (!modal?.editing || !window.confirm(`Видалити урок «${modal.lesson.title}»? Цю дію не можна скасувати.`)) return;
    setSaving(true);
    try {
      if (supabase) {
        const { error: deleteError } = await supabase.from('lessons').delete().eq('id', modal.lesson.id);
        if (deleteError) throw deleteError;
        await fetchLessons(true);
      } else setLessons((items) => items.filter((lesson) => lesson.id !== modal.lesson.id));
      closeModal();
      notify('Урок видалено');
    } catch (deleteError) {
      notify(`Помилка видалення: ${deleteError.message}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.origin + window.location.pathname);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
      notify('Посилання скопійовано — поділись з друзями!');
    } catch {
      window.prompt('Скопіюй адресу сайту:', window.location.href);
    }
  }

  function navigate(id) { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  function updateProfile(next) { setProfile(next); saveProfile(next); notify('Імʼя збережено в цьому браузері'); }

  const next = stats.next;
  const nextLabel = next ? `${DAYS[next.lesson.day_of_week - 1].short}, ${prettyTime(next.lesson.starts_at)}` : 'Немає занять';
  const todayDate = new Intl.DateTimeFormat('uk-UA', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(now.date);

  return (
    <div className="app-shell">
      <Sidebar profile={profile} stats={stats} onNavigate={navigate} />
      <div className="app-right">
        <header className="topbar"><div className="breadcrumb"><span>Мій простір</span><ChevronRight size={15} /><strong>Розклад уроків</strong></div><div className="topbar-right"><div className="zone-label"><span className="zone-dot" />Час за Києвом</div><button className="top-user" onClick={() => navigate('profile')}><Avatar name={profile.name} /><span>{profile.name}</span></button></div></header>
        <main className="content">
          {!isConfigured && <div className="demo-notice" role="status"><Info size={19} /><div><strong>Демонстраційний режим.</strong> Зміни зберігаються лише в цьому браузері. Щоб усі бачили один розклад, під'єднай Supabase за інструкцією в README.md.</div></div>}
          {error && <div className="error-notice" role="alert"><CircleAlert size={20} /><span>{error}</span><button onClick={() => fetchLessons()}><RefreshCw size={16} />Спробувати знову</button></div>}
          <div className="hero"><div><div className="welcome-line"><span className="welcome-sun">✦</span> {todayDate} · {DAYS[now.day - 1].name}</div><h1>Твій тиждень, <span>твій ритм.</span> <span className="wave">✌️</span></h1><p>Усі уроки в одному місці. Плануй, навчайся та рухайся вперед.</p></div><div className="hero-buttons"><button className="button button-outline" onClick={share}>{copied ? <Check size={17} /> : <Copy size={17} />}{copied ? 'Скопійовано' : 'Поділитись'}</button><button className="button button-primary" onClick={() => openAdd(now.day)}><Plus size={18} />Додати урок</button></div></div>
          <div className="stats-grid">
            <StatCard icon={BookOpenText} variant="stat-blue" label="Занять на тиждень" value={formatNumber(stats.count)} subtext="У спільному розкладі" badge="7 днів" />
            <StatCard icon={Clock3} variant="stat-purple" label="Годин навчання" value={durationText(stats.minutes)} subtext="Загальний час уроків" />
            <StatCard icon={CalendarClock} variant="stat-peach" label="Найактивніший день" value={stats.busiestDay ? DAYS[stats.busiestDay - 1].name : '—'} subtext="Найбільше занять" />
            <StatCard icon={ArrowRight} variant="stat-green" label="Наступний урок" value={nextLabel} subtext={next?.lesson.title || 'Додай перший урок'} />
          </div>
          <section id="schedule" className="schedule-section"><div className="section-heading"><div><div className="eyebrow">НАВЧАЛЬНИЙ ПЛАНЕР</div><h2>Розклад на тиждень <span className="heading-emoji">🗓️</span></h2><p>Один тиждень, сім днів і всі твої плани перед очима.</p></div><div className="section-tools"><span className="week-range">{dates[0].dateLabel} — {dates[6].dateLabel}</span><button className="refresh-button" title="Оновити розклад" aria-label="Оновити розклад" onClick={() => supabase ? fetchLessons() : notify('Це демонстраційні дані у твоєму браузері')}><RefreshCw size={17} /></button></div></div><WeekBoard lessons={lessons} now={now} dates={dates} onAdd={openAdd} onEdit={openEdit} loading={loading} /><div className="schedule-footnote"><span className={`connection-dot ${online || !isConfigured ? 'active' : 'waiting'}`} />{isConfigured ? (online ? 'Спільний розклад синхронізується автоматично' : 'Оновлення перевіряються кожні 45 секунд') : 'Демо — спільне редагування стане доступним після підключення Supabase'}<span className="footnote-right">Розклад повторюється щотижня</span></div></section>
          <Statistics lessons={lessons} stats={stats} profile={profile} />
          <ProfilePanel profile={profile} lessons={lessons} onSave={updateProfile} />
          <footer className="footer"><span>studyflow. <span>© {now.date.getUTCFullYear()}</span></span><span>Створено для навчання з любов'ю <span className="footer-heart">♥</span></span></footer>
        </main>
      </div>
      {modal && <LessonDialog key={modal.lesson.id || `new-${modal.lesson.day_of_week}`} initial={modal.lesson} onClose={closeModal} onSave={saveLesson} onDelete={deleteLesson} saving={saving} />}
      {toast && <div className={`toast ${toast.type === 'error' ? 'toast-error' : ''}`} role="status">{toast.type === 'error' ? <CircleAlert size={18} /> : <Check size={18} />}{toast.message}<button onClick={() => setToast(null)} aria-label="Закрити повідомлення"><X size={16} /></button></div>}
    </div>
  );
}
