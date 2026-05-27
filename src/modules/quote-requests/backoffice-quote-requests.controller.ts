import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AppRole } from '@prisma/client';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUserPayload } from '../auth/auth.types';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ListQuoteRequestsQuery } from './list-quote-requests.query';
import { QuoteRequestStaffNoteDto } from './quote-request-staff-note.dto';
import { QuoteRequestsService } from './quote-requests.service';
import { UpdateQuoteRequestStatusDto } from './update-quote-request-status.dto';

@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(AppRole.STAFF, AppRole.ADMIN)
@ApiBearerAuth()
@Controller('backoffice/quote-requests')
export class BackofficeQuoteRequestsController {
  constructor(private readonly quoteRequestsService: QuoteRequestsService) {}

  @Get()
  findAll(@Query() query: ListQuoteRequestsQuery) {
    return this.quoteRequestsService.findAllForBackoffice(query);
  }

  @Get(':requestId')
  findOne(@Param('requestId') requestId: string) {
    return this.quoteRequestsService.findOneForBackoffice(requestId);
  }

  @Patch(':requestId/claim')
  claim(
    @CurrentUser() user: JwtUserPayload,
    @Param('requestId') requestId: string,
    @Body() body: QuoteRequestStaffNoteDto,
  ) {
    return this.quoteRequestsService.claim(requestId, user.sub, body.staffNote);
  }

  @Patch(':requestId/status')
  updateStatus(
    @CurrentUser() user: JwtUserPayload,
    @Param('requestId') requestId: string,
    @Body() body: UpdateQuoteRequestStatusDto,
  ) {
    return this.quoteRequestsService.updateStatus(requestId, user.sub, body);
  }
}
