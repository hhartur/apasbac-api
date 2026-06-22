import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsBoolean,
  IsArray,
  IsOptional,
  IsUrl,
} from 'class-validator';
import { Transform } from 'class-transformer';

export enum AnimalSex {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
}

export enum AnimalSize {
  SMALL = 'SMALL',
  MEDIUM = 'MEDIUM',
  LARGE = 'LARGE',
  EXTRA_LARGE = 'EXTRA_LARGE',
}

export class CreateAnimalDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  breed: string;

  @IsEnum(AnimalSex)
  sex: AnimalSex;

  @IsEnum(AnimalSize)
  size: AnimalSize;

  @IsArray()
  @IsString({ each: true })
  // Aceita "vac1,vac2" (multipart) ou array (json)
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean)
      : value,
  )
  vaccines: string[];

  @IsString()
  @IsNotEmpty()
  temperament: string;

  @IsBoolean()
  @Transform(({ value }) =>
    value === true || value === 'true' || value === 1 || value === '1',
  )
  escapeTendency: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) =>
    value === true || value === 'true' || value === 1 || value === '1',
  )
  isAdopted?: boolean;

  @IsOptional()
  @IsString()
  adoptedById?: string;

  // ── Fluxo de upload direto (Cloudinary) ──
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  photoUrls?: string[];
}