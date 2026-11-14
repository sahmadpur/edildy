export default {
  title: 'Frequently asked questions',
  intro: 'The questions people ask most about the web and mobile apps. Can’t find an answer? Write to Edildy support.',
  items: {
    offline: {
      q: 'Can a worker do a check without internet?',
      a: 'Yes. Checks already on the phone can be done in full offline; answers, photos and videos stay on the phone and are sent as soon as there is a connection. New checks and tasks only download online, so a worker should start the day with internet.',
    },
    workerLogin: {
      q: 'How do workers sign in to the mobile app?',
      a: 'With the organisation code, a login and a PIN. No e-mail or phone number is needed.',
    },
    pin: {
      q: 'A worker forgot the PIN. What now?',
      a: 'Employees → the employee’s card → “Reset PIN/password”. The new PIN is shown only once; pass it on to the worker.',
    },
    password: {
      q: 'I forgot my web password.',
      a: 'On the sign-in page click “Forgot your password?” — a reset link goes to your e-mail. An admin can also send a reset link from the employee’s card.',
    },
    branches: {
      q: 'What are branches, zones and sections?',
      a: 'A branch is one address of the organisation (every organisation has at least one). Zones go inside a branch and sections inside a zone. Add them on the Branches page; when assigning a check you pick the branch, then the zone or section.',
    },
    severalTimes: {
      q: 'How do I assign a check several times a day?',
      a: 'In a new assignment choose “Fixed time” and add the hours with “Add a time” (e.g. 08:00, 13:00, 18:00) — each time is its own check. For an even interval (e.g. every hour 08:00–20:00) choose “Repeat during the day”.',
    },
    takenByOther: {
      q: 'The phone says another employee is doing this check.',
      a: 'The check is assigned to several people and someone else has already started it. A check started offline can also be refused for this reason when it is sent; the answers are kept but do not count.',
    },
    clock: {
      q: 'A warning says the phone clock differs from the server.',
      a: 'Set the date and time to automatic in the phone’s settings. With a difference of more than 5 minutes the check is marked “clock suspect”.',
    },
    update: {
      q: 'The app says “Update the app”.',
      a: 'The checklist needs a newer version of the app. Update it from the App Store or Google Play.',
    },
    partial: {
      q: 'A check became “Partial”. Can it be continued?',
      a: 'No. When the check’s time is over, an unfinished check is locked. For future checks, give the assignment more time to complete.',
    },
    versions: {
      q: 'If I change a question in a published checklist, are old results affected?',
      a: 'No. Every publish is a new version; past checks keep the version they were done with.',
    },
    media: {
      q: 'Where are photos and videos stored?',
      a: 'In your organisation’s own storage. Only employees with permission can see them, through links that expire.',
    },
    scope: {
      q: 'Why does a manager not see some branches?',
      a: 'A manager sees only their own branches with their zones and sections. Employees → the manager’s card → choose the branches.',
    },
    languages: {
      q: 'Which languages are there?',
      a: 'Azerbaijani, English and Russian — on the web and in the mobile app. Each employee picks their own.',
    },
  },
} as const;
