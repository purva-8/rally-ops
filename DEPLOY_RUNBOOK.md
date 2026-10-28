# Deploy runbook: audit fixes (branch `audit/tournament-readiness`)

Event: 30 Oct. Registration closes 28 Oct 20:59 UTC. Nightly backup cron runs at 20:00 UTC.

Order matters only for security: **run the SQL first, then deploy the code**. Each half is safe on its own:
- The SQL works with the old code: claims already go through the server, old code ignores the new column, and there are no coaches yet.
- The new code works without the SQL (it retries without `position`), but the co-organizer hole stays open until the SQL runs.

---

## 0. Before you start (5 min)

1. **Take a backup.**
   - Supabase dashboard → Database → Backups, if your plan has them.
   - Otherwise trigger the emailed backup now, which works on any plan. Use the `CRON_SECRET` from Vercel → Settings → Environment Variables:
     ```bash
     curl -H "Authorization: Bearer $CRON_SECRET" https://<your-domain>/api/cron/backup
     ```
     Confirm the email with the zip arrives and the counts look right (about 121 registrations, 0 matches).
2. **Check that nobody has generated a draw yet.** Run in the Supabase SQL editor (read-only):
   ```sql
   select count(*) from matches;   -- expect 0
   ```

## 1. Run the database fix (2 min)

1. Supabase → SQL Editor → New query.
2. Paste the whole of `supabase/audit_fixes.sql` → Run.
   - It can be run twice safely.
   - It deletes no data.
3. **Verify** (read-only). Every row should say `ok`:
   ```sql
   select 'claim policy gone' as check,
          case when not exists (select 1 from pg_policies where tablename='tournament_staff' and policyname='staff_own_claim') then 'ok' else 'FAIL' end
   union all
   select 'position column',
          case when exists (select 1 from information_schema.columns where table_name='matches' and column_name='position') then 'ok' else 'FAIL' end
   union all
   select 'slot index',
          case when exists (select 1 from pg_indexes where indexname='matches_bracket_slot') then 'ok' else 'FAIL' end
   union all
   select 'coach PII narrowed',
          case when (select prosrc from pg_proc where proname='can_manage_profile') like '%role = ''admin''%' then 'ok' else 'FAIL' end
   union all
   select 'co-org manual entries',
          case when (select prosrc from pg_proc where proname='guard_registration') like '%is_co_organizer%' then 'ok' else 'FAIL' end;
   ```

## 2. Get the code online (10 min)

> The steps below push to GitHub. I haven't run them, and they need your go-ahead.

1. Push the branch. Vercel builds a **preview** deployment for it automatically:
   ```bash
   git push -u origin audit/tournament-readiness
   ```
2. Open a pull request into `main` on GitHub (`purva-8/rally-ops`). Wait for the Vercel check to go green.
3. **Watch out: the preview probably uses the live database.** If Vercel's Preview environment has the same Supabase keys as Production, anything you click on the preview writes real data. Only do the smoke test in step 3, and never touch the real tournament there.
4. Merge the PR into `main`. Vercel deploys to production.
5. Confirm the new version is live:
   - Vercel → Deployments: the top production deployment shows the merge commit.
   - `https://<your-domain>/api/send-match-result` now returns **404**. That route was removed, so a 404 proves the new code is serving.

## 3. Smoke test on production (10 min, throwaway tournament only)

Do **not** use the real tournament. Generating a draw is one-shot (a second attempt is refused).

1. As organizer, create a tournament named **"TEST – ignore"** with one singles category.
2. Add 3 entries by hand, using made-up names (e.g. Test A, Test B, Test C), and approve them.
3. Generate the draw (Random draw 🎲 → Roll → Use this draw). Expect one bye and one round-1 match. The match is labelled **Semifinal**, not "Final".
4. Score the round-1 match with an **impossible** score first: game 1 at 25-3. The app must refuse it.
5. Score it properly (21-15, 21-18) and press Complete.
   - Expect the **Final** to appear straight away.
6. **Reload the page. The Final must still be there.** This is the main bug being fixed.
7. Open `/events/<test-id>/results` on your phone. It should show the same Final.
8. Open the court link (`/coach/court-1`) on the phone, score the Final 21-10, 21-12, and let it finish.
   - The champion shows on the results page.
   - No red "Not saved" banner.
9. In Admin → **Score desk**, open the finished round-1 match and press **Fix**. Swap the winner, then save. The Final should now show the new winner. Swap it back afterwards.
10. Check that the games were saved once, not duplicated (read-only):
   ```sql
   select match_id, set_number, count(*) from match_sets group by 1,2 having count(*) > 1;  -- expect no rows
   ```
11. Delete the test tournament yourself in Supabase (Table editor → tournaments → that one row), or leave it with status `completed` so it doesn't look open. Its entries, matches and sets are deleted with it (the foreign keys cascade).

**If any step fails, stop and roll back (section 4).**

## 4. Rollback

- **Code:**
  - Vercel → Deployments → the previous production deployment → **Promote to Production** (instant).
  - Or revert the merge on `main`. The old code is also kept on branch `backup/pre-audit-2026-10-28`.
- **Database:** the bottom of `supabase/audit_fixes.sql` lists the undo statements. **Don't** re-create `staff_own_claim`: the old code doesn't need it, and it reopens the security hole. Rolling the code back is enough on its own.

## 5. After deploy

- Generate real draws only after registration closes (28 Oct 20:59 UTC) and you've checked the entry list.
- Then work through the tournament-day checklist in the audit report:
  - Walkovers: enter them as 21-0, 21-0.
  - Corrections: possible only until the next round has been created.
  - Courts: `court-1` … `court-N` links.
  - Public view: `/events/<id>/results`.
