import { Controller, Get } from '@nestjs/common';
import { CountryService } from './country.service';

@Controller('catalog/countries')
export class CountryController {
  constructor(private readonly countryService: CountryService) {}

  @Get()
  findAll() {
    return this.countryService.findAll();
  }
}
