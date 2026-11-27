import { z } from 'zod';
import { idSchema } from './common.js';

export const siteTypeDtoSchema = z.object({ id: idSchema, name: z.string(), sortOrder: z.number().int(), active: z.boolean() });
export type SiteTypeDto = z.infer<typeof siteTypeDtoSchema>;

/** A new type is added as the deepest level; levels change only through the reorder (feedback 2026-11-27). */
export const createSiteTypeInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
});
export type CreateSiteTypeInput = z.input<typeof createSiteTypeInputSchema>;

export const updateSiteTypeInputSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  active: z.boolean().optional(),
});
export type UpdateSiteTypeInput = z.input<typeof updateSiteTypeInputSchema>;

/** Every type except the root (Filial), from the highest level down; they get levels 1, 2, 3… in this order. */
export const reorderSiteTypesInputSchema = z.object({
  ids: z.array(idSchema).max(50),
});
export type ReorderSiteTypesInput = z.input<typeof reorderSiteTypesInputSchema>;

/**
 * Structure levels (feedback 2026-11-27): a type's `sortOrder` is its level, 0 for the root type (Filial), which can be
 * neither deactivated nor moved. Only the root type stands at the top; any other place sits under a place of a higher
 * level (a smaller number), e.g. a Zona or a Bölmə under a Filial, never a Zona under a Bölmə.
 */
export const ROOT_SITE_LEVEL = 0;

/** Whether a place of `level` may sit under a parent of `parentLevel` (`null`: at the top). */
export function siteLevelAllowed(parentLevel: number | null, level: number): boolean {
  return parentLevel === null ? level === ROOT_SITE_LEVEL : level > parentLevel;
}

export const siteDtoSchema = z.object({
  id: idSchema,
  parentId: idSchema.nullable(),
  typeId: idSchema,
  name: z.string(),
  address: z.string().nullable(),
  active: z.boolean(),
  path: z.string(),
  depth: z.number().int(),
});
export type SiteDto = z.infer<typeof siteDtoSchema>;

export const createSiteInputSchema = z.object({
  parentId: idSchema.nullable(),
  typeId: idSchema,
  name: z.string().trim().min(1).max(120),
  address: z.string().trim().max(300).nullable().optional(),
});
export type CreateSiteInput = z.input<typeof createSiteInputSchema>;

export const updateSiteInputSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  typeId: idSchema.optional(),
  address: z.string().trim().max(300).nullable().optional(),
  active: z.boolean().optional(),
});
export type UpdateSiteInput = z.input<typeof updateSiteInputSchema>;

export const moveSiteInputSchema = z.object({ parentId: idSchema.nullable() });
export type MoveSiteInput = z.input<typeof moveSiteInputSchema>;
