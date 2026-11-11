import { Injectable } from '@nestjs/common';
import type { ShiftDto } from '@edildy/contracts';
import { and, asc, eq, isNull, or, type SQL, sql } from 'drizzle-orm';
import { AppError } from '../common/app-error';
import { assertIdsExist } from '../common/ids-exist';
import { AuditService } from '../db/audit.service';
import { DbService } from '../db/db.service';
import { assignments, shifts, sites } from '../db/schema';
import type { CreateShiftDto, ShiftListQueryDto, UpdateShiftDto } from './dto';
import { sortRanges, toShiftDto } from './mappers';
import { OccurrenceWriter } from './occurrence-writer';

@Injectable()
export class ShiftsService {
  constructor(
    private readonly db: DbService,
    private readonly audit: AuditService,
    private readonly writer: OccurrenceWriter,
  ) {}

  async list(q: ShiftListQueryDto): Promise<ShiftDto[]> {
    const conds: (SQL | undefined)[] = [];
    if (q.active !== undefined) conds.push(eq(shifts.active, q.active));
    if (q.siteId) conds.push(or(isNull(shifts.siteId), eq(shifts.siteId, q.siteId)));
    const rows = await this.select().where(and(...conds)).orderBy(asc(sql`${shifts.ranges}->0->>'startTime'`), asc(shifts.name));
    return rows.map(toShiftDto);
  }

  async get(id: string): Promise<ShiftDto> {
    const [row] = await this.select().where(eq(shifts.id, id));
    if (!row) throw new AppError('NOT_FOUND');
    return toShiftDto(row);
  }

  async create(input: CreateShiftDto): Promise<ShiftDto> {
    const { tenantId } = this.db.context();
    const tx = this.db.tx();
    if (input.siteId) await assertIdsExist(tx, sites, sites.id, [input.siteId]);
    const [row] = await tx
      .insert(shifts)
      .values({ tenantId, name: input.name, ranges: sortRanges(input.ranges), siteId: input.siteId ?? null })
      .returning({ id: shifts.id });
    const dto = await this.get(row!.id);
    await this.audit.record({ action: 'shift.created', entityType: 'shift', entityId: dto.id, after: dto });
    return dto;
  }

  async update(id: string, input: UpdateShiftDto): Promise<ShiftDto> {
    const before = await this.get(id);
    const tx = this.db.tx();
    if (input.siteId) await assertIdsExist(tx, sites, sites.id, [input.siteId]);
    await tx
      .update(shifts)
      .set({ name: input.name, ranges: input.ranges && sortRanges(input.ranges), siteId: input.siteId, active: input.active, updatedAt: new Date() })
      .where(eq(shifts.id, id));
    const after = await this.get(id);
    if (JSON.stringify(after.ranges) !== JSON.stringify(before.ranges)) {
      const using = await this.db
        .tx()
        .select({ id: assignments.id })
        .from(assignments)
        .where(and(eq(assignments.shiftId, id), eq(assignments.status, 'active')))
        .orderBy(asc(assignments.id)); // id order: concurrent multi-assignment changes lock in the same order
      for (const a of using) {
        await this.writer.regenerate(a.id, 'shift_changed');
        await this.audit.record({ action: 'assignment.regenerated', entityType: 'assignment', entityId: a.id, after: { reason: 'shift_changed', shiftId: id } });
      }
    }
    await this.audit.record({ action: 'shift.updated', entityType: 'shift', entityId: id, before, after });
    return after;
  }

  private select() {
    return this.db
      .tx()
      .select({
        id: shifts.id,
        name: shifts.name,
        ranges: shifts.ranges,
        siteId: shifts.siteId,
        siteName: sites.name,
        active: shifts.active,
      })
      .from(shifts)
      .leftJoin(sites, eq(sites.id, shifts.siteId))
      .$dynamic();
  }
}
