import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../src/DesignPreview.tsx',import.meta.url),'utf8');
const entry=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
test('preview starts without app authentication or any database client',()=>{
 assert.match(entry,/import DesignPreview/);
 assert.doesNotMatch(entry,/from '\.\/App\.tsx'/);
 assert.doesNotMatch(src,/supabase|\.from\('lessons'\)|\.insert\(|\.update\(/i);
});
test('design preview provides interactive responsive schedule views',()=>{
 for(const pattern of [/dp-week-grid/,/dp-day-view/,/dp-month-grid/,/dp-mobile-nav/,/setFocused/,/setDate/,/setFilter/,/dp-preview-note/]) assert.match(src,pattern);
});

test('role switch is visible and changes schedule and navigation without backend writes',()=>{
 for(const needle of ['type DemoRole','switchRole','setRole(newRole)','roleMenu.map','eventForRole','dp-top-role','dp-side-role'])assert.ok(src.includes(needle),needle);
 assert.match(src,/admin:'Адміністратор',teacher:'Викладач',student:'Студент'/);
 assert.match(src,/role==='teacher'\?e.teacher==='Олена Коваленко'/);
 assert.match(src,/role==='admin'\?'Розклад закладу'/);
});
