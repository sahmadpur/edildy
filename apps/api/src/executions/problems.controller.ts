import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Page, ProblemDto } from '@edildy/contracts';
import { CurrentPrincipal, RequireFeature, RequirePermission } from '../common/decorators';
import type { Principal } from '../common/request';
import { ProblemListQueryDto, ProblemPageResponse } from './dto';
import { ProblemsService } from './problems.service';

@ApiTags('executions')
@ApiBearerAuth()
@RequireFeature('problems')
@Controller('problems')
export class ProblemsController {
  constructor(@Inject(ProblemsService) private readonly problems: ProblemsService) {}

  @Get()
  @RequirePermission('assignments.view')
  @ApiOkResponse({ type: ProblemPageResponse })
  list(@CurrentPrincipal() p: Principal, @Query() q: ProblemListQueryDto): Promise<Page<ProblemDto>> {
    return this.problems.list(p, q);
  }
}
