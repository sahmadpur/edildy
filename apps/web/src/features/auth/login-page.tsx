import { Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { session } from '@/lib/session';
import { LoginForm } from './login-form';

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="grid gap-6">
      <h1 className="text-xl font-semibold">{t('auth.login.title')}</h1>
      <LoginForm
        onSuccess={async (result) => {
          await session.signedIn(result);
          // Every sign-in opens Göstəricilər on "Bu gün" (feedback 2026-11-07), not the page the session ended on.
          await navigate({ to: '/' });
        }}
      />
      <div className="text-muted-foreground grid gap-2 text-sm">
        <Link to="/forgot-password" className="underline">
          {t('auth.login.forgot')}
        </Link>
        <span>
          {t('auth.login.noAccount')}{' '}
          <Link to="/signup" className="underline">
            {t('auth.login.signupLink')}
          </Link>
        </span>
        <span>{t('auth.login.workersHint')}</span>
      </div>
    </div>
  );
}
