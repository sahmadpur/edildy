import { Injectable } from '@nestjs/common';
import { ROOT_SITE_LEVEL, siteLevelAllowed, type SiteTypeDto } from '@edildy/contracts';
import { alias } from 'drizzle-orm/pg-core';
import { asc, eq, max } from 'drizzle-orm';
import { AppError } from '../common/app-error';
import { AuditService } from '../db/audit.service';
import { DbService } from '../db/db.service';
import { sites, siteTypes } from '../db/schema';
import type { CreateSiteTypeDto, ReorderSiteTypesDto, UpdateSiteTypeDto } from './dto';
import { lockSiteTree } from './sites.service';

const toDto = (r: typeof siteTypes.$inferSelect): SiteTypeDto => ({ id: r.id, name: r.name, sortOrder: r.sortOrder, active: r.active });

/**
 * Structure types and their levels (feedback 2026-11-27): `sort_order` is the level, 0 for the root type (Filial),
 * which can be neither deactivated nor moved; the others are reordered as a whole.
 */
@Injectable()
export class SiteTypesService {
  constructor(
    private readonly db: DbService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<SiteTypeDto[]> {
    const rows = await this.db.tx().select().from(siteTypes).orderBy(asc(siteTypes.sortOrder), asc(siteTypes.name));
    return rows.map(toDto);
  }

  /** A new type is the deepest level. */
  async create(input: CreateSiteTypeDto): Promise<SiteTypeDto> {
    const tx = this.db.tx();
    const { tenantId } = this.db.context();
    await lockSiteTree(tx, tenantId);
    const [last] = await tx.select({ level: max(siteTypes.sortOrder) }).from(siteTypes);
    const sortOrder = last?.level === null || last?.level === undefined ? ROOT_SITE_LEVEL : last.level + 1;
    const [row] = await tx.insert(siteTypes).values({ tenantId, name: input.name, sortOrder }).returning();
    const dto = toDto(row!);
    await this.audit.record({ action: 'site_type.created', entityType: 'site_type', entityId: dto.id, after: dto });
    return dto;
  }

  async update(id: string, input: UpdateSiteTypeDto): Promise<SiteTypeDto> {
    const tx = this.db.tx();
    const [existing] = await tx.select().from(siteTypes).where(eq(siteTypes.id, id));
    if (!existing) throw new AppError('NOT_FOUND');
    if (input.active === false && existing.sortOrder === ROOT_SITE_LEVEL) throw new AppError('SITE_TYPE_ROOT');
    const [row] = await tx.update(siteTypes).set({ name: input.name, active: input.active }).where(eq(siteTypes.id, id)).returning();
    const dto = toDto(row!);
    await this.audit.record({ action: 'site_type.updated', entityType: 'site_type', entityId: id, before: toDto(existing), after: dto });
    return dto;
  }

  /**
   * New levels for every type but the root: `ids` from the highest down get 1, 2, 3… An order that would put a place
   * inside one of a lower level is refused; places that already broke the levels (made before them) do not block it.
   */
  async reorder(input: ReorderSiteTypesDto): Promise<SiteTypeDto[]> {
    const tx = this.db.tx();
    await lockSiteTree(tx, this.db.context().tenantId);
    const types = await tx.select().from(siteTypes);
    const others = types.filter((ty) => ty.sortOrder !== ROOT_SITE_LEVEL);
    const ids = new Set(input.ids);
    if (ids.size !== input.ids.length || ids.size !== others.length || others.some((ty) => !ids.has(ty.id))) {
      // Not every non-root type once: a stale list, or one that tries to move the root.
      throw new AppError('VALIDATION_FAILED');
    }
    const before = new Map(types.map((ty) => [ty.id, ty.sortOrder]));
    const after = new Map(before);
    input.ids.forEach((id, i) => after.set(id, i + 1));
    // Each distinct (parent type, child type) pair among the places.
    const parent = alias(sites, 'parent');
    const pairs = await tx
      .selectDistinct({ parentType: parent.typeId, childType: sites.typeId })
      .from(sites)
      .innerJoin(parent, eq(parent.id, sites.parentId));
    const breaks = pairs.some(
      (p) => siteLevelAllowed(before.get(p.parentType)!, before.get(p.childType)!) && !siteLevelAllowed(after.get(p.parentType)!, after.get(p.childType)!),
    );
    if (breaks) throw new AppError('SITE_TYPE_ORDER_CONFLICT');
    for (const [i, id] of input.ids.entries()) {
      await tx.update(siteTypes).set({ sortOrder: i + 1 }).where(eq(siteTypes.id, id));
    }
    const dto = await this.list();
    await this.audit.record({
      action: 'site_type.reordered',
      entityType: 'site_type',
      entityId: null,
      before: types.map(toDto).sort((a, b) => a.sortOrder - b.sortOrder),
      after: dto,
    });
    return dto;
  }
}
