import { Controller, Get, HttpCode, Inject, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { MediaConfirmResult, MediaUrl } from '@edildy/contracts';
import { CurrentPrincipal, RequireFeature } from '../common/decorators';
import { ParseIdPipe } from '../common/parse-id.pipe';
import type { Principal } from '../common/request';
import { MediaConfirmResultResponse, MediaUrlResponse } from '../executions/dto';
import { ProblemReportMediaService } from './problem-report-media.service';

@ApiTags('problem-reports')
@ApiBearerAuth()
@RequireFeature('problems')
@Controller('problem-report-media')
export class ProblemReportMediaController {
  constructor(@Inject(ProblemReportMediaService) private readonly media: ProblemReportMediaService) {}

  @Post(':id/uploaded')
  @HttpCode(200)
  @ApiOkResponse({ type: MediaConfirmResultResponse })
  confirm(@CurrentPrincipal() p: Principal, @Param('id', ParseIdPipe) id: string): Promise<MediaConfirmResult> {
    return this.media.confirmUploaded(p, id);
  }

  @Get(':id/url')
  @ApiOkResponse({ type: MediaUrlResponse })
  url(@CurrentPrincipal() p: Principal, @Param('id', ParseIdPipe) id: string): Promise<MediaUrl> {
    return this.media.viewUrl(p, id);
  }
}
