# Borshchuk Education — mobile application redesign rollback

Production code before the redesign: `ef92d69cc4f6d90fadd9edb4dda69506cf15bec8`.
Permanent backup branch: `be-pre-mobile-redesign-backup`.
New feature branch: `be-mobile-v1`.

Changes include `src/mobile.css`, `src/MobileExperience.tsx`, carefully scoped navigation and mobile calendar integration in `src/App.tsx`, an import in `src/main.tsx`, and regression tests. The original role-based pages, CRUD, auth and Supabase RLS/data all remain in place.

The mobile bottom nav has five destinations: Home, Schedule, Lessons, Notifications and Profile; the top-bar menu gives access to all other existing role-appropriate pages. The schedule has touch-friendly day, week and month browsing and uses the existing lesson detail/edit UI for changes (not drag-and-drop on touch).

No SQL migration is required. The existing `studyflow-rozklad.vercel.app` is deliberately left as the functioning technical domain pending a user-owned custom domain. Supabase Site URL/redirects should only be switched when a verified new domain is attached.

**Rollback:** revert the merge commit for this change in a new PR and let Vercel redeploy Production. Do not revert Supabase data. The preserved snapshot branch provides exact previous code but resetting all of main may remove unrelated later changes.
