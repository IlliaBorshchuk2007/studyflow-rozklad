import test from 'node:test';
import assert from 'node:assert/strict';
// Lightweight regression tests for the pure calendar helpers by stripping TS annotations via typescript when installed.
import ts from 'typescript';
import fs from 'node:fs/promises';
const raw=await fs.readFile(new URL('../src/lib/calendar.ts',import.meta.url),'utf8');
const js=ts.transpileModule(raw,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const url='data:text/javascript;base64,'+Buffer.from(js).toString('base64');
const {weekStart,weekDays,monthCells,addDays,calcDuration,dayOfWeek}=await import(url);
test('week is Monday to Sunday',()=>{assert.equal(weekStart('2026-10-15'),'2026-10-12');assert.equal(weekDays('2026-10-15')[6],'2026-10-18');});
test('day math across months and years',()=>{assert.equal(addDays('2026-12-31',1),'2027-01-01');assert.equal(dayOfWeek('2026-10-18'),7);});
test('month grid full weeks',()=>{assert.ok([35,42].includes(monthCells('2026-10-15').length));assert.equal(monthCells('2026-10-15')[0],'2026-09-28');});
test('duration',()=>{assert.equal(calcDuration('09:30','11:00'),90);assert.equal(calcDuration('12:00','11:00'),-60);});
