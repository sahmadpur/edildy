/** The transactional e-mails the API sends (apps/api/src/mail/templates.ts), in the recipient's language. */
export default {
  verifyEmail: {
    subject: 'Edildy — e-poçt ünvanınızı təsdiqləyin',
    body: 'Salam, {{name}}!\n\nEdildy hesabınızı aktivləşdirmək üçün e-poçt ünvanınızı təsdiqləyin:\n{{link}}\n\nKeçid 72 saat etibarlıdır.',
  },
  invite: {
    subject: 'Edildy — {{org}} təşkilatına dəvət',
    body: 'Salam, {{name}}!\n\nSizi Edildy-də "{{org}}" təşkilatına dəvət ediblər. Şifrənizi təyin etmək üçün keçidə daxil olun:\n{{link}}\n\nKeçid 7 gün etibarlıdır.',
  },
  passwordReset: {
    subject: 'Edildy — şifrənin bərpası',
    body: 'Salam, {{name}}!\n\nŞifrənizi yeniləmək üçün keçidə daxil olun:\n{{link}}\n\nKeçid 1 saat etibarlıdır. Bu sorğunu siz etməmisinizsə, məktubu nəzərə almayın.',
  },
  /** The plain-text e-mail copy of a notification: the body, then these two lines. */
  notification: {
    open: 'Açmaq üçün: {{link}}',
    footer: 'Bu e-poçtları profil ayarlarında söndürə bilərsiniz.',
  },
  /** Subscription end (BR-01.07): to the organisation's owners, in the organisation's language. */
  subscriptionEnding: {
    subject: 'Edildy — «{{org}}» abunəliyi {{date}} tarixində bitir',
    body: 'Salam, {{name}}!\n\n«{{org}}» təşkilatının Edildy abunəliyi {{date}} tarixində bitir. Qalan gün: {{days}}.\n\nAbunəliyi uzatmaq üçün bizə yazın: hello@edildy.com. Bitdikdən {{grace}} gün sonra təşkilat yalnız baxış rejiminə keçir: məlumatlar qalır, amma yeni iş görmək olmur.',
  },
  subscriptionEnded: {
    subject: 'Edildy — «{{org}}» abunəliyi bitib',
    body: 'Salam, {{name}}!\n\n«{{org}}» təşkilatının Edildy abunəliyi {{date}} tarixində bitib. {{graceEnd}} tarixinədək hər şey işləyir, sonra təşkilat yalnız baxış rejiminə keçir.\n\nAbunəliyi uzatmaq üçün bizə yazın: hello@edildy.com.',
  },
} as const;
