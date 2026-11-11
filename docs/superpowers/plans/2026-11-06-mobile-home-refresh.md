# Mobile Home Page and Profile Refresh — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the mobile home page shorter and calmer (date-only eyebrow, full-name greeting, a sync dot instead of the pill, no tasks box, two-row checklist cards) and show flags instead of names in the profile's language picker.

**Architecture:** Pure presentation changes inside the existing screens. `SyncIndicator` grows a `compact` prop, `LanguagePicker` grows a `variant` prop, `OccurrenceCard` is re-laid out, `HomeScreen` drops the tasks box and the subtitle. Three dead i18n keys are removed from all three languages. No API, no data changes.

**Tech Stack:** Expo SDK 57 / React Native 0.86, react-i18next, `@edildy/i18n` formatters, Jest + `@testing-library/react-native`.

**Spec:** `docs/superpowers/specs/2026-11-06-mobile-home-and-problem-reports-design.md`, §7.1 and §7.2 (and the "Home page" / "Profile" rows of §1). This is Part 1 of 2; Part 2 (problem reports) is `2026-11-06-problem-reports.md`.

## Global Constraints

- Every i18n key exists in `az`, `en` and `ru`; `packages/i18n` typechecks (`Shape<Translations>`) and `i18n.test.ts` passes.
- Nothing is added above the checklist list on Home (spec anti-goal: "The home page grows taller").
- Tap targets stay ≥ 44 pt; every icon-only control keeps a text `accessibilityLabel`.
- Run from the worktree root: `pnpm --filter @edildy/i18n test`, `pnpm --filter @edildy/mobile test`, `pnpm --filter @edildy/mobile typecheck`, `pnpm --filter @edildy/mobile lint` before the final commit.

## Review Focus

1. A long checklist name next to a long site name must not push the site off-screen: the name shrinks with an ellipsis, the site stays whole (Task 3 test "keeps the site name whole").
2. The `upcoming` group used to say "18:00-da açılır"; after the change the opening date and time must still be visible on an upcoming card (Task 3 test asserts the formatted opening moment).
3. The compact sync dot must still announce its state to screen readers and still open `/sync` (Task 2 tests).
4. A user whose `fullName` is a single word must still get a sensible greeting (Task 4: greeting uses `fullName` verbatim, no splitting).
5. The login screen must keep language names: a first-time user may not recognise a flag (Task 5 keeps the default variant `names`; login-screen test unchanged).

---

### Task 1: Remove dead strings from the i18n package

**Files:**
- Modify: `packages/i18n/src/az/mobile.ts` (`home.subtitle`, `tasks.home`, `checklists.opensAt`)
- Modify: `packages/i18n/src/en/mobile.ts`, `packages/i18n/src/ru/mobile.ts` (same keys)
- Modify: `packages/i18n/src/i18n.test.ts:288,312` (two assertions on `mobile.tasks.home`)
- Modify: `packages/i18n/src/index.ts` (add `LANGUAGE_FLAGS`)

**Interfaces:**
- Produces: `export const LANGUAGE_FLAGS: Record<Language, string> = { az: '🇦🇿', en: '🇬🇧', ru: '🇷🇺' }` next to `LANGUAGE_NAMES`.

- [ ] **Step 1: Write the failing test** in `i18n.test.ts`, next to the `LANGUAGE_NAMES` tests (or in the `mobile task translations` block):

```ts
it('has one flag per language', () => {
  expect(Object.keys(LANGUAGE_FLAGS).sort()).toEqual([...LANGUAGES].sort());
  for (const l of LANGUAGES) expect(LANGUAGE_FLAGS[l]).toMatch(/^\p{Regional_Indicator}{2}$/u);
});
```

Delete the two assertions at lines 288 and 312 that read `az.mobile.tasks.home[...]` / `az.mobile.tasks.home.open`.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @edildy/i18n test`
Expected: FAIL, `LANGUAGE_FLAGS` is not exported.

- [ ] **Step 3: Implement**: add `LANGUAGE_FLAGS` to `index.ts`; remove `home.subtitle`, the whole `tasks.home` object and `checklists.opensAt` from the three `mobile.ts` files.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @edildy/i18n test && pnpm --filter @edildy/i18n typecheck`
Expected: PASS. (The mobile typecheck will fail until Tasks 3–4 remove the usages; that is expected.)

- [ ] **Step 5: Commit**

```bash
git add packages/i18n
git commit -m "feat(i18n): language flags; drop the home subtitle, tasks box and opensAt strings"
```

---

### Task 2: Compact sync indicator

**Files:**
- Modify: `apps/mobile/src/features/sync/sync-indicator.tsx`
- Test: `apps/mobile/src/features/sync/sync.test.tsx`

**Interfaces:**
- Produces: `export function SyncIndicator({ compact = false }: { compact?: boolean })`. With `compact`, renders a 44 × 44 `Pressable` (same `testID`, `accessibilityRole="button"`, `accessibilityLabel` = the full text) containing only a 12 px dot in `TONE[state].dot`; no `Text`.

- [ ] **Step 1: Write the failing test** in `sync.test.tsx`, reusing that file's existing setup for a synced world:

```ts
it('compact: shows only the dot but keeps the label and opens the queue', async () => {
  // same services/render setup as the first test in this file, with <SyncIndicator compact />
  const dot = screen.getByTestId('sync-indicator-synced');
  expect(screen.queryByText('Sinxronlaşdırılıb')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Sinxronlaşdırılıb' }));
  expect(mockPush).toHaveBeenCalledWith('/sync');
  expect(dot).toBeTruthy();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @edildy/mobile test -- sync.test`
Expected: FAIL, the text "Sinxronlaşdırılıb" is still rendered.

- [ ] **Step 3: Implement** the `compact` prop: a `styles.compact` pressable `{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }` and `styles.bigDot` `{ width: 12, height: 12, borderRadius: 6 }`; the non-compact branch is unchanged.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @edildy/mobile test -- sync.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/sync
git commit -m "feat(mobile): compact dot variant of the sync indicator"
```

---

### Task 3: Two-row checklist card

**Files:**
- Modify: `apps/mobile/src/features/checklists/occurrence-card.tsx`
- Test: `apps/mobile/src/features/home/home-screen.test.tsx` (the card is only rendered through Home)

**Interfaces:**
- Consumes: `formatDateTime(iso, { locale, timeZone })` from `@edildy/i18n` → "6 noy 2026, 08:00" in az.
- Produces: no new exports; the card renders
  - row 1: `o.checklistName` (`styles.title`, `flexShrink: 1`, `numberOfLines={1}`) | `o.siteName` (`styles.muted`, `flexShrink: 0`), with `o.shiftName` under the site in `type.sm` when present;
  - row 2: the window `t('mobile.checklists.window', …)` | `formatDateTime(o.startsAt, { locale, timeZone })`;
  - the `opensAt` line and its import of `mobile.checklists.opensAt` are removed.

- [ ] **Step 1: Write the failing tests** in `home-screen.test.tsx`. Replace the assertion `getByText('18:00-da açılır')` in "groups my checklists…" with:

```ts
const upcoming = within(screen.getByTestId(`occurrence-${OCC3}`));
expect(upcoming.getByText(formatDateTime('2026-11-02T14:00:00.000Z', { locale: 'az', timeZone: 'Asia/Baku' }))).toBeTruthy(); // "2 noy 2026, 18:00"
expect(upcoming.queryByText(/açılır/)).toBeNull();
```

Add a new test:

```ts
it('keeps the site name whole and lets a long checklist name shrink', async () => {
  const t = await createTestServices();
  await t.seed(syncResponse({ occurrences: [occurrence({ checklistName: 'Çox uzun adı olan gündəlik təmizlik və təhlükəsizlik yoxlaması', siteName: 'Nərimanov filialı' })], checklistVersions: [versionOf(t.c.content)] }));
  await renderWithServices(t.services, <HomeScreen />);
  const card = within(await screen.findByTestId(`occurrence-${OCC}`));
  const name = card.getByText(/Çox uzun adı/);
  expect(name.props.numberOfLines).toBe(1);
  expect(StyleSheet.flatten(name.props.style).flexShrink).toBe(1);
  expect(StyleSheet.flatten(card.getByText('Nərimanov filialı').props.style).flexShrink).toBe(0);
});
```

(Check `occurrence()` in `offline/testing/fixtures.ts` accepts `siteName`; if the field is named differently, use that name.)

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @edildy/mobile test -- home-screen`
Expected: FAIL on the new assertions.

- [ ] **Step 3: Implement** the layout: two `View`s with `styles.row = { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm }`; the opening moment is always rendered (the `group === 'upcoming'` block is deleted).

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @edildy/mobile test -- home-screen`
Expected: PASS for the card tests (the "Home task card" block still fails until Task 4).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/checklists/occurrence-card.tsx apps/mobile/src/features/home/home-screen.test.tsx
git commit -m "feat(mobile): two-row checklist card with site and opening time"
```

---

### Task 4: Shorter home header, no tasks box

**Files:**
- Modify: `apps/mobile/src/features/home/home-screen.tsx`
- Modify: `apps/mobile/src/components/chip.tsx` (`headerBlock.title` stays for other screens; add `headerBlock.compactBlock` and `headerBlock.greeting`)
- Test: `apps/mobile/src/features/home/home-screen.test.tsx`

**Interfaces:**
- Consumes: `SyncIndicator compact` (Task 2), `formatLocalDate(date, locale)` with no options → "6 noy 2026".
- Produces: `headerBlock.compactBlock = { ...block, paddingTop: spacing.md }` and `headerBlock.greeting = { fontFamily: font, color: colors.onDeep, fontSize: type.lg, fontWeight: '600' }` in `chip.tsx`.

- [ ] **Step 1: Write the failing tests** in `home-screen.test.tsx`. Delete the whole `describe('Home task card', …)` block. Change the session mock's `fullName` to `'Aysel Əliyeva'` (already) and add:

```ts
it('greets by full name under a date-only eyebrow, with the sync dot and the bell, and no tasks box', async () => {
  const t = await world();
  t.clock.set('2026-11-06T06:00:00.000Z');
  await renderWithServices(t.services, <HomeScreen />);
  expect(await screen.findByRole('header', { name: 'Salam, Aysel Əliyeva!' })).toBeTruthy();
  expect(screen.getByText('6 noy 2026')).toBeTruthy();
  expect(screen.queryByText(/noy 2026/).props.children).toBe('6 noy 2026'); // no weekday
  expect(screen.queryByText('Bugünkü yoxlamalarınız')).toBeNull();
  expect(screen.queryByTestId('home-tasks')).toBeNull();
  expect(screen.getByTestId('sync-indicator-synced')).toBeTruthy();
  expect(screen.queryByText('Sinxronlaşdırılıb')).toBeNull();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @edildy/mobile test -- home-screen`
Expected: FAIL (subtitle present, tasks box present, pill text present).

- [ ] **Step 3: Implement** in `home-screen.tsx`:
  - header: `<View style={headerBlock.compactBlock}>` → `styles.top` row with the eyebrow date (`formatLocalDate(localDate(now, services.timeZone), locale)`) and a right-hand `View` `{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }` holding `<SyncIndicator compact />` then `<NotificationBell tone="light" />`; below it `<Text accessibilityRole="header" style={headerBlock.greeting}>{t('mobile.home.greeting', { name: s.me.user.fullName })}</Text>`. Remove the subtitle `Text`, the `tools` row, `firstName`.
  - remove the `home-tasks` `Pressable`, `styles.tasks`, `styles.taskCounts`, the `tasks`/`taskStats` queries and the `groupTasks`/`taskCounts` imports.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @edildy/mobile test -- home-screen && pnpm --filter @edildy/mobile typecheck`
Expected: PASS; typecheck clean (no remaining reference to `mobile.tasks.home`, `mobile.home.subtitle`, `mobile.checklists.opensAt`).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/home apps/mobile/src/components/chip.tsx
git commit -m "feat(mobile): shorter home header with date, full name and sync dot; drop the tasks box"
```

---

### Task 5: Flags in the profile language picker

**Files:**
- Modify: `apps/mobile/src/components/language-picker.tsx`
- Modify: `apps/mobile/src/features/profile/profile-screen.tsx:141` (`<LanguagePicker variant="flags" />`)
- Test: `apps/mobile/src/components/language-picker.test.tsx`

**Interfaces:**
- Consumes: `LANGUAGE_FLAGS` (Task 1).
- Produces: `LanguagePicker({ testID = 'language-picker', variant = 'names' }: { testID?: string; variant?: 'names' | 'flags' })`. In `flags`, each chip shows `LANGUAGE_FLAGS[lng]` at `type.xl` and nothing else; `accessibilityLabel` stays `LANGUAGE_NAMES[lng]`; chips are 52 × 44.

- [ ] **Step 1: Write the failing test** in `language-picker.test.tsx` (first `describe`):

```ts
it('flags variant shows only the flag but still names the language for assistive tech', async () => {
  await render(<LanguagePicker variant="flags" />);
  const az = screen.getByRole('radio', { name: 'Azərbaycan dili' });
  expect(az.props.accessibilityState.selected).toBe(true);
  expect(screen.getByText('🇦🇿')).toBeTruthy();
  expect(screen.queryByText('English')).toBeNull();
  fireEvent.press(screen.getByRole('radio', { name: 'English' }));
  await waitFor(() => expect(i18n.language).toBe('en'));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @edildy/mobile test -- language-picker`
Expected: FAIL, "English" text found / no flag text.

- [ ] **Step 3: Implement** the `variant` prop and switch the profile to `variant="flags"`. The login screen is untouched (default `names`).

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @edildy/mobile test -- language-picker`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/language-picker.tsx apps/mobile/src/components/language-picker.test.tsx apps/mobile/src/features/profile/profile-screen.tsx
git commit -m "feat(mobile): flags-only language picker on the profile"
```

---

### Task 6: Whole-package verification

- [ ] **Step 1: Run everything**

Run: `pnpm --filter @edildy/i18n test && pnpm --filter @edildy/mobile test && pnpm --filter @edildy/mobile typecheck && pnpm --filter @edildy/mobile lint`
Expected: all PASS, lint clean.

- [ ] **Step 2: Visual check** on the iOS simulator (`pnpm --filter @edildy/mobile ios` or the existing dev build): Home shows "6 noy 2026", "Salam, Name Surname!", the dot and the bell on one row, no tasks box, cards with `name | site` over `window | opening time`; Profile shows three flags. Fix spacing if the header still looks tall.

- [ ] **Step 3: Commit any fixes** with `fix(mobile): …` and stop. Part 2 starts from this branch.
