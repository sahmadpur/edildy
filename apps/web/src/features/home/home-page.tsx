import { useTranslation } from 'react-i18next';
import { useCan, useMe } from '@/lib/session';
import { HomeDashboard } from './home-dashboard';

/** Spec §6.1: the live dashboard for reports.view holders; everyone else keeps the welcome page. */
export function HomePage() {
  const canReport = useCan('reports.view');
  return canReport ? <HomeDashboard /> : <Welcome />;
}

function Welcome() {
  const { t } = useTranslation();
  const me = useMe();
  return (
    <div className="grid max-w-2xl gap-3">
      <h1 className="text-2xl font-semibold">{t('nav.welcome', { name: me.user.fullName.split(' ')[0] })}</h1>
      <p className="text-muted-foreground">{t('nav.intro')}</p>
    </div>
  );
}
