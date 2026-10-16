# Premium Minimal login rollback

- Before this polish: `c2a309b9201a602911c6ae7504a872913a11ca08`
- Exact backup: Git branch `be-before-premium-minimal`
- Updated parts: two static SVG assets plus their login-specific `src/auth-waves.css`, and a visual regression test.
- No changes to login logic, role permissions, database records, APIs or schedules.

To undo this visual change, revert the design PR after merging to main and Vercel will automatically redeploy the prior interface.
If future features have changed, revert this PR instead of resetting all of main to the backup SHA.
