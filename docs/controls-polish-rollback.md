# StudyFlow 2.8 — Control polish and rollback

Previous version: main SHA `6e3c7096168eacdb795f3f49ed10eff449df790f`.
Backup branch: `studyflow-v27-before-controls-polish` (exact code snapshot).

New styles are isolated in `src/controls-polish.css`, imported last from `src/main.tsx`.
Only `src/main.tsx`, this new CSS file, and design regression tests change.
No database migrations or backend alterations.

To revert only these visual changes after merge:
1. Revert the StudyFlow 2.8 merge commit through GitHub.
2. Merge the rollback to main.
3. Verify Vercel Production is READY and reload the page.

Alternatively remove `import './controls-polish.css';` from `src/main.tsx` and redeploy.
Do not reset an entire git branch if later unrelated features have been released.
