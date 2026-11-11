# Edildy — answers for the store forms

These answers match what the app actually does: no ads, no analytics or tracking SDKs, no in-app purchases, and no self sign-up. If any of that changes, update these forms too.

---

## App Store Connect

### App Privacy (Apple's privacy questionnaire)
**Do you or your third-party partners collect data from this app?** Yes.

Tick these data types. For each one, answer: used for **App Functionality** only; **linked to the user**: Yes; **used for tracking**: No.

| Category | Data type | Note |
|---|---|---|
| Contact Info | Name | Account name |
| Contact Info | Email Address | Staff log-in and invites |
| Contact Info | Phone Number | Optional, entered by the organisation |
| User Content | Photos or Videos | Evidence attached to answers and problem reports |
| User Content | Audio Data | Only the sound track of videos the user records |
| User Content | Other User Content | Checklist answers, comments, problem reports |
| Location | Precise Location | Only when filing a problem report, with permission |
| Identifiers | User ID | Account id |
| Usage Data | Product Interaction | Activity log the organisation sees (who did what, when) |

**Do you use data for tracking?** No. Edildy has no ad or analytics SDKs.

### Age rating questionnaire
- Answer **None / No** to every content question: violence, sexual content, profanity, drugs, gambling, horror, medical, and so on.
- Unrestricted web access: **No**.
- User-generated content / messaging: content is shared only inside the user's own organisation. If asked, answer **Yes**, with the note "private, invite-only workspace for the user's employer; no public content".
- Expected result: **4+**. If the new form adds 9+/13+ because of user-generated content, accept it.

### Other App Store questions
- **Content rights:** "Does your app contain, show, or access third-party content?" **No.**
- **Export compliance:** already answered in the binary (`ITSAppUsesNonExemptEncryption = NO`), so App Store Connect doesn't ask again.
- **Advertising identifier (IDFA):** not used.
- **Pricing:** Free. **Availability:** all countries, or start with Azerbaijan only.
- **Sign-in required:** Yes, so a demo account goes into App Review Information (see below).

### App Review Information → Notes
Paste this text:
```
Edildy is a business (B2B) app. Organisations sign a contract with Edildy, and their administrators create accounts for their staff and field workers in the Edildy web app (https://admin.edildy.com). There is no public sign-up and there are no in-app purchases; organisations are billed directly under separate contracts (guideline 3.1.3(c), enterprise services). Because accounts are created by the organisation, not by the user, account deletion is handled by the organisation's administrator or by e-mailing hello@edildy.com (see https://edildy.com/en/privacy/).

Demo login (field-worker account in a demo organisation with sample data). The login screen opens on the worker login:
- Organisation code: <ORG CODE>
- Username: <USERNAME>
- PIN or password: <PIN>

Use the flag button at the top right to switch the app to English (also in Profile → Language). The sample checklists themselves are written in Azerbaijani.

What to try: Home lists today's checklist runs → tap the arrow on a run under "Now" to answer it (Yes/No, photos), section by section. Problems → "Report a problem" files a report with your location (asks for location permission). Calendar shows the coming runs; the bell shows notifications.
```
Also fill in the **Sign-in information** fields. They hold only one username and one password, so enter `<ORG CODE>/<USERNAME>` as the username and the PIN as the password, and leave the step-by-step explanation in the notes. Contact: your name, phone and e-mail.

---

## Google Play Console → App content

### Privacy policy
`https://edildy.com/privacy/`

### App access
Choose **All or some functionality is restricted** → **Add instructions**:
- Name: `Demo worker`
- Username: `<ORG CODE> / <USERNAME>`
- Password: `<PIN>`
- Instructions: `The login screen opens on the worker login: enter the organisation code, username and PIN. The flag button at the top switches the app to English. Accounts are created by each organisation; there is no public sign-up.`

### Ads
**No**, the app doesn't contain ads.

### Content rating (IARC questionnaire)
- Category: **All other app types** (utility, productivity, communication, or other).
- Violence, sexuality, language, controlled substances, gambling, and so on: **No** to all.
- **Do users interact or exchange content?** Yes. Users share photos and text with others in their organisation.
- **Does the app share the user's current physical location with other users?** Yes, only when a user attaches it to a problem report that their managers see.
- **Allows users to purchase digital goods?** No.
- Expected result: **Everyone / PEGI 3**, possibly with the "Users Interact" note.

### Target audience and content
- Target age groups: **18 and over** only.
- Appeals to children: **No**.

### News app: No. Government app: No. Financial features: none. Health: none.

### Data safety
**Does your app collect or share any of the required user data types?** Yes.
**Is all of the user data collected by your app encrypted in transit?** Yes.
**Which of the following methods of account creation does your app support?** Accounts are created by the user's organisation (choose "My app does not allow users to create an account" if that option fits; otherwise "Other" with this explanation).
**Do you provide a way for users to request that their data is deleted?** Yes.
**Delete account URL** (if asked): `https://edildy.com/privacy/#delete`

Data types. For every row: **Collected** yes, **Shared** no, **Processed ephemerally** no.

| Section | Data type | Required / optional | Purposes |
|---|---|---|---|
| Personal info | Name | Required | App functionality, Account management |
| Personal info | Email address | Required for staff | App functionality, Account management |
| Personal info | Phone number | Optional | App functionality, Account management |
| Personal info | User IDs | Required | App functionality, Account management |
| Location | Precise location | Optional | App functionality |
| Photos and videos | Photos | Optional | App functionality |
| Photos and videos | Videos | Optional | App functionality |
| Audio | Voice or sound recordings | Optional (video sound) | App functionality |
| App activity | App interactions | Required | App functionality |
| App activity | Other user-generated content | Required | App functionality |
| Device or other IDs | Device or other IDs | Required (push token) | App functionality |

Service providers that process data for Edildy (hosting, e-mail delivery, push delivery) don't count as "sharing" in Play's definition.

### Store settings
- App category: **Business**.
- Tags: Productivity, Business management, Task management. Pick whatever is closest from Play's list.
- Contact: e-mail `hello@edildy.com`, website `https://edildy.com/`.
