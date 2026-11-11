import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Page, PlatformLoginResult, PlatformTenantDetail, PlatformTenantDto } from '@edildy/contracts';
import { Public } from '../common/decorators';
import { ParseIdPipe } from '../common/parse-id.pipe';
import type { AppRequest } from '../common/request';
import {
  CreateTenantDto,
  PlatformLoginDto,
  PlatformLoginResponse,
  PlatformTenantDetailResponse,
  PlatformTenantListQueryDto,
  PlatformTenantPageResponse,
  PlatformTenantResponse,
  SubscriptionInputDto,
} from './dto';
import { PlatformGuard } from './platform.guard';
import { PlatformService } from './platform.service';

@ApiTags('platform')
@Public()
@Controller('platform/auth')
export class PlatformAuthController {
  constructor(private readonly platform: PlatformService) {}

  @Post('login')
  @HttpCode(200)
  @ApiOkResponse({ type: PlatformLoginResponse })
  login(@Body() body: PlatformLoginDto): Promise<PlatformLoginResult> {
    return this.platform.login(body);
  }
}

@ApiTags('platform')
@ApiBearerAuth()
@Public()
@UseGuards(PlatformGuard)
@Controller('platform/tenants')
export class PlatformTenantsController {
  constructor(private readonly platform: PlatformService) {}

  @Get()
  @ApiOkResponse({ type: PlatformTenantPageResponse })
  list(@Query() q: PlatformTenantListQueryDto): Promise<Page<PlatformTenantDto>> {
    return this.platform.listTenants(q);
  }

  @Post()
  @ApiOkResponse({ type: PlatformTenantDetailResponse })
  create(@Req() req: AppRequest, @Body() body: CreateTenantDto): Promise<PlatformTenantDetail> {
    return this.platform.createTenant(req.platformAdminId!, body);
  }

  @Get(':id')
  @ApiOkResponse({ type: PlatformTenantDetailResponse })
  get(@Param('id', ParseIdPipe) id: string): Promise<PlatformTenantDetail> {
    return this.platform.getTenant(id);
  }

  @Put(':id/subscription')
  @ApiOkResponse({ type: PlatformTenantDetailResponse })
  setSubscription(@Req() req: AppRequest, @Param('id', ParseIdPipe) id: string, @Body() body: SubscriptionInputDto): Promise<PlatformTenantDetail> {
    return this.platform.setSubscription(req.platformAdminId!, id, body);
  }

  @Post(':id/suspend')
  @HttpCode(200)
  @ApiOkResponse({ type: PlatformTenantResponse })
  suspend(@Req() req: AppRequest, @Param('id', ParseIdPipe) id: string): Promise<PlatformTenantDto> {
    return this.platform.setStatus(req.platformAdminId!, id, 'suspended');
  }

  @Post(':id/reactivate')
  @HttpCode(200)
  @ApiOkResponse({ type: PlatformTenantResponse })
  reactivate(@Req() req: AppRequest, @Param('id', ParseIdPipe) id: string): Promise<PlatformTenantDto> {
    return this.platform.setStatus(req.platformAdminId!, id, 'active');
  }
}
