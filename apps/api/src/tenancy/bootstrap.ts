import { SYSTEM_ROLE_DEFAULTS, SYSTEM_ROLE_KEYS, type SystemRoleKey } from '@edildy/contracts';
import type { Executor } from '../db/db.service';
import { uuidv7 } from 'uuidv7';
import { rolePermissions, roles, sites, siteTypes } from '../db/schema';
import { siteLabel } from './sites.service';

export const DEFAULT_SITE_TYPES = ['Filial', 'Zona', 'Bölmə', 'Yoxlama nöqtəsi'] as const;

/**
 * Seeds site types and the five built-in roles for a new tenant. Must run in that tenant's context.
 * With `branchName`, also creates the tenant's first branch (a top-level "Filial" site): every organisation has one.
 */
export async function seedTenantDefaults(tx: Executor, tenantId: string, branchName?: string): Promise<Record<SystemRoleKey, string>> {
  const types = await tx
    .insert(siteTypes)
    .values(DEFAULT_SITE_TYPES.map((name, i) => ({ tenantId, name, sortOrder: i })))
    .returning({ id: siteTypes.id });
  if (branchName) {
    const id = uuidv7();
    await tx.insert(sites).values({ id, tenantId, parentId: null, typeId: types[0]!.id, name: branchName, path: siteLabel(id) });
  }
  const roleIds = {} as Record<SystemRoleKey, string>;
  for (const key of SYSTEM_ROLE_KEYS) {
    const def = SYSTEM_ROLE_DEFAULTS[key];
    const [role] = await tx
      .insert(roles)
      .values({ tenantId, name: def.name, systemKey: key, dataScope: def.dataScope, editable: def.editable })
      .returning({ id: roles.id });
    roleIds[key] = role!.id;
    if (def.permissions.length > 0) {
      await tx.insert(rolePermissions).values(def.permissions.map((permissionKey) => ({ tenantId, roleId: role!.id, permissionKey })));
    }
  }
  return roleIds;
}
