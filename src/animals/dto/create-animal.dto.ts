import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsBoolean,
  IsArray,
  IsOptional,
  IsUrl,
  ArrayMaxSize,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { toStringArray } from '../../common/uploads';

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
  @ApiProperty({ example: 'Leão' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Resgatado na rua, dócil e saudável.' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 'Vira-Lata' })
  @IsString()
  @IsNotEmpty()
  breed: string;

  @ApiProperty({ enum: AnimalSex })
  @IsEnum(AnimalSex)
  sex: AnimalSex;

  @ApiProperty({ enum: AnimalSize })
  @IsEnum(AnimalSize)
  size: AnimalSize;

  @ApiProperty({ type: [String], example: ['V10', 'Antirrábica'], description: 'Array JSON ou, em multipart, texto separado por vírgulas' })
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

  @ApiProperty({ example: 'Brincalhão' })
  @IsString()
  @IsNotEmpty()
  temperament: string;

  @ApiProperty({ example: false })
  @IsBoolean()
  @Transform(({ value }) =>
    value === true || value === 'true' || value === 1 || value === '1',
  )
  escapeTendency: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) =>
    value === true || value === 'true' || value === 1 || value === '1',
  )
  isAdopted?: boolean;

  @ApiPropertyOptional({ format: 'uuid', description: 'ID do usuário adotante (opcional)' })
  @IsOptional()
  @IsString()
  adoptedById?: string;

  // ── Fluxo de upload direto (Cloudinary) ──
  @ApiPropertyOptional({ type: [String], format: 'uri', maxItems: 3, description: 'URLs das fotos (upload direto ou links). Use photoUrls OU arquivos em photos, não os dois.' })
  @IsOptional()
  @Transform(toStringArray)
  @IsArray()
  @ArrayMaxSize(3)
  @IsUrl({}, { each: true })
  photoUrls?: string[];
}
