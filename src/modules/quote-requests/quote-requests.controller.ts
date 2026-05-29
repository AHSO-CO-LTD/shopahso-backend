import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUserPayload } from '../auth/auth.types';
import { CreateQuoteRequestDto } from './create-quote-request.dto';
import { ListQuoteRequestsQuery } from './list-quote-requests.query';
import { QuoteRequestsService } from './quote-requests.service';
import type { RequestWithOptionalUser } from './quote-requests.types';

@Controller('quote-requests')
export class QuoteRequestsController {
  constructor(private readonly quoteRequestsService: QuoteRequestsService) {}

  @Post()
  create(
    @Req() request: RequestWithOptionalUser,
    @Body() body: CreateQuoteRequestDto,
  ) {
    return this.quoteRequestsService.create(
      body,
      request.header('authorization'),
    );
  }

  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @Get()
  findAllForUser(
    @CurrentUser() user: JwtUserPayload,
    @Query() query: ListQuoteRequestsQuery,
  ) {
    return this.quoteRequestsService.findAllForUser(user.sub, query);
  }

  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @Get(':requestId')
  findOneForUser(
    @CurrentUser() user: JwtUserPayload,
    @Param('requestId') requestId: string,
  ) {
    return this.quoteRequestsService.findOneForUser(user.sub, requestId);
  }
}
