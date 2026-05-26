import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { CountryDefinition, ResolvedCountry } from './country.types';

@Injectable()
export class CountryService {
  private readonly countries = this.loadCountries();
  private readonly countryByCode = new Map(
    this.countries.map((country) => [country.code, country]),
  );
  private readonly codeByAlias = this.buildAliasIndex();

  findAll(): ResolvedCountry[] {
    return this.countries.map((country) => this.serializeCountry(country));
  }

  resolve(input?: string | null): ResolvedCountry | null {
    const value = input?.trim();
    if (!value) {
      return null;
    }

    const directCode = value.toUpperCase();
    const byCode = this.countryByCode.get(directCode);
    if (byCode) {
      return this.serializeCountry(byCode);
    }

    const code = this.codeByAlias.get(this.normalize(value));
    if (!code) {
      return null;
    }

    const country = this.countryByCode.get(code);
    return country ? this.serializeCountry(country) : null;
  }

  requireValidCode(code?: string | null): string | null {
    const country = this.resolve(code);
    return country?.code ?? null;
  }

  private loadCountries(): CountryDefinition[] {
    const filePath = [
      join(__dirname, 'countries.json'),
      join(process.cwd(), 'src', 'common', 'countries', 'countries.json'),
      join(process.cwd(), 'dist', 'common', 'countries', 'countries.json'),
    ].find((candidate) => existsSync(candidate));

    if (!filePath) {
      throw new Error('Countries data file was not found');
    }

    return JSON.parse(readFileSync(filePath, 'utf8')) as CountryDefinition[];
  }

  private buildAliasIndex() {
    const index = new Map<string, string>();

    for (const country of this.countries) {
      for (const alias of country.aliases) {
        index.set(this.normalize(alias), country.code);
      }
    }

    return index;
  }

  private serializeCountry(country: CountryDefinition): ResolvedCountry {
    return {
      code: country.code,
      nameEn: country.nameEn,
      nameVi: country.nameVi,
    };
  }

  private normalize(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\u0111/g, 'd')
      .replace(/\u0110/g, 'D')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
