import {
  createTenantInputSchema,
  pageOf,
  platformLoginInputSchema,
  platformLoginResultSchema,
  platformTenantDetailSchema,
  platformTenantDtoSchema,
  platformTenantListQuerySchema,
  subscriptionInputSchema,
  tenantActivitySchema,
} from '@edildy/contracts';
import { createZodDto } from 'nestjs-zod';

export class PlatformLoginDto extends createZodDto(platformLoginInputSchema) {}
export class PlatformLoginResponse extends createZodDto(platformLoginResultSchema) {}
export class PlatformTenantListQueryDto extends createZodDto(platformTenantListQuerySchema) {}
export class PlatformTenantResponse extends createZodDto(platformTenantDtoSchema) {}
export class PlatformTenantPageResponse extends createZodDto(pageOf(platformTenantDtoSchema)) {}
export class PlatformTenantDetailResponse extends createZodDto(platformTenantDetailSchema) {}
export class CreateTenantDto extends createZodDto(createTenantInputSchema) {}
export class SubscriptionInputDto extends createZodDto(subscriptionInputSchema) {}
export class TenantActivityResponse extends createZodDto(tenantActivitySchema) {}
