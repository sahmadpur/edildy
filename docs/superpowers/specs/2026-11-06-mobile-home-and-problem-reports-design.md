# Edildy — Mobile home page refresh and problem reports — Design Spec

- **Date:** 2026-11-06
- **Status:** Implemented (branch claude/mobile-main-page-redesign-bc8a0a, 2026-11-07)
- **Source:** the owner's change list of 6 November 2026 for the mobile app, refined in a brainstorming conversation (recorded in §1).
- **Builds on:**
  - `2026-10-07-foundation-design.md`: tenancy, RLS, roles, data scopes, `user_sites`, `audit_log`.
  - `2026-10-09-mobile-execution-design.md`: offline SQLite + outbox, media flow (presigned PUT), `execution_problems`, `deriveProblems`.
  - `2026-10-12-tasks-design.md`: the task model, `tasks.problem_id`, `TaskScope`, `task_media`, task sync on `GET /me/sync`.
  - `2026-10-13-notifications-design.md`: domain events, the notification catalogue, targets and recipients.
  - `2026-10-15-redesign-design-direction.md`: the deep header block, chips, tones.

## 1. Context and decisions

Two things are in this piece of work.

**A. The mobile home page and profile get tidied up.** The header is shorter, the sync pill is a dot, the tasks box goes, checklist cards get a two-row layout, the language picker shows flags.

**B. Problem reports.** Today a problem exists only *inside* a checklist run: a rule or a worker flags an item, and a manager may later turn that `execution_problems` row into a task. Workers have no way to report something that is not on a checklist (a leaking pipe, a broken fridge door, a blocked exit). This spec adds **problem reports**: a worker reports a problem with text, photos or video, GPS location and a site, offline if needed. Managers and the roles above them see the reports in their scope on the phone and on the web, create a task from one, or close one directly. The existing checklist problems are untouched; the new thing is a separate entity with its own tables, API and screens, following the SP5 pattern (NFR-15.02).

Decisions made during brainstorming (the owner's words are paraphrased; anything marked *my call* was decided by the designer and can be changed):

| Topic | Decision |
|---|---|
| Who reports | **Anyone signed in**, including workers (who have no permissions). A manager on the phone can report too. |
| What a report holds | **Text, photos and/or video, GPS location, and a site.** The phone always tries to attach GPS ("need location"), but when no fix can be had the report is **sent anyway and marked as missing its location** (owner's choice: lenient, not strict). |
| Offline | **Reporting works offline**, through the same outbox and media queue as checklists and tasks. Reading other people's reports needs a connection. |
| Who sees reports | **The reporter sees their own.** Holders of `assignments.view` whose data scope is wider than `own` (manager, auditor, admin, owner by default) see every report in their scope, on the phone and on the web. |
| After reporting | A manager either **creates a task from the report** (pre-filled, assigned to a person or team, due date) or **closes it directly with a short comment** ("fixed on the spot", "not an issue"). States: `open`, `task_assigned`, `resolved`, `closed`. |
| Editing | **The reporter cannot edit or delete a report after sending.** |
| Where on the phone | **A "Problemlər" tab** in the bottom bar, with a list screen, a detail screen and a "new report" screen (*my call*: a tab rather than a home-page button, so the list has a home). |
| Web | Reports appear on the existing **Problems page as a second tab**, with the same create-task action and a close action (*my call*). |
| Severity | **Normal / critical**, like checklist problems, so the existing notification rules (push for normal, push + email for critical) carry over (*my call*). |
| Home page | Date only ("6 noy 2026"); "Salam, Name Surname"; no subtitle; a shorter header block; sync state as a colored dot; no tasks box; checklist cards as `name | site` over `window | opening date and time`. |
| Profile | Language picker shows **three flags**, no names. |

## 2. Goals and non-goals

**Goals.** At the end of this piece of work:

1. The mobile home page matches §7.1 and the profile matches §7.2.
2. Any signed-in user reports a problem on the phone with text (1–2,000 characters), severity, up to 5 photos or videos, a site they belong to, and their GPS position when the phone can get one, online or offline. The report reaches the server through the sync queue and is visible with the usual sync badges.
3. A reporter sees their own reports and their state on the phone, offline.
4. A holder of `assignments.view` with scope wider than `own` lists reports in scope on the phone (online) and on the web, filters them by state and site, and opens one to see text, media, location (an "open in maps" link), site, reporter and time.
5. A holder of `tasks.manage` creates a task from a report (web and phone, online), pre-filled with the report's text, site and media. When that task completes, the report shows `resolved`.
6. A holder of `tasks.manage` closes a report directly with a comment (1–1,000 characters).
7. Managers in scope are notified when a report is created (push; email too for critical). The reporter is notified when their report is closed or resolved.
8. Creating and closing a report, and creating a task from one, are written to the audit log.

**Non-goals:**

- Editing or deleting a report after it is sent (a manager closes it instead).
- Comments or a thread on a report.
- A map view of many reports, geofencing, or storing coordinates on sites.
- Changing the checklist problems (`execution_problems`), their page, or their reports.
- Reports or dashboards over problem reports (a later SP7 follow-up).
- Reading other people's reports offline.

**Anti-goals** (what would make this a failure even if it works):

- A worker loses a report because they were offline or GPS was slow. The report must be saved on the phone the moment they tap send, and media must survive app restarts like checklist evidence does.
- Someone outside a manager's scope sees a report. Scope rules must be as strict as for tasks.
- The home page grows taller. Every change in §7.1 removes or compacts; nothing is added above the checklist list.

## 3. States

A report's state is **derived**, not stored, except `closed`:

```
open ──create task──▶ task_assigned ──task completed──▶ resolved
  │                        │
  │                        └──task cancelled──▶ open (a new task may be created, or the report closed)
  └──close with comment──▶ closed
```

| State | Rule |
|---|---|
| `closed` | `closed_at` is set. Final. No task can be created afterwards. |
| `resolved` | Not closed; its task has status `completed`. Final. |
| `task_assigned` | Not closed; its task exists and is neither `completed` nor `cancelled`. |
| `open` | Everything else: no task, or the only task was cancelled. |

**Pure function:** `problemReportState(report: { closedAt }, task: { status } | null)` in contracts, shared by API, web and phone. At most one task that is not cancelled exists per report (§5).

## 4. Shared contracts (`packages/contracts/src/problem-reports.ts`)

- `PROBLEM_REPORT_STATES = ['open', 'task_assigned', 'resolved', 'closed']`.
- `PROBLEM_REPORT_LIMITS = { textMax: 2000, closeCommentMax: 1000, maxMedia: MEDIA_LIMITS.problemMaxMedia (5), syncDays: 30, knownIds: 100 }`.
- `problemReportLocationSchema`: `{ lat: number (-90..90), lng: number (-180..180), accuracyM: number ≥ 0 | null, capturedAt: ISO }`.
- `createProblemReportSchema`: `{ id: uuid (client-generated), siteId: uuid, severity: 'normal' | 'critical', text: string 1–2000, location: problemReportLocationSchema | null, reportedAt: ISO (device time) }`. `location: null` means the phone could not get a fix; the DTO carries it as `null` and the UIs show "Yer məlum deyil".
- `closeProblemReportSchema`: `{ comment: string 1–1000 }`.
- `problemReportMediaRegisterSchema`: same shape as `taskMediaRegisterSchema` without `role`.
- `problemReportDtoSchema`: `{ id, siteId, siteName, severity, text, location, reportedAt, createdAt, reporterUserId, reporterName, media: [{ id, kind, status }], state, taskId | null, taskStatus | null, closedAt | null, closedByName | null, closeComment | null }`.
- `problemReportListQuerySchema`: `{ state?: 'open' | 'task_assigned' | 'resolved' | 'closed' | 'active' (= open + task_assigned, the default), siteId?, from?, to?, cursor?, limit ≤ 100 }`.
- `createTaskSchema` (existing) gains `problemReportId: uuid | null` (default `null`), mutually exclusive with `problemId`. `taskDetailSchema` gains `problemReport: problemReportDtoSchema | null`.
- `syncResponseSchema` gains `problemReports: problemReportDtoSchema[]`, `removedProblemReportIds: uuid[]`, `reportSites: { id, name }[]`. `syncQuerySchema` gains `knownProblemReportIds` (≤ 100).
- `problemReportState(...)` as in §3.
- Error codes (`errors.ts`): `PROBLEM_REPORT_CLOSED` (409, closing or tasking a closed report), `PROBLEM_REPORT_HAS_TASK` (409, an open task already exists), `SITE_NOT_ALLOWED` (403, the reporter does not belong to the site; reuse `SITE_OUT_OF_SCOPE` if the builder prefers).
- Permission: **no new permission key.** Create is open to every principal; read-all uses `assignments.view`; close and task creation use `tasks.manage`.

## 5. Data model (`apps/api/src/db/schema.ts`, migrations `0018_problem_reports.sql` + `0019_problem_reports_security.sql`)

**`problem_reports`**

| Column | Notes |
|---|---|
| `id uuid pk` | client-generated UUIDv7 (idempotent retries) |
| `tenant_id` | FK tenants; `problem_reports_tenant_id_uq (tenant_id, id)` |
| `site_id` | composite FK sites, NOT NULL |
| `reporter_user_id` | composite FK users, NOT NULL |
| `severity problem_severity` | reuse the existing enum |
| `text text` | 1–2,000 |
| `lat double precision null`, `lng double precision null`, `accuracy_m real null`, `location_at timestamptz null` | `lat`, `lng` and `location_at` are all null or all set (CHECK) |
| `reported_at timestamptz` | device time, server-clamped like tasks (`assertNotFuture`) |
| `closed_at timestamptz null`, `closed_by_user_id uuid null` (composite FK users), `close_comment text null` | all three set together (CHECK) |
| `created_at`, `updated_at` | |

Indexes: `(tenant_id, site_id, created_at)`, `(tenant_id, reporter_user_id, created_at)`, `(tenant_id, closed_at)`.

**`problem_report_media`**: a copy of `task_media` without `role`: `id` (client), `tenant_id`, `report_id` (composite FK), `kind`, `source`, `mime`, `bytes`, `width`, `height`, `duration_ms`, `captured_at`, `storage_key` (`t/<tenant>/pr/<reportId>/<id>.<ext>`), `status pending|uploaded`, `storage_purged_at`, `created_at`. Max 5 per report, enforced in the service.

**`tasks`** gains `problem_report_id uuid null` with composite FK to `problem_reports` (`on delete restrict`), a CHECK that `problem_id` and `problem_report_id` are not both set, and a partial unique index `tasks_problem_report_active_uq on (problem_report_id) where status <> 'cancelled'`.

**RLS and grants:** the same `tenant_isolation` policy block as `0010_tasks_security.sql`, for both new tables; `GRANT SELECT, INSERT, UPDATE` to `edildy_app`, `edildy_platform`. No new `role_permissions` rows.

**Notifications:** the `notification_target_kind` enum gains `problem_report`.

## 6. API (`apps/api/src/problem-reports/`)

A new `ProblemReportsModule` with `ProblemReportsController`, `ProblemReportsService`, `ProblemReportScope`, `ProblemReportMediaService`, `ProblemReportSync`. It imports nothing from `ExecutionsModule` or `TasksModule`. `TasksModule` imports it for the task-from-report path; `ExecutionsModule`, which owns `GET /me/sync` (`sync.service.ts`), imports it for the sync section.

### 6.1 Scope (`problem-report-scope.ts`)

`readable(p)` → SQL condition on `problem_reports`:

| Data scope | Without `assignments.view` | With `assignments.view` |
|---|---|---|
| `own` | `reporter_user_id = me` | `reporter_user_id = me` |
| `subordinates` | `reporter_user_id = me` | reporter = me **or** reporter in `chain(me)` |
| `site_subtree` | `reporter_user_id = me` | reporter = me **or** `inSubtree(me, site_id)` |
| `all` | `reporter_user_id = me` | true |

Unknown scope fails closed. `manageable(p)` = `readable(p)` and `tasks.manage`. (`chain` and `inSubtree` are exported from `scheduling-scope.ts`.)

`reportableSites(p)`, the active sites a principal may report at (*my call*, since `user_sites` is optional and many workers reach their sites only through assignments):

- for `site_subtree` / `all`: `SchedulingScope.readableSites(p)`;
- for `own` / `subordinates`: the union of the user's `user_sites` rows and the sites of occurrences assigned to the user (directly or through a team) with `local_date` within the last 90 days or the next 30 days.

A user with an empty set sees the list screen with an explanation ("Sizə heç bir obyekt təyin edilməyib") instead of the "+ Problem bildir" button; `site_id` stays NOT NULL.

### 6.2 Endpoints

| Method and path | Permission | Behaviour |
|---|---|---|
| `GET /problem-reports/sites` | any | Active sites from `reportableSites(p)`, `{ id, name }[]`. |
| `POST /problem-reports` | any | Create. Checks the site is in `reportableSites`, clamps `reportedAt`, inserts the row, writes audit `problem_report.created`, emits `problem_report.created`. **Idempotent:** a known `id` by the same reporter returns the stored DTO; by another user → 409 `CONFLICT`. |
| `GET /problem-reports` | any | List within `readable(p)`, filters from §4, keyset cursor on `(created_at, id)` newest first. `state` filters are applied in SQL via a left join on the non-cancelled task. |
| `GET /problem-reports/:id` | any | One DTO within `readable(p)`, else 404. |
| `POST /problem-reports/:id/close` | `tasks.manage` | Within `manageable(p)`; refuses `PROBLEM_REPORT_CLOSED` if already closed, `PROBLEM_REPORT_HAS_TASK` if a non-cancelled task exists (cancel the task first). Sets the three closed columns, audits `problem_report.closed`, emits `problem_report.closed`. |
| `POST /problem-reports/:id/media` | reporter only | Registers a medium (presigned PUT), same flow and checks as `TaskMediaService.register`; cap 5; refused once the report is closed. |
| `POST /problem-report-media/:id/uploaded` | reporter only | Confirms the upload (`assertStored`). |
| `GET /problem-report-media/:id/url` | `readable` on the report | 5-minute presigned GET. |
| `POST /tasks` (existing) | `tasks.manage` | With `problemReportId`: report within `manageable(p)`, not closed, no non-cancelled task; `siteId` comes from the report; `requiresReview` defaults to true; `title` defaults to the first 200 characters of the report text and `instructions` to the full text when the client sends none. Audit and `task.assigned` as today. |
| `GET /tasks/:id` (existing) | | `problemReport` card for task readers; `GET /tasks/:id/problem-report-media/:mediaId/url` mirrors the existing problem-media URL endpoint. |

Report media is **not** copied into the task; the task shows the report card with its media, exactly as checklist-problem tasks do.

### 6.3 Sync (`GET /me/sync`)

`ProblemReportSync.forUser(p, knownIds, now)` returns the caller's **own** reports created in the last `syncDays` (30) days plus any older ones still `open` or `task_assigned`, and `removedProblemReportIds` for known ids that no longer qualify. `reportSites` is `reportableSites(p)` as `{ id, name }`. Other people's reports are never synced to the phone.

### 6.4 Events, notifications, audit

- `DomainEventMap` gains `problem_report.created { tenantId, reportId, siteId, severity, reporterUserId }`, `problem_report.closed { tenantId, reportId, reporterUserId }`, `problem_report.resolved { tenantId, reportId, reporterUserId }` (emitted by `TasksService` when a task with `problem_report_id` completes).
- `NOTIFICATION_TYPES` gains `problem_report.created` (push, roles `['manager']`), `problem_report.critical` (push + email, roles `['manager', 'admin']`), `problem_report.closed` and `problem_report.resolved` (push, direct audience `creator` = the reporter, no role recipients). *My call:* the reporter is modelled as the existing `creator` audience, so no new audience kind is needed and admins can switch it off on the rules tab like any other `creator` notification. The four types sit under the existing `problem` notification group. `DEFAULT_RULES` and the i18n `notifications.types` keys follow.
- Target kind `problem_report`: `notification-targets.ts` loads the report; `notification-recipients.ts` role recipients need `assignments.view` and `ProblemReportScope.readable` covering the report; the mobile `routeForTarget` opens `/problems/[id]`; the web link opens `/problems?tab=reports&report=<id>`.
- Audit log actions: `problem_report.created`, `problem_report.closed`; task creation from a report is already audited as `task.created` (add `problemReportId` to its details).
- Stale pending media is purged by the existing `purgeStalePending` with the new table.

## 7. Mobile app

### 7.1 Home page (`features/home/home-screen.tsx`, `features/checklists/occurrence-card.tsx`, `features/sync/sync-indicator.tsx`)

- **Header block:** one row with the date `formatLocalDate(date, locale)` (no weekday, short month → "6 noy 2026") on the left and, on the right, the sync dot then the bell. Below it the greeting `t('mobile.home.greeting', { name: fullName })` → "Salam, Aysel Əliyeva!" at `type.lg` (was `type.display`). The subtitle line and the `tools` row are removed. `paddingTop` drops from `spacing.lg` to `spacing.md`. The i18n key `mobile.home.subtitle` is deleted in all three languages.
- **Sync dot:** `SyncIndicator` gets a `compact` prop (used on Home): a 12 px dot in the state color inside a 44 × 44 pressable, no text. The `accessibilityLabel` keeps the full text, the `testID` stays `sync-indicator-<state>`. Tapping still opens `/sync`. The full pill remains available for other screens.
- **Tasks box:** the `home-tasks` pressable and its two counts are removed, with `mobile.tasks.home.*` keys and the `taskStats` query. Tasks stay reachable from the tab bar.
- **Stat tiles:** unchanged.
- **Checklist card:** two rows above the chips:
  - Row 1: checklist name (bold, left, shrinks with ellipsis) | site name (muted, right, no shrink). The shift name, when present, goes under the site name in `type.sm`.
  - Row 2: the window `08:00–10:00` (left) | the opening moment as `formatDateTime(startsAt, { locale, timeZone })` → "6 noy 2026, 08:00" (right, muted). The existing `opensAt` line for the `upcoming` group is dropped, since the opening moment is now always shown.
  - Rework lines, chips, sync note and the action button stay below, unchanged.
- The sections "İndi / Davam edən / Gələcək / Bitmiş" are unchanged.

### 7.2 Profile

`LanguagePicker` gets a `variant: 'names' | 'flags'`; the profile uses `flags`, the sign-in screen keeps `names` (*my call*: a first-time user on the login screen benefits from the words). Flags are the emoji 🇦🇿 🇬🇧 🇷🇺 at `type.xl`, in the same 44 px chips; `accessibilityLabel` stays `LANGUAGE_NAMES[lng]`. `LANGUAGE_FLAGS: Record<Language, string>` lives next to `LANGUAGE_NAMES` in `@edildy/i18n`.

### 7.3 Tab bar (`app/(app)/_layout.tsx`)

A new tab `problems/index` titled `mobile.tabs.problems` ("Problemlər") with the Ionicons `warning` / `warning-outline` icon, placed after Tasks and before Team. Hidden routes: `problems/new`, `problems/[id]`.

### 7.4 Offline store

- **SQLite migration v5:** rebuild `outbox`, `media` and `media_refusals` so their CHECK lists accept `'problem_report'` (same technique as v3). New tables:
  - `problem_reports (id text pk, data text /* ProblemReportDto JSON */, local_status text /* 'draft'|'sent' */, sync_note text null, received_at text null, updated_at text)`;
  - `report_sites (id text pk, name text)` replaced on every pull.
  - Add both to `clearLocalData`'s table list.
- **Outbox commands:** `problem_report.create` (payload = `createProblemReportSchema` body with device `reportedAt`) and `problem_report.media` (`refId` = media id). `nextCommand` holds `problem_report.media` behind a failed `problem_report.create` of the same entity, like `task.submit` behind `task.media`. `send()` converts `reportedAt` with `serverTime`; `applyResult` stores the returned DTO and marks `local_status = 'sent'`. A permanent refusal (e.g. `SITE_NOT_ALLOWED`) sets `sync_note` and the report shows "Göndərilmədi" with the reason, like a refused task.
- **Media queue:** `ownerType = 'problem_report'` branch calling `api.problemReports.registerMedia` / `api.problemReportMedia.confirmUploaded`; titles in `list()` via a join on `problem_reports`.
- **Pull:** `mergePull` upserts `problemReports` (local queued changes win, as for tasks), removes `removedProblemReportIds`, replaces `report_sites`.
- **Store (`problem-report-store.ts`):** `create(input, media)` writes the row, the media rows and both outbox commands in one transaction; `views()` returns reports with `unsynced` / `failedKey` from the outbox, newest first; `sites()`.

### 7.5 Screens (`features/problems/`)

- **List (`problems/index`):** header block "Problemlər" with a "+ Problem bildir" primary button. Section **"Mənim"**: the local reports as rows (severity tone on the left edge, first line of text, site, date, state chip, sync badge). For principals who pass `canSeeReports(me)` (= `assignments.view` and `dataScope !== 'own'`), a segmented control **"Mənim | Hamısı"**; "Hamısı" loads `GET /problem-reports` with state filter chips (Aktiv / Həll olunub / Bağlı) and infinite scroll, online only (offline shows `mobile.tasks.online`-style text).
- **New (`problems/new`):** site radios from `report_sites` (one site → preselected and shown read-only); severity chips Normal / Kritik; text field (2,000 max); media row reusing `CaptureModal` (photo and video) and `pickFromGallery`, max 5, same thumbnails as the execution problem sheet; a **location row** that starts fetching on mount: "Yer axtarılır…" → "Yer tapıldı (±12 m)" → or "Yer tapılmadı — Yenidən cəhd et". Send is enabled with text and a site; while the fix is still being sought the button reads "Yer axtarılır…" for at most 15 s, after which it is enabled with or without a location. A send without a location asks once "Yer olmadan göndərilsin?" (Göndər / Gözlə). Send writes locally and navigates back to the list; no network needed.
  - Location: `expo-location` (new dependency, config plugin with Azerbaijani/English/Russian permission strings, **requires a new dev build and a new store build**). `requestForegroundPermissionsAsync`, then `getCurrentPositionAsync({ accuracy: Balanced })` with a 15 s timeout, falling back to `getLastKnownPositionAsync({ maxAge: 5 min })`. Denied permission shows an explanation and an "Open settings" button (`openSettings` already exists in `notifications/native.ts`); the report can still be sent without a location.
- **Detail (`problems/[id]`):** text, severity chip, state chip, site, reporter, reported time, media thumbnails (local file for own pending media, presigned URL otherwise, via the existing `remote-media.tsx` pattern), a "Xəritədə aç" row that opens `https://maps.apple.com/?ll=lat,lng` on iOS / `geo:lat,lng?q=lat,lng` on Android via `Linking.openURL` (or the muted text "Yer məlum deyil" when the report has no location), the close comment when closed, and the linked task as a row that opens `/task/[id]` when the viewer can read it. Managers (`tasks.manage`, online) get two buttons: **"Tapşırıq yarat"** → `/task/new?problemReportId=<id>` (new work: today the mobile create-task screen has no source-problem mode; it gains a `problemReportId` param that pre-fills title and instructions, locks the site, shows the report card and sends `problemReportId` to `POST /tasks`) and **"Bağla"** → a sheet with the comment field. Own reports open from local data; others' reports load from the API.

### 7.6 Strings

New `mobile.problems.*` keys in az/en/ru (list, new, detail, location states, states, close sheet) plus `mobile.tabs.problems`, `notifications.types.problem_report.*`, `roles` untouched (no new permission). Removed: `mobile.home.subtitle`, `mobile.tasks.home.*`, `mobile.checklists.opensAt`.

## 8. Web app

- `/problems` page gets two tabs: **"Yoxlama problemləri"** (today's table, unchanged) and **"Bildirilən problemlər"** (new). The new tab: filters for state (default active), site, date range; columns date, site, reporter, severity, text (truncated with a tooltip), media count, location (a "Xəritə" link to `https://www.google.com/maps?q=lat,lng`, or "—" with a "Yer məlum deyil" tooltip), state; row actions **Create task** (reuses `TaskDialog` with a `problemReport` prop: site fixed, title and instructions pre-filled, media shown) and **Close** (a small dialog with the comment). `?tab=reports&report=<id>` opens the tab and highlights the row (notification deep link).
- Task detail and the tasks table show the source report card and a "Bildirilən problem" source badge next to the existing "Problem" badge.
- Queries: `useProblemReports(filters)` (infinite), `useCloseProblemReport()`; `api.problemReports.*` in `packages/api-client`.

## 9. Testing

- **Contracts (Vitest):** schemas; `problemReportState` table test; `createTaskSchema` rejects both `problemId` and `problemReportId`.
- **API (Vitest + Postgres):** scope matrix for the four data scopes with and without `assignments.view`; create idempotency and `SITE_NOT_ALLOWED`; close refusals; task-from-report refusals and defaults; media cap; sync section (own only, 30-day window, removals); notification recipients for a report (manager in subtree yes, other manager no; reporter on close/resolve); audit rows.
- **Mobile (Jest + Testing Library):** migration v5 test (existing rows survive, new CHECK accepts `problem_report`); store `create` writes row + media + two outbox commands atomically; sync engine sends `problem_report.create` then media, applies the DTO, handles a permanent refusal; `mergePull` upsert/removal/sites; home-screen test updated for the new header, dot indicator, no tasks box and the two-row card; `LanguagePicker` flags variant; new-report screen sends with a location when the fix arrives and, after the timeout or a denied permission, sends with `location: null` after the confirmation (mock `expo-location`), problems list shows own reports with sync badges, detail shows the maps link, manager buttons gated on permission and online.
- **Web (Vitest + Testing Library):** reports tab renders, filters, create-task dialog pre-fill, close dialog.
- **Manual:** a real device for GPS and the camera (simulators have no camera; the iOS simulator can simulate a location).

## 10. Implementation order

1. Home page and profile changes (§7.1–7.2): self-contained, ship first.
2. Contracts + DB + API module + sync + notifications + audit (§4–6).
3. Mobile offline store, migration v5, sync wiring (§7.4).
4. Mobile screens and tab (§7.3, 7.5), `expo-location` and a new dev build.
5. Web tab and task dialog (§8).

Step 1 can be its own PR; steps 2–5 can be one PR or two (API first).

## 11. Left to the builder

- Exact layout spacing and the state-chip tones (follow the tones used for tasks: open = neutral, task_assigned = active, resolved = success, closed = neutral).
- Thumbnail sizes, the media lightbox (reuse the execution one).
- Keyset cursor encoding (copy the tasks list).
- Whether `GET /problem-reports` for the web joins the task row or resolves states in a second query.
- Debounce, page size (50 on web, 30 on phone), and empty-state wording.
- How the web `TaskDialog` shares its pre-fill logic between the existing `problem` prop and the new `problemReport` prop; the mobile create-task screen's source mode is new and can be built the simplest way that works.

## 11a. Rollout order (added after review, 2026-11-07)

Phones on older builds validate every API answer against the schemas compiled into them. The task `source` enum therefore stays as it was on the wire (`problem` | `adhoc`); a task from a report is `adhoc` with `problemReportId` set, and clients derive its badge from that. The four new notification types and the `problem_report` target kind cannot be hidden the same way: an older phone whose inbox holds a `problem_report.*` row fails to parse `/me/notifications` (the sync and everything else keep working). So the app build with this feature ships to TestFlight/Play **before** the API deploy, and managers are asked to update first; the inbox recovers as soon as the phone is updated.

## 12. Open items for later

- Reports over problem reports (counts per site, time to resolve) in SP7's reports.
- Showing nearby open reports when a worker starts a checklist at the same site.
- Retention of report media (SP9 plans).
