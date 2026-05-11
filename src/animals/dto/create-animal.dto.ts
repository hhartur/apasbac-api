import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsBoolean, IsOptional, IsArray, IsUUID, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { AnimalSex, AnimalSize } from '../../common/enums';

export class CreateAnimalDto {
  @ApiProperty({ example: 'Rex', description: 'Nome do animal' })
  @IsString() @MinLength(1) name: string;

  @ApiProperty({ example: 'Animal dócil e brincalhão, adora crianças.' })
  @IsString() @MinLength(10) description: string;

  @ApiProperty({ example: 'Labrador Retriever' })
  @IsString() breed: string;

  @ApiProperty({ enum: AnimalSex, example: AnimalSex.MALE })
  @IsEnum(AnimalSex) sex: AnimalSex;

  @ApiProperty({ enum: AnimalSize, example: AnimalSize.LARGE })
  @IsEnum(AnimalSize) size: AnimalSize;

  @ApiProperty({ example: ['V8', 'Antirrábica', 'Giárdia'], type: [String], description: 'Lista de vacinas aplicadas' })
  @IsArray() @IsString({ each: true })
  @Transform(({ value }) => (typeof value === 'string' ? JSON.parse(value) : value))
  vaccines: string[];

  @ApiProperty({ example: 'Calmo, carinhoso, brincalhão' })
  @IsString() temperament: string;

  @ApiProperty({ example: false, description: 'Animal tem tendência de fuga?' })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean() escapeTendency: boolean;

  @ApiPropertyOptional({ example: false, description: 'Animal já foi adotado?' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean() isAdopted?: boolean;

  @ApiPropertyOptional({ description: 'ID UUID do usuário que adotou (se já adotado)' })
  @IsOptional() @IsUUID() adoptedById?: string;
}
