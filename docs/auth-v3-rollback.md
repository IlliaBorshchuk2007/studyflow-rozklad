# Borshchuk Education — login design v3 rollback

Previous Production Git commit: `fa53861a8fe0e243d278b94fbc4ab9fe5f746ed9`.
Backup Git branch: `borshchuk-education-pre-login-v3`.

This update changes only the anonymous login screen artwork and stylesheet, plus its markup for removing the promotional copy. It does **not** change Supabase database schema, roles, login, signup, password reset, or any logged-in views.

To undo, revert the merge commit for this specific login redesign, or remove the last `import './auth-v3.css';` in `src/main.tsx` and restore the AuthScreen promo elements in `src/App.tsx` from the backup branch.

Then run `npm test` and `npm run build` and let GitHub → Vercel redeploy production. Do not alter Supabase data.
