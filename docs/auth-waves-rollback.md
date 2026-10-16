# Borshchuk Education — wave decoration rollback

Production before this design release: `3e94c624f64ad6d3c267eb22860fdcc570fc67ca`.
Exact backup branch: `be-pre-waves-backup`.

Changes are strictly visual:
- `public/be-wave-navy.svg` and `public/be-wave-ivory.svg` are scalable decorative SVGs.
- `src/auth-waves.css` overlays the login backgrounds, respecting mobile.
- `src/main.tsx` imports the new CSS last.

No authentication, authorization, calendar, role, Supabase database or server files are changed.
To revert, undo this release PR on `main`, or remove the `import './auth-waves.css';` line and redeploy. GitHub/Vercel rollback does not revert real user content.
