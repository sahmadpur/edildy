# Publishing Edildy to the App Store and Google Play

This is the step-by-step path from "builds exist" to "anyone can install Edildy from the stores".

| File | What it is |
|---|---|
| [listing.md](listing.md) | Store texts: name, subtitle, descriptions, keywords, release notes (en/ru for Apple, az/en/ru for Google) |
| [forms.md](forms.md) | Answers for Apple's privacy questionnaire, Google's Data safety, content rating, app access and review notes |
| [assets/ios/](assets/ios/) | App Store screenshots, 6.9" iPhone, 1320 × 2868 (en, ru: the App Store has no Azerbaijani listing) |
| [assets/android/](assets/android/) | Play icon (512 × 512), feature graphic (1024 × 500, az/en/ru), phone screenshots (1080 × 1920; az has 5, en/ru 4) |

App ids:
- Bundle id / package: `az.taskop.app`. It can't be changed after the first store release.
- App Store Connect app id: `6820003053`.
- EAS project: `@s.ahmadpur/taskop`.

---

## 0. Before either store: a reviewer account on prod

Both stores test the app with a login you provide.

1. In the prod web app (https://admin.edildy.com), sign in to the demo organisation **Code Academy** (code `code`). It already has sample data.
2. Create a **worker** with an easy username, for example `review`, and a 6-digit PIN. Assign them to a site that has checklist runs **today and in the coming weeks**, so the reviewer sees real work.
3. On a phone, check that you can log in with organisation code `code`, that username, and the PIN. The app opens on the worker login.
4. Keep this account and its data alive while the apps are in review, and also afterwards: Apple re-checks it on every update.

Put these three values wherever forms.md says `<ORG CODE>`, `<USERNAME>` and `<PIN>`.

> Tip: if the organisation's plan expires, the account becomes read-only and review fails. Migration 0025 put every existing organisation on XL with no end date. Check that Code Academy still is, under Platform → Organisations.

---

## 1. Apple App Store

Build 0.1.0 (10) is already uploaded and in TestFlight.

### 1.1 TestFlight check (10 min)
1. App Store Connect → **Apps → Edildy → TestFlight**. Wait until build **10** says "Ready to Test" (Apple e-mails you).
2. Install it through TestFlight on your iPhone. Log in as yourself and as the reviewer worker. Run one checklist and file one problem report.

### 1.2 Rename the app in App Store Connect
App Store Connect → **App Information**:
- **Name**: `Edildy`. The record may still say Taskop from the first setup.
- **Subtitle** (English): from listing.md.
- **Primary language**: English (U.S.).
- **Category**: Business, secondary Productivity.
- **Content Rights**: "No third-party content".
- **Age Rating** → Edit → answer as in forms.md.
- Add the **Russian** localisation (top-right language menu → Russian) and fill in its name and subtitle.

### 1.3 Privacy
App Store Connect → **App Privacy**:
- **Privacy Policy URL**: `https://edildy.com/en/privacy/` (en) and `https://edildy.com/ru/privacy/` (ru).
- **Data collection**: answer as in forms.md, then **Publish**.

### 1.4 Pricing and availability
**Pricing and Availability**:
- Price: **Free**.
- Countries: all, or Azerbaijan only for a quiet launch.

### 1.5 Prepare version 0.1.0 for review
In the left sidebar under **iOS App**, open **0.1.0 Prepare for Submission**. If there is no version, create it with "+".

For each language (English, Russian):
1. **Screenshots → iPhone 6.9" display**: upload `assets/ios/en/01…04.png` (English) or `assets/ios/ru/01…04.png` (Russian), in order. Apple scales them down for smaller iPhones, so the 6.9" set is the only one required. No iPad set is needed, because the app is iPhone-only.
2. **Promotional text**, **Description**, **Keywords**, **Support URL**, **Marketing URL**: from listing.md.

Then, once:
3. **Build**: click "+" and choose build **10**.
4. **Copyright**: `© 2026 Sohrab Ahmadpur`.
5. **App Review Information**:
   - Sign-in required: on. Enter the reviewer account.
   - **Notes**: paste the text from forms.md with the real values filled in.
   - Contact: your name, phone and e-mail.
6. **Version release**: "Manually release this version" is safest for the first release.
7. Click **Add for Review**, then **Submit for Review**.

Review usually takes 1–3 days, and Apple e-mails you the result. If it's rejected, the message names the guideline. Common first-time issues for an app like Edildy:
- **"Demo account doesn't work"**: test the login again on a clean phone.
- **"Account deletion" (5.1.1(v))**: reply that accounts are created by the organisation (no sign-up), and deletion goes through the organisation admin or hello@edildy.com. If they insist, a "Delete account" button that sends a request is a small change.
- **"Minimal functionality / login only"**: point to the demo data and the review notes.

After approval: if you chose manual release, click **Release This Version**.

---

## 2. Google Play

The production AAB (versionCode 2) is at `~/Documents/edildy-builds/edildy-0.1.0-vc2.aab`.

### 2.1 Developer account (one-time, if you don't have one yet)
1. Go to https://play.google.com/console and sign up as a **Personal** account ($25 one-time). Google verifies your identity, which can take a few days.
2. **New personal accounts must run a closed test with at least 12 testers for 14 days** before they can publish to Production. Plan for that (2.6). Organisation accounts are exempt, but they need a D-U-N-S number.

### 2.2 Create the app
**Create app**:
- App name `Edildy`, default language **Azerbaijani – az-AZ**, **App**, **Free**.
- Accept the declarations.

### 2.3 Set up your app (the "Dashboard" checklist)
Fill in each item using forms.md:
- Privacy policy
- App access
- Ads
- Content rating
- Target audience
- News apps
- Data safety
- Government apps
- Financial features
- Health

Then:
1. Set the **App category** and **Store settings** contact details.
2. Go to **Store presence → Main store listing**, default az-AZ:
   - Short and full description from listing.md.
   - App icon: `assets/android/icon-512.png`.
   - Feature graphic: `assets/android/feature-graphic-az.png`.
   - Phone screenshots: `assets/android/az/01…05.png`.
3. **Manage translations → Add your own translations**: add **en-US** and **ru-RU** with their texts, feature graphics and screenshots.

### 2.4 Internal testing: the first upload (by hand)
1. Go to **Test and release → Testing → Internal testing → Create new release**.
2. **App signing**: choose **Use Google-generated key** (Play App Signing). The key the AAB is signed with becomes your *upload key*.
3. Upload `edildy-0.1.0-vc2.aab`, then paste the release notes from listing.md.
4. **Next → Save and publish**.
5. On the **Testers** tab, create an e-mail list (yourself plus whoever should test). Open the **opt-in link** on an Android phone and install from Play.
6. Check that you can log in, run a checklist and get a push notification.

### 2.5 Automate later uploads (optional, one-time)
`eas.json` is already set to submit to the internal track (PR #32). For that to work, Google needs a service account:
1. Go to https://console.cloud.google.com and create or choose a project. Enable the **Google Play Android Developer API**.
2. Go to **IAM → Service accounts → Create**, for example `eas-submit`. Then **Keys → Add key → JSON**, and download it.
3. In Play Console, go to **Users and permissions → Invite new users**. Use the service account's e-mail, give it access to the Edildy app, and grant **Release apps to testing tracks** (plus **Release to production** if you want it later).
4. Save the JSON as `apps/mobile/credentials/play-service-account.json` in the main checkout. That folder is gitignored.

From then on, a new Android release is a build followed by one submit command. See project notes; Claude can run both.

### 2.6 Closed testing (only for new personal accounts)
1. Go to **Testing → Closed testing → Create track** (or use "Alpha"). Promote the internal release to it and add **at least 12 testers** by e-mail or Google Group.
2. The testers must opt in and keep the app installed for **14 days**.
3. Then, on the Dashboard, **Apply for production access** and answer the short questionnaire about the test.

### 2.7 Production
1. Go to **Production → Create new release** and promote the tested release (or upload a new AAB).
2. Countries: **all**, or Azerbaijan first.
3. **Send for review**. First reviews take from a few hours to about 7 days.

---

## 3. Every later release

1. Merge the changes to `main`.
2. Claude builds from a clean worktree, then:
   - **iOS**: `eas build --local -p ios --profile production`, then `eas submit -p ios`. Build numbers go up automatically.
   - **Android**: `eas build --local -p android --profile production` (with `GOOGLE_SERVICES_JSON` exported), then `eas submit -p android`. Version codes go up automatically.
3. iOS: in App Store Connect, create the new version, pick the build, add "What's New" and submit.
4. Android: promote internal → closed or production in Play Console, or submit straight to a track.
5. A user-visible version bump (0.1.0 → 0.2.0) is `version` in `apps/mobile/app.json`.
