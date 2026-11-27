import { siteLevelAllowed, type SiteDto, type SiteTypeDto } from '@edildy/contracts';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NativeSelect } from '@/components/native-select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { levelOf } from './site-types';
import { indentedName, moveTargets } from './tree';

interface Props {
  site: SiteDto;
  sites: SiteDto[];
  types: SiteTypeDto[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMove: (parentId: string | null) => void;
}

export function MoveSiteDialog({ site, sites, types, open, onOpenChange, onMove }: Props) {
  const { t } = useTranslation();
  const [target, setTarget] = useState(site.parentId ?? '');
  // Levels (feedback 2026-11-27): only under a place of a higher level, and to the top only as a Filial; the current
  // parent stays listed even when it breaks the levels (made before them).
  const level = levelOf(types, site.typeId);
  const fits = (parentLevel: number | null) => level !== undefined && siteLevelAllowed(parentLevel, level);
  const options = moveTargets(sites, site.id).filter((s) => s.id === site.parentId || fits(levelOf(types, s.typeId) ?? null));
  const topAllowed = site.parentId === null || fits(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('sites.tree.moveTitle', { name: site.name })}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="move-target">{t('sites.tree.moveTarget')}</Label>
          <NativeSelect id="move-target" value={target} onChange={(e) => setTarget(e.target.value)}>
            {topAllowed && <option value="">{t('sites.tree.root')}</option>}
            {options.map((s) => (
              <option key={s.id} value={s.id}>
                {indentedName(s)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => onMove(target || null)}>{t('sites.tree.move')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
