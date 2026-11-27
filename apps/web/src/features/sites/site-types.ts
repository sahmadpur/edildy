import { ROOT_SITE_LEVEL, siteLevelAllowed, type SiteDto, type SiteTypeDto } from '@edildy/contracts';
import type { TFunction } from 'i18next';

/** The four types every organisation starts with, by their stored (Azerbaijani) name. */
const DEFAULT_TYPE_KEYS: Record<string, string> = {
  Filial: 'branch',
  Zona: 'zone',
  Bölmə: 'section',
  'Yoxlama nöqtəsi': 'checkpoint',
};

/**
 * A type's name in the UI language (feedback 2026-11-27): the default types are stored in Azerbaijani, so while one
 * keeps its default name it is translated; a name the organisation typed is shown as typed.
 */
export function siteTypeLabel(t: TFunction, name: string): string {
  const key = DEFAULT_TYPE_KEYS[name];
  return key ? t(`sites.types.defaults.${key}`) : name;
}

/** The level of a type id, or `undefined` for an unknown one. */
export const levelOf = (types: readonly SiteTypeDto[], typeId: string): number | undefined =>
  types.find((ty) => ty.id === typeId)?.sortOrder;

/**
 * The types a place may have (feedback 2026-11-27): below its parent (only the root type at the top) and above its
 * children, from the highest level down. A place's current type stays a choice even when it breaks the levels (made
 * before them), so a rename still saves.
 */
export function allowedTypes(
  types: readonly SiteTypeDto[],
  parent: SiteDto | null,
  childLevels: readonly number[] = [],
  current?: string,
): SiteTypeDto[] {
  const parentLevel = parent ? (levelOf(types, parent.typeId) ?? null) : null;
  const ceiling = childLevels.length ? Math.min(...childLevels) : Number.POSITIVE_INFINITY;
  return [...types]
    .filter(
      (ty) =>
        ty.id === current ||
        (ty.active && siteLevelAllowed(parentLevel, ty.sortOrder) && ty.sortOrder < ceiling),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Whether anything can go inside a place of this type: some active type is of a lower level. */
export const hasLowerLevel = (types: readonly SiteTypeDto[], typeId: string): boolean => {
  const level = levelOf(types, typeId);
  return level !== undefined && types.some((ty) => ty.active && ty.sortOrder > level);
};

export const isRootType = (ty: SiteTypeDto): boolean => ty.sortOrder === ROOT_SITE_LEVEL;
