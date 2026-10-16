# StudyFlow — Design Release and Rollback

Pre-redesign Production commit: `23d5976212aabf090fbe535975dc20d6681b80fc`
Permanent backup branch: `studyflow-v25-pre-redesign-backup`
Feature branch: `studyflow-v27-functional-ui`
Production domain: https://studyflow-rozklad.vercel.app

## Scope

New CSS is contained in `src/functional-redesign.css`, imported after the original `src/styles.css` in `src/main.tsx`. Minor strings and one role indicator were added to `src/App.tsx`. Business logic, Supabase schema, RLS, auth and APIs remain unchanged.

## Recommended UI rollback

Revert the design merge commit (via a new GitHub pull request) and redeploy `main` through Vercel. This removes styling and display changes without reverting any subsequent unrelated features.

## Exact version restore

Branch `studyflow-v25-pre-redesign-backup` points to the exact pre-update code. Restoring this version to `main` redeploys the old interface, but it will also discard any later code updates, so review newer commits first.

## Important about data

Supabase is shared across Production and Preview. While authenticated to the Preview URL, creating or editing real content also edits the live Supabase database. UI deployment/rollback never rolls back Supabase data. Do not use production student data to test mutations.

## Verification

Run `npm test` and `npm run build`; confirm Vercel Preview is READY before merging and Production is READY afterward.