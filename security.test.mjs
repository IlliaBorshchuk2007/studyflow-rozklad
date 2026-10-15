import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/upgrade_v2.sql',import.meta.url),'utf8');
test('removes anonymous policies and grants',()=>{assert.match(sql,/DROP POLICY IF EXISTS "Everyone can edit lessons"/);assert.match(sql,/REVOKE ALL ON public\.lessons FROM anon/);});
test('audit is trigger driven and not writable by browsers',()=>{assert.match(sql,/CREATE TRIGGER audit_studyflow_lessons AFTER INSERT OR UPDATE OR DELETE/);assert.match(sql,/REVOKE ALL ON public\.lesson_audit FROM anon,authenticated/);});
test('roles can only be changed by admin',()=>{assert.match(sql,/NOT public\.is_admin\(\)/);assert.match(sql,/NEW\.role IS DISTINCT FROM OLD\.role/);});
test('no secret keys committed',()=>{const env=readFileSync(new URL('../.env.example',import.meta.url),'utf8');assert.doesNotMatch(env,/sb_secret_/);assert.doesNotMatch(env,/service_role\s*=/);});
