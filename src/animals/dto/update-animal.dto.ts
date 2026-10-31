import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsBoolean, IsOptional, IsArray, IsUUID, IsUrl, ArrayMaxSize } from 'class-validator';
import { toStringArray } from '../../common/uploads';
import { Transform } from 'class-transformer';
import { AnimalSex, AnimalSize } from '../../common/enums';

export class UpdateAnimalDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() breed?: string;
  @ApiPropertyOptional({ enum: AnimalSex }) @IsOptional() @IsEnum(AnimalSex) sex?: AnimalSex;
  @ApiPropertyOptional({ enum: AnimalSize }) @IsOptional() @IsEnum(AnimalSize) size?: AnimalSize;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsString({ each: true })
  @Transform(({ value }) => (typeof value === 'string' ? JSON.parse(value) : value))
  vaccines?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() temperament?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean() escapeTendency?: boolean;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean() isAdopted?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsUUID() adoptedById?: string;
  @ApiPropertyOptional({ type: [String], format: 'uri', maxItems: 3,
    description: 'Substitui todas as fotos por estas URLs. Use photoUrls OU arquivos em photos, não os dois.' })
  @IsOptional() @Transform(toStringArray) @IsArray() @ArrayMaxSize(3) @IsUrl({}, { each: true }) photoUrls?: string[];
}
