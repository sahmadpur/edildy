export default {
  verifyEmail: {
    subject: 'Edildy — confirm your e-mail address',
    body: 'Hello, {{name}}!\n\nConfirm your e-mail address to activate your Edildy account:\n{{link}}\n\nThe link is valid for 72 hours.',
  },
  invite: {
    subject: 'Edildy — invitation to {{org}}',
    body: 'Hello, {{name}}!\n\nYou have been invited to the organisation "{{org}}" on Edildy. Open the link to set your password:\n{{link}}\n\nThe link is valid for 7 days.',
  },
  passwordReset: {
    subject: 'Edildy — password reset',
    body: 'Hello, {{name}}!\n\nOpen the link to set a new password:\n{{link}}\n\nThe link is valid for 1 hour. If you did not request this, ignore this message.',
  },
  notification: {
    open: 'Open: {{link}}',
    footer: 'You can turn these e-mails off in your profile settings.',
  },
  subscriptionEnding: {
    subject: 'Edildy — the subscription of "{{org}}" ends on {{date}}',
    body: 'Hello, {{name}}!\n\nThe Edildy subscription of "{{org}}" ends on {{date}}. Days left: {{days}}.\n\nWrite to us to renew: hello@edildy.com. {{grace}} days after the end the organisation becomes read-only: the data stays, but no new work can be done.',
  },
  subscriptionEnded: {
    subject: 'Edildy — the subscription of "{{org}}" has ended',
    body: 'Hello, {{name}}!\n\nThe Edildy subscription of "{{org}}" ended on {{date}}. Everything keeps working until {{graceEnd}}; then the organisation becomes read-only.\n\nWrite to us to renew: hello@edildy.com.',
  },
} as const;
