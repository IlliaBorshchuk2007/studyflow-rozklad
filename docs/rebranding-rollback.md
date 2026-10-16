# Borshchuk Education — branding rollback

The last StudyFlow production commit before this branding was `e6afafc432a6305311d2604359da04cd5ec48d82`.
Branch `borshchuk-education-prebrand-backup` stores that exact version.
This rebrand changes only text, site metadata, styles, package metadata, and the selected graphic asset; **there are no database or auth changes**.

To restore the previous interface, revert the rebranding merge commit on `main` and allow Vercel to redeploy. Do not revert Supabase data. Test `npm test` and `npm run build` before merging a rollback. The public domain remains `studyflow-rozklad.vercel.app` until a new domain is explicitly added.
