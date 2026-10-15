import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAYS, currentWeekDates, toMinutes, fromMinutes, safeUrl,
  durationText, nextLesson, sortLessons,
} from '../src/lib/utils.js';

test('сім днів і дати з понеділка до неділі', () => {
  assert.equal(DAYS.length, 7);
  const now = { date: new Date(Date.UTC(2026, 9, 15)), day: 4, minutes: 12 * 60 };
  const week = currentWeekDates(now);
  assert.equal(week[0].dateLabel, '12.10');
  assert.equal(week[6].dateLabel, '18.10');
});

test('час початку/кінця та тривалість', () => {
  assert.equal(toMinutes('09:15:00'), 555);
  assert.equal(fromMinutes(555), '09:15');
  assert.equal(durationText(90), '1 год 30 хв');
});

test('відсікаються небезпечні URL', () => {
  assert.equal(safeUrl('javascript:alert(1)'), '');
  assert.equal(safeUrl('data:text/html,hi'), '');
  assert.equal(safeUrl('https://example.com'), 'https://example.com/');
});

test('сортування за днем і початком', () => {
  const list = [
    { id: '2', day_of_week: 2, starts_at: '09:00' },
    { id: '1', day_of_week: 1, starts_at: '14:00' },
    { id: '3', day_of_week: 1, starts_at: '08:00' },
  ];
  assert.deepEqual(sortLessons(list).map(({ id }) => id), ['3', '1', '2']);
});

test('пошук наступного уроку за днем', () => {
  const lessons = [
    { id: 'a', day_of_week: 4, starts_at: '13:00' },
    { id: 'b', day_of_week: 5, starts_at: '08:30' },
  ];
  const next = nextLesson(lessons, { day: 4, minutes: 12 * 60 });
  assert.equal(next.lesson.id, 'a');
  assert.equal(next.offset, 60);
});
