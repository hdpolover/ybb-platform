# LOA On-Demand — Integration Smoke Test Checklist

> **Phase G — Task 18.** Run this checklist on the dev environment after deploying the
> `feat/loa-on-demand` branch. All steps must pass before the branch is merged to main.

---

## Pre-flight

- [ ] Deploy the API, admin-dashboard, and portal with migrations applied.
- [ ] Verify migrations ran on boot:
  ```
  docker logs ybb-api 2>&1 | grep -i "migrate"
  ```
  Expected: `All migrations have been applied` or lines showing
  `20260616100000_loa_release_batches` and `20260616100100_participant_document_loa_columns`.

---

## Admin — Batch Management

### Create a batch (happy path)

1. Navigate to **Admin → Programs → \<programId\> → Documents → LOA → Batches tab**.
2. Click **"+ Create Batch"**.
3. Fill: Name=`Wave 1`, Submission From=`2026-01-01`, Submission To=`2026-06-30`.
4. Submit.

Expected: new row appears in the table with status badge **Draft** and `eligibleCount` > 0
(if participants in that date range exist).

### Overlap validation

1. Click **"+ Create Batch"** again.
2. Fill: Name=`Overlap Test`, From=`2026-04-01`, To=`2026-07-31`.
3. Submit.

Expected: error message containing `"overlaps with existing batch 'Wave 1'"` — batch is NOT created.

### Release a batch

1. Toggle the **Release** switch on the `Wave 1` row.

Expected: badge changes from **Draft** → **Released**.

---

## Portal — Eligible Participant

1. Log in as a participant whose application has:
   - `status = accepted` or `submitted`
   - `submission_date` between `2026-01-01` and `2026-06-30`
2. Navigate to the **Documents** tab.

Expected: **"Download Letter of Acceptance"** button is visible (not locked).

### Download LOA

1. Click **"Download Letter of Acceptance"**.

Expected:
- A PDF is downloaded; filename format is `LOA-<docNumber>.pdf`.
- PDF content contains participant name, program name, and document number.
- No file is stored in MinIO (on-demand generation only).

### Re-download keeps same document number

1. Click the download button a second time.

Expected: same document number in the filename — NOT a new number.

---

## Portal — Ineligible Participant

1. Log in as a participant with:
   - `status = rejected` OR `submission_date` outside all released batch ranges.
2. Navigate to the **Documents** tab.

Expected: **locked state** card showing
`"Your Letter of Acceptance will be available once released."` — no download button.

### Direct API access returns 403

```bash
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer <ineligible_token>" \
  -H "x-brand-domain: dev.ybb.id" \
  http://localhost:3000/v1/portal/loa/download
```

Expected: `403`

---

## Admin — Downloads Tab

1. Navigate to **Admin → Programs → \<programId\> → Documents → LOA → Downloads tab**.

Expected: row for the participant who downloaded, showing:
- `documentNumber` (e.g. `LOA-2026-0001`)
- `firstDownloadedAt` timestamp
- `downloadCount` ≥ 2 (after two downloads)
- `batchName` = `Wave 1`

---

## Admin — Unrelease Revokes Access

1. Toggle the Release switch **off** for `Wave 1`.
2. As the previously eligible participant, refresh the Documents tab.

Expected: LOA card switches to **locked state** — participant can no longer download.

Confirm via API:
```bash
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer <eligible_token>" \
  -H "x-brand-domain: dev.ybb.id" \
  http://localhost:3000/v1/portal/loa/download
```

Expected: `403`

---

## Rate Limit Check

1. Call `GET /v1/portal/loa/download` 6 times in rapid succession with the same token.

Expected: first 5 succeed (200), 6th returns 429 (Too Many Requests).

---

## Obsolete Flows Removed

- [ ] Confirm no "Generate LOA" button appears anywhere in the admin UI.
- [ ] Confirm no "Send LOA Email" button appears in the admin UI.
- [ ] Confirm the `POST /v1/portal/documents/:id/viewed` endpoint returns 404 (removed).

---

## Checklist Sign-off

| Check | Pass | Tester | Date |
|-------|------|--------|------|
| Migrations applied on boot | | | |
| Admin: create batch | | | |
| Admin: overlap rejected | | | |
| Admin: release batch | | | |
| Portal: eligible sees download button | | | |
| Portal: PDF downloads with correct filename | | | |
| Portal: re-download same doc number | | | |
| Portal: ineligible sees locked state | | | |
| Portal: ineligible direct API → 403 | | | |
| Admin: Downloads tab shows tracking | | | |
| Admin: unrelease revokes access | | | |
| Rate limit: 6th request → 429 | | | |
| No obsolete Generate/Send buttons | | | |
| /viewed endpoint removed (404) | | | |
