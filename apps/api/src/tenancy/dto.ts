import {
  createSiteInputSchema,
  createSiteTypeInputSchema,
  moveSiteInputSchema,
  siteDtoSchema,
  siteTypeDtoSchema,
  tenantDtoSchema,
  tenantSubscriptionDtoSchema,
  updateSiteInputSchema,
  updateSiteTypeInputSchema,
  updateTenantInputSchema,
} from '@edildy/contracts';
import { createZodDto } from 'nestjs-zod';

export class UpdateTenantDto extends createZodDto(updateTenantInputSchema) {}
export class TenantResponse extends createZodDto(tenantDtoSchema) {}
export class CreateSiteTypeDto extends createZodDto(createSiteTypeInputSchema) {}
export class UpdateSiteTypeDto extends createZodDto(updateSiteTypeInputSchema) {}
export class SiteTypeResponse extends createZodDto(siteTypeDtoSchema) {}
export class CreateSiteDto extends createZodDto(createSiteInputSchema) {}
export class UpdateSiteDto extends createZodDto(updateSiteInputSchema) {}
export class MoveSiteDto extends createZodDto(moveSiteInputSchema) {}
export class SiteResponse extends createZodDto(siteDtoSchema) {}
export class TenantSubscriptionResponse extends createZodDto(tenantSubscriptionDtoSchema) {}
