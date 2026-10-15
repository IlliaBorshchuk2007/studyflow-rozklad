import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const types=readFileSync(new URL('../src/lib/types.ts',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const sql=readFileSync(new URL('../supabase/add_completed_status.sql',import.meta.url),'utf8');
test('completed is a supported lesson status',()=>{
  assert.match(types,/LessonStatus[^;]*'completed'/);
  assert.match(types,/completed:'Проведено'/);
  assert.match(app,/<option value="completed">Проведене<\/option>/);
});
test('completed lessons appear in stats',()=>{
  assert.match(app,/completed:visibleLessons\.filter\(l=>l\.status==='completed'\)\.length/);
  assert.match(app,/stats\.completed/);
});
test('database migration accepts completed without removing RLS',()=>{
  assert.match(sql,/CHECK \(status IN \('scheduled','rescheduled','cancelled','completed'\)\)/);
  assert.doesNotMatch(sql,/DISABLE ROW LEVEL SECURITY/i);
});
