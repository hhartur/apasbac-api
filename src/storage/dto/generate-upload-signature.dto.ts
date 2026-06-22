import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
} from 'class-validator';

export class GenerateUploadSignatureDto {
  @ApiPropertyOptional({
    description: 'Pasta de destino no Cloudinary (ex.: animals/photos)',
    example: 'animals/photos',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  folder?: string;

  @ApiPropertyOptional({
    description: 'public_id opcional para nomear o arquivo no Cloudinary',
    example: 'animal-123-capa',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  public_id?: string;

  @ApiPropertyOptional({
    description: 'Lista de tags para o upload',
    example: ['animal', 'adocao', 'foto-principal'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Contexto extra no formato chave/valor para indexação no Cloudinary',
    example: { animalId: '123', origem: 'flutter-app' },
  })
  @IsOptional()
  @IsObject()
  context?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Transformações eager (opcional)',
    example: ['c_fill,w_1000,h_1000,q_auto', 'c_thumb,w_300,h_300'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eager?: string[];

  @ApiPropertyOptional({
    description: 'Preset de upload (opcional; útil para regras de segurança/transforms)',
    example: 'animals_signed_preset',
  })
  @IsOptional()
  @IsString()
  upload_preset?: string;

  @ApiPropertyOptional({
    description: 'Forçar overwrite quando o mesmo public_id já existir',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  overwrite?: boolean;

  @ApiPropertyOptional({
    description: 'Tipo de recurso para endpoint de upload',
    example: 'auto',
    default: 'auto',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(image|video|raw|auto)$/i, {
    message: 'resource_type deve ser image, video, raw ou auto',
  })
  resource_type?: 'image' | 'video' | 'raw' | 'auto';
}
