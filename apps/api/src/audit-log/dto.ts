import { auditEntryDtoSchema, auditListQuerySchema, pageOf } from '@edildy/contracts';
import { createZodDto } from 'nestjs-zod';

export class AuditListQueryDto extends createZodDto(auditListQuerySchema) {}
export class AuditPageResponse extends createZodDto(pageOf(auditEntryDtoSchema)) {}
