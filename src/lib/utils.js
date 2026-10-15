export const DAYS = [
  { id: 1, name: 'Понеділок', short: 'Пн' },
  { id: 2, name: 'Вівторок', short: 'Вт' },
  { id: 3, name: 'Середа', short: 'Ср' },
  { id: 4, name: 'Четвер', short: 'Чт' },
  { id: 5, name: 'Пʼятниця', short: 'Пт' },
  { id: 6, name: 'Субота', short: 'Сб' },
  { id: 7, name: 'Неділя', short: 'Нд' },
];

const KYIV = 'Europe/Kyiv';
const pad = (n) => String(n).padStart(2, '0');

export function kyivNow() {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: KYIV,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const fields = Object.fromEntries(formatter.formatToParts(new Date()).map(({ type, value }) => [type, value]));
  const date = new Date(Date.UTC(Number(fields.year), Number(fields.month) - 1, Number(fields.day)));
  const day = date.getUTCDay() || 7;
  return {
    date, day,
    minutes: Number(fields.hour) * 60 + Number(fields.minute),
    hour: Number(fields.hour),
    minute: Number(fields.minute),
  };
}

export function currentWeekDates(now = kyivNow()) {
  const monday = new Date(now.date);
  monday.setUTCDate(monday.getUTCDate() - (now.day - 1));
  return DAYS.map((day, i) => {
    const date = new Date(monday);
    date.setUTCDate(date.getUTCDate() + i);
    return { ...day, date, dateLabel: `${pad(date.getUTCDate())}.${pad(date.getUTCMonth() + 1)}` };
  });
}

export const toMinutes = (time = '00:00') => {
  const [h, m] = String(time).slice(0, 5).split(':').map(Number);
  return h * 60 + m;
};

export function fromMinutes(minutes) {
  const normalized = Math.max(0, Math.min(1439, minutes));
  return `${pad(Math.floor(normalized / 60))}:${pad(normalized % 60)}`;
}

export function prettyTime(value) {
  return String(value ?? '').slice(0, 5);
}

export function durationText(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} хв`;
  return m ? `${h} год ${m} хв` : `${h} год`;
}

export function safeUrl(url) {
  if (!url?.trim()) return '';
  try {
    const parsed = new URL(url.trim());
    return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : '';
  } catch {
    return '';
  }
}

export function nextLesson(lessons, now = kyivNow()) {
  const candidates = lessons.map((lesson) => {
    const daysAhead = (lesson.day_of_week - now.day + 7) % 7;
    const offset = daysAhead * 1440 + toMinutes(lesson.starts_at) - now.minutes;
    return { lesson, offset: offset > 0 ? offset : offset + 10080 };
  }).sort((a, b) => a.offset - b.offset);
  return candidates[0] || null;
}

export function defaultLesson(day) {
  const now = kyivNow();
  const rounded = Math.ceil((now.minutes + 10) / 30) * 30;
  const start = rounded <= 22 * 60 ? fromMinutes(rounded) : '09:00';
  return {
    title: '', day_of_week: day ?? now.day,
    starts_at: start, ends_at: fromMinutes(toMinutes(start) + 60),
    duration_minutes: 60, note: '', link: '',
  };
}

export const SUBJECT_COLORS = ['blue', 'violet', 'orange', 'green', 'rose', 'cyan'];
export function lessonColor(text) {
  let value = 0;
  for (const char of String(text)) value = (value * 31 + char.charCodeAt(0)) | 0;
  return SUBJECT_COLORS[Math.abs(value) % SUBJECT_COLORS.length];
}

export function loadOrCreateProfile() {
  try {
    const existing = JSON.parse(localStorage.getItem('lesson-planner-profile') || 'null');
    if (existing && /^[a-f\d-]{36}$/i.test(existing.id)) {
      return { id: existing.id, name: String(existing.name || 'Гість').slice(0, 32) };
    }
  } catch { /* localStorage може бути вимкнено */ }
  const profile = { id: crypto.randomUUID(), name: 'Гість' };
  saveProfile(profile);
  return profile;
}

export function saveProfile(profile) {
  try { localStorage.setItem('lesson-planner-profile', JSON.stringify(profile)); } catch { /* ignore */ }
}

export const DEMO_LESSONS = [
  { id: 'demo-1', title: 'Англійська мова', day_of_week: 1, starts_at: '09:00', ends_at: '10:00', duration_minutes: 60, note: 'Speaking practice', link: '', created_by: 'demo', created_by_name: 'Демо' },
  { id: 'demo-2', title: 'Математика', day_of_week: 1, starts_at: '11:30', ends_at: '12:30', duration_minutes: 60, note: '', link: '', created_by: 'demo', created_by_name: 'Демо' },
  { id: 'demo-3', title: 'Французька мова', day_of_week: 2, starts_at: '10:00', ends_at: '11:30', duration_minutes: 90, note: 'Урок з граматики', link: '', created_by: 'demo', created_by_name: 'Демо' },
  { id: 'demo-4', title: 'Історія', day_of_week: 3, starts_at: '13:00', ends_at: '14:00', duration_minutes: 60, note: '', link: '', created_by: 'demo', created_by_name: 'Демо' },
  { id: 'demo-5', title: 'Англійська мова', day_of_week: 4, starts_at: '09:30', ends_at: '10:30', duration_minutes: 60, note: '', link: '', created_by: 'demo', created_by_name: 'Демо' },
  { id: 'demo-6', title: 'Програмування', day_of_week: 5, starts_at: '15:00', ends_at: '16:30', duration_minutes: 90, note: 'Практичне заняття', link: '', created_by: 'demo', created_by_name: 'Демо' },
  { id: 'demo-7', title: 'Розмовний клуб', day_of_week: 6, starts_at: '12:00', ends_at: '13:00', duration_minutes: 60, note: 'Онлайн-зустріч', link: '', created_by: 'demo', created_by_name: 'Демо' },
];

export function sortLessons(lessons) {
  return [...lessons].sort((a, b) => a.day_of_week - b.day_of_week ||
    toMinutes(a.starts_at) - toMinutes(b.starts_at) || String(a.id).localeCompare(String(b.id)));
}
