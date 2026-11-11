import type { LegalTexts } from './types';

export default {
  updatedOn: '11 November 2026',
  privacy: {
    intro: [
      'This policy explains what personal data Edildy collects, why we collect it, who we share it with and what you can do about it. It covers the website edildy.com, the web app at admin.edildy.com and the Edildy mobile app for iOS and Android.',
    ],
    sections: [
      {
        id: 'who',
        title: 'Who we are',
        body: [
          'Edildy is a service for checklists, inspections and tasks that businesses use to organise and check work done by their staff. It is operated by Sohrab Ahmadpur, an individual developer ("Edildy", "we", "us").',
          'For questions about privacy and personal data, write to sohrab.ahmadpur@gmail.com. For anything else, write to hello@edildy.com.',
        ],
      },
      {
        id: 'roles',
        title: 'Your organisation and Edildy',
        body: [
          'Edildy has no public sign-up. We create an account for an organisation (a business customer) that has a contract with us. The organisation\'s admins then invite staff by e-mail and create accounts for field workers with a username.',
          'For the data of an organisation\'s users and the work they record, the organisation is the controller: it decides what is collected and for what purpose. Edildy processes that data on the organisation\'s behalf and on its instructions. If you use Edildy through your employer, your employer is the first place to ask about your data.',
          'For visitors to edildy.com and for the contact people of the organisations we work with, Edildy is the controller.',
        ],
      },
      {
        id: 'data',
        title: 'What data we collect',
        body: [
          {
            list: [
              'Account data: your name, your e-mail address (staff) or username (field workers), a phone number if one is added, your role and permissions, your organisation, sites and teams, and your language and notification preferences. Passwords and PINs are stored only as one-way hashes, so nobody can read them, including us.',
              'Work data: what you record while working, such as checklist answers, comments, tasks and shifts, problem reports, audit results and corrections, and the times when the work was done.',
              'Photos and videos: only those you take with the camera or pick from your gallery and attach as evidence to a checklist answer or a problem report. The microphone is used only to record the sound of a video you record.',
              'Location: your precise location, only when you file a problem report and have allowed location access. It is saved with that report (latitude, longitude, accuracy and time). The app does not track your location in the background.',
              'Push notifications: a push token for each device you sign in on, used to deliver notifications to that device. It is removed when you log out.',
              'Technical data: the IP address and browser or device details (user agent) of your login sessions; an activity log of actions in the service, recording which user did what, when, and whether from the web or the mobile app; and server logs.',
            ],
          },
          'The website edildy.com does not ask for personal data. It only remembers the language you chose, in your own browser\'s storage. If you write to us by e-mail, we use your address and message only to reply.',
        ],
      },
      {
        id: 'use',
        title: 'How we use data',
        body: [
          {
            list: [
              'To provide the service: sign you in, show you your work, sync the mobile app, store evidence, and produce the reports, audits and dashboards your organisation uses.',
              'To send notifications and e-mails the service needs: invitations, password resets, and the reports and alerts your organisation has set up.',
              'To keep the service secure and reliable: protect accounts, investigate errors and misuse, and keep a record of who changed what.',
              'To help your organisation when it asks us for support.',
            ],
          },
          'We process this data to provide the service under our contract with your organisation, to keep it secure, and where the law requires it.',
          'We do not use your data for advertising, we do not sell it, and we do not track you across other apps or websites. The website and the apps contain no advertising, analytics or tracking tools.',
        ],
      },
      {
        id: 'device',
        title: 'Permissions and data on your device',
        body: [
          'The mobile app asks for access to the camera, photo gallery, microphone and location only when you use a feature that needs it. You can turn each permission off at any time in your device settings; you then cannot attach that kind of evidence or add a location, but the rest of the app keeps working.',
          'So that you can keep working without a connection, the mobile app keeps an encrypted offline database on your device and stores your login token in the device\'s secure keychain. Logging out deletes both from the device.',
        ],
      },
      {
        id: 'sharing',
        title: 'Who we share data with',
        body: [
          'Within your organisation, users with the right permissions, such as managers and auditors, can see the work, photos, videos and reports within their scope, as your organisation\'s admins have set up.',
          'We use a small number of service providers to run Edildy. They process data only to provide their service to us:',
          {
            list: [
              'Hetzner Online (Germany) hosts our servers, database, file storage and backups in the European Union.',
              'An e-mail delivery provider sends invitations, password resets and reports.',
              'Apple Push Notification service, Firebase Cloud Messaging (Google) and the Expo push service deliver push notifications. They receive the device\'s push token and the text of the notification.',
            ],
          },
          'We may also disclose data when the law requires it.',
          'We do not sell personal data and do not give it to anyone for their own marketing.',
        ],
      },
      {
        id: 'security',
        title: 'Where data is stored and how it is protected',
        body: [
          'Data is stored in the European Union, on servers of Hetzner Online in Germany. Photos, videos and other files are kept in S3-compatible storage that we run ourselves on the same infrastructure. The database is backed up every day.',
          'All connections to the website, the web app and the mobile app are encrypted with TLS. Files are shown only to users with permission, through time-limited links. Passwords and PINs are hashed, and the offline database on the phone is encrypted.',
          'If you use Edildy from outside the European Union, your data is transferred to and stored in the European Union.',
        ],
      },
      {
        id: 'retention',
        title: 'How long we keep data',
        body: [
          'We keep data for as long as your organisation\'s subscription is active.',
          'When the contract ends, the organisation can ask us to export or delete its data. We delete it within 90 days after the contract ends, unless the law requires us to keep part of it for longer.',
          'Backups are replaced on their own rotation schedule, so deleted data can remain in a backup for a limited time before it disappears.',
        ],
      },
      {
        id: 'rights',
        title: 'Your rights',
        body: [
          'You can ask to access, correct, delete or export your personal data.',
          'Because your organisation controls your account and work data, the quickest way is usually to ask your organisation\'s admin, who can change most of it directly. You can also write to sohrab.ahmadpur@gmail.com. If your request concerns data your organisation controls, we will pass it on to the organisation and help it respond. We may need to confirm who you are before we act on a request.',
        ],
      },
      {
        id: 'delete',
        title: 'How to delete your account / data',
        body: [
          'Accounts are created by your organisation, so they are also deleted through it or through us. To delete your account and the personal data linked to it, do one of the following:',
          {
            list: [
              'Ask your organisation\'s admin to delete your account.',
              'Write to sohrab.ahmadpur@gmail.com with the subject "Delete my account". Send it from your account\'s e-mail address; if you are a field worker, include your organisation code and username.',
            ],
          },
          'We delete the account within 30 days of the request.',
          'What may be kept: records your organisation has to keep, such as completed inspections and audits, may stay in the organisation\'s history, either anonymised or still attributed to you, according to the organisation\'s needs and legal obligations. Copies in backups disappear as the backups are replaced.',
          'An organisation that wants all its data deleted can ask the same way. Logging out of the mobile app immediately removes the offline data and the login token from that device.',
        ],
      },
      {
        id: 'children',
        title: 'Children',
        body: ['Edildy is a service for work and is not intended for anyone under 16. We do not knowingly collect data about children under 16.'],
      },
      {
        id: 'changes',
        title: 'Changes to this policy',
        body: ['When we change this policy, we publish the new version on this page and update the date at the top.'],
      },
      {
        id: 'contact',
        title: 'Contact',
        body: ['Privacy questions and requests: sohrab.ahmadpur@gmail.com. Everything else: hello@edildy.com.'],
      },
    ],
  },
  terms: {
    intro: [
      'These terms apply to the use of Edildy: the website edildy.com, the web app at admin.edildy.com and the Edildy mobile app. By using Edildy you accept them.',
    ],
    sections: [
      {
        id: 'service',
        title: 'The service',
        body: [
          'Edildy is a business-to-business service for checklists, inspections and tasks, operated by Sohrab Ahmadpur ("Edildy", "we", "us"). We provide it to organisations under a contract with each organisation. People get access through their organisation; there is no public sign-up.',
          'If the contract with an organisation says something different from these terms, the contract applies.',
        ],
      },
      {
        id: 'plans',
        title: 'Plans and payment',
        body: [
          'Plans and prices are agreed separately with each organisation, and billing happens outside the apps. There are no purchases or payments in the apps.',
          'Each plan has an expiry date. After it there is a grace period, and after the grace period the organisation\'s account becomes read-only: existing data can be viewed, but no new work can be recorded until the plan is renewed.',
        ],
      },
      {
        id: 'accounts',
        title: 'Accounts and the organisation\'s responsibility',
        body: [
          'The organisation\'s admins create and manage its users and decide what each of them can see and do. The organisation is responsible for its users and for the content it and its users enter into Edildy, including having the right to collect and store it.',
          'Keep your password or PIN to yourself. If you think someone else has used your account, tell your organisation\'s admin straight away.',
        ],
      },
      {
        id: 'use',
        title: 'Acceptable use',
        body: [
          'Use Edildy lawfully and only for your organisation\'s work. In particular, do not:',
          {
            list: [
              'break the law or other people\'s rights, including their privacy;',
              'upload content that you have no right to share or that is unlawful or harmful;',
              'try to reach data of other users or organisations that you have no access to, or get around security measures;',
              'disrupt or overload the service, or copy, resell or reverse-engineer it.',
            ],
          },
        ],
      },
      {
        id: 'data',
        title: 'Your data',
        body: [
          'The data an organisation enters into Edildy belongs to the organisation. We use it only to provide the service, as described in the privacy policy. When the contract ends, the organisation can ask for an export or deletion of its data.',
        ],
      },
      {
        id: 'availability',
        title: 'Availability and changes to the service',
        body: [
          'We work to keep Edildy available, secure and working well, but we cannot promise that it will always be available or free of errors. There may be breaks for maintenance and updates. We may change, improve or remove features over time.',
        ],
      },
      {
        id: 'suspension',
        title: 'Suspension and ending',
        body: [
          'We may suspend or limit access to Edildy, for one user or for a whole organisation, in the case of misuse or a breach of these terms, or after a subscription ends (the account becomes read-only after the grace period). Ending the contract itself follows what was agreed with the organisation. What happens to the data afterwards is described in the privacy policy.',
        ],
      },
      {
        id: 'liability',
        title: 'Disclaimer and limitation of liability',
        body: [
          'Edildy is provided "as is" and "as available", to the extent the law allows. We are not liable for indirect or consequential losses, such as lost profit, lost business or lost data, arising from the use of the service or from being unable to use it.',
          'Unless the contract with the organisation says otherwise, our total liability is limited to the amount the organisation paid for the service in the 12 months before the claim. Nothing in these terms limits liability that cannot be limited by law.',
        ],
      },
      {
        id: 'law',
        title: 'Governing law',
        body: [
          'These terms are governed by the laws of the Republic of Azerbaijan. We will first try to settle any dispute by talking to each other; if that fails, it goes to the competent courts of the Republic of Azerbaijan.',
        ],
      },
      {
        id: 'changes',
        title: 'Changes to these terms',
        body: [
          'When we change these terms, we publish the new version on this page and update the date at the top. Using Edildy after a change means you accept the new terms.',
        ],
      },
      {
        id: 'contact',
        title: 'Contact',
        body: ['Questions about these terms: hello@edildy.com.'],
      },
    ],
  },
} as const satisfies LegalTexts;
