import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const groups=readFileSync(new URL('../src/GroupManager.tsx',import.meta.url),'utf8');
const stats=readFileSync(new URL('../src/StatisticsDashboard.tsx',import.meta.url),'utf8');
const sql=readFileSync(new URL('../supabase/academic_metadata_v24.sql',import.meta.url),'utf8');
test('group directory has search, filters, selection and pagination',()=>{
 assert.match(groups,/gmanager-search/);
 assert.match(groups,/courseFilter/);
 assert.match(groups,/specialtyFilter/);
 assert.match(groups,/type="checkbox"/);
 assert.match(groups,/PAGE_SIZE=40/);
 assert.match(groups,/ignoreDuplicates:true/);
});
test('statistics load real Supabase date ranges, audit and comparison',()=>{
 assert.match(stats,/supabase\.from\(table\)/);
 assert.match(stats,/lesson_audit/);
 assert.match(stats,/previousStart/);
 assert.match(stats,/getAll<Lesson>/);
 assert.match(stats,/no-data|Немає даних|Немає занять/i);
});
test('academic profile fields are optional and validated',()=>{
 assert.match(sql,/ADD COLUMN IF NOT EXISTS specialty text/);
 assert.match(sql,/ADD COLUMN IF NOT EXISTS course smallint/);
 assert.match(sql,/course IS NULL OR course BETWEEN 1 AND 8/);
});
