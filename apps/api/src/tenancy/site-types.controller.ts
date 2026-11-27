import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { SiteTypeDto } from '@edildy/contracts';
import { RequirePermission } from '../common/decorators';
import { ParseIdPipe } from '../common/parse-id.pipe';
import { CreateSiteTypeDto, ReorderSiteTypesDto, SiteTypeResponse, UpdateSiteTypeDto } from './dto';
import { SiteTypesService } from './site-types.service';

@ApiTags('sites')
@ApiBearerAuth()
@Controller('site-types')
export class SiteTypesController {
  constructor(private readonly types: SiteTypesService) {}

  @Get()
  @RequirePermission('sites.view')
  @ApiOkResponse({ type: [SiteTypeResponse] })
  list(): Promise<SiteTypeDto[]> {
    return this.types.list();
  }

  @Post()
  @RequirePermission('sites.manage')
  create(@Body() body: CreateSiteTypeDto): Promise<SiteTypeDto> {
    return this.types.create(body);
  }

  /** New levels for every type but the root (feedback 2026-11-27). */
  @Post('order')
  @HttpCode(200)
  @RequirePermission('sites.manage')
  @ApiOkResponse({ type: [SiteTypeResponse] })
  reorder(@Body() body: ReorderSiteTypesDto): Promise<SiteTypeDto[]> {
    return this.types.reorder(body);
  }

  @Patch(':id')
  @RequirePermission('sites.manage')
  update(@Param('id', ParseIdPipe) id: string, @Body() body: UpdateSiteTypeDto): Promise<SiteTypeDto> {
    return this.types.update(id, body);
  }
}
