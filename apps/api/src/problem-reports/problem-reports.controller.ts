import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Page, ProblemReportDto, ReportSite } from '@taskop/contracts';
import { CurrentPrincipal, RequirePermission } from '../common/decorators';
import { ParseIdPipe } from '../common/parse-id.pipe';
import type { Principal } from '../common/request';
import { CloseProblemReportDto, CreateProblemReportDto, ProblemReportListQueryDto, ProblemReportPageResponse, ProblemReportResponse, ReportSitesResponse } from './dto';
import { ProblemReportQueries } from './problem-report-queries';
import { ProblemReportsService } from './problem-reports.service';

/** 2026-11-06 design §6.2. Routes without a permission decorator decide access in the service (readable scope). */
@ApiTags('problem-reports')
@ApiBearerAuth()
@Controller('problem-reports')
export class ProblemReportsController {
  constructor(
    @Inject(ProblemReportsService) private readonly reports: ProblemReportsService,
    @Inject(ProblemReportQueries) private readonly queries: ProblemReportQueries,
  ) {}

  /** Declared before `:id`, so "sites" is never parsed as an id. */
  @Get('sites')
  @ApiOkResponse({ type: ReportSitesResponse })
  sites(@CurrentPrincipal() p: Principal): Promise<ReportSite[]> {
    return this.queries.sites(p);
  }

  @Get()
  @ApiOkResponse({ type: ProblemReportPageResponse })
  list(@CurrentPrincipal() p: Principal, @Query() q: ProblemReportListQueryDto): Promise<Page<ProblemReportDto>> {
    return this.queries.list(p, q);
  }

  @Get(':id')
  @ApiOkResponse({ type: ProblemReportResponse })
  get(@CurrentPrincipal() p: Principal, @Param('id', ParseIdPipe) id: string): Promise<ProblemReportDto> {
    return this.queries.detail(p, id);
  }

  @Post()
  @ApiCreatedResponse({ type: ProblemReportResponse })
  create(@CurrentPrincipal() p: Principal, @Body() body: CreateProblemReportDto): Promise<ProblemReportDto> {
    return this.reports.create(p, body);
  }

  @Post(':id/close')
  @HttpCode(200)
  @RequirePermission('tasks.manage')
  @ApiOkResponse({ type: ProblemReportResponse })
  close(@CurrentPrincipal() p: Principal, @Param('id', ParseIdPipe) id: string, @Body() body: CloseProblemReportDto): Promise<ProblemReportDto> {
    return this.reports.close(p, id, body);
  }
}
