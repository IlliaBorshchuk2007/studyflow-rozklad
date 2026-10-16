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
