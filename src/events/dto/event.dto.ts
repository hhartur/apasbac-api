import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsDate, IsEnum, IsIn, IsInt, IsLatitude, IsLongitude, IsNotEmpty, IsOptional,
  IsString, IsUrl, Matches, Max, MaxLength, Min, MinLength, Validate, ValidatorConstraint, ValidatorConstraintInterface,
} from 'class-validator';

export enum EventStatus { DRAFT = 'DRAFT', PUBLISHED = 'PUBLISHED', CANCELLED = 'CANCELLED', FINISHED = 'FINISHED' }
export const PUBLIC_EVENT_STATUSES = [EventStatus.PUBLISHED, EventStatus.CANCELLED, EventStatus.FINISHED];
export const MAX_GALLERY = 12;

const trim = ({ value }) => (typeof value === 'string' ? value.trim() : value);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

@ValidatorConstraint({ name: 'timezone' })
class IsTimeZone implements ValidatorConstraintInterface {
  validate(value: unknown) {
    try { return typeof value === 'string' && !!new Intl.DateTimeFormat('en', { timeZone: value }); } catch { return false; }
  }
  defaultMessage() { return 'timezone deve ser um fuso IANA válido, ex.: America/Sao_Paulo'; }
}

export class CreateEventDto {
  @ApiProperty({ example: 'Feira de Adoção de Primavera', minLength: 3, maxLength: 150 })
  @Transform(trim) @IsString() @MinLength(3) @MaxLength(150) title: string;

  @ApiPropertyOptional({ example: 'feira-de-adocao-de-primavera', description: 'Gerado a partir do título quando omitido. Somente a-z, 0-9 e hífen.' })
  @IsOptional() @IsString() @MaxLength(90) @Matches(SLUG, { message: 'slug deve conter apenas letras minúsculas, números e hífens' }) slug?: string;

  @ApiPropertyOptional({ example: 'Venha conhecer cães e gatos disponíveis para adoção.', maxLength: 300 })
  @IsOptional() @Transform(trim) @IsString() @MaxLength(300) summary?: string;

  @ApiProperty({ description: 'Texto puro (não HTML). Clientes devem renderizar escapando o conteúdo.', maxLength: 10000 })
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(10000) description: string;

  @ApiProperty({ example: 1, description: 'ID de uma categoria de GET /events/categories' })
  @Type(() => Number) @IsInt() @Min(1) categoryId: number;

  @ApiPropertyOptional({ enum: EventStatus, default: EventStatus.DRAFT })
  @IsOptional() @IsEnum(EventStatus) status?: EventStatus;

  @ApiProperty({ example: '2026-11-21T13:00:00.000Z', description: 'Início (ISO 8601, com fuso). Armazenado em UTC.' })
  @Type(() => Date) @IsDate() startsAt: Date;

  @ApiPropertyOptional({ example: '2026-11-21T19:00:00.000Z', description: 'Encerramento; deve ser igual ou posterior a startsAt.' })
  @IsOptional() @Type(() => Date) @IsDate() endsAt?: Date;

  @ApiPropertyOptional({ example: 'America/Sao_Paulo', default: 'America/Sao_Paulo', description: 'Fuso IANA para exibição' })
  @IsOptional() @Validate(IsTimeZone) timezone?: string;

  @ApiPropertyOptional({ example: 'Praça da Matriz', maxLength: 150 })
  @IsOptional() @Transform(trim) @IsString() @MaxLength(150) locationName?: string;

  @ApiPropertyOptional({ example: 'Av. Central, 100', maxLength: 200 })
  @IsOptional() @Transform(trim) @IsString() @MaxLength(200) address?: string;

  @ApiPropertyOptional({ example: 'Assis Chateaubriand', maxLength: 100 })
  @IsOptional() @Transform(trim) @IsString() @MaxLength(100) city?: string;

  @ApiPropertyOptional({ example: 'PR', description: 'UF com 2 letras maiúsculas' })
  @IsOptional() @Matches(/^[A-Z]{2}$/, { message: 'state deve ser a UF com 2 letras maiúsculas' }) state?: string;

  @ApiPropertyOptional({ example: '85935-000' })
  @IsOptional() @Matches(/^\d{5}-?\d{3}$/, { message: 'postalCode deve ser um CEP válido' }) postalCode?: string;

  @ApiPropertyOptional({ example: -24.4167, minimum: -90, maximum: 90 })
  @IsOptional() @Type(() => Number) @IsLatitude() latitude?: number;

  @ApiPropertyOptional({ example: -53.5214, minimum: -180, maximum: 180 })
  @IsOptional() @Type(() => Number) @IsLongitude() longitude?: number;

  @ApiPropertyOptional({ description: 'Motivo exibido publicamente quando status = CANCELLED', maxLength: 500 })
  @IsOptional() @Transform(trim) @IsString() @MaxLength(500) cancellationReason?: string;

  @ApiPropertyOptional({ format: 'uri', description: 'URL de upload direto (pasta events/covers). Alternativa a POST /events/:id/image.' })
  @IsOptional() @IsUrl({ protocols: ['https'], require_protocol: true }) coverImageUrl?: string;

  @ApiPropertyOptional({ type: [String], format: 'uri', maxItems: MAX_GALLERY, description: 'URLs de upload direto (pasta events/gallery)' })
  @IsOptional() @IsArray() @ArrayMaxSize(MAX_GALLERY) @IsUrl({ protocols: ['https'], require_protocol: true }, { each: true }) galleryUrls?: string[];
}

export class UpdateEventDto extends PartialType(CreateEventDto) {}

export class EventQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;

  @ApiPropertyOptional({ default: 12, minimum: 1, maximum: 50 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;

  @ApiPropertyOptional({ example: 'adocao', description: 'Slug da categoria' })
  @IsOptional() @IsString() @MaxLength(90) category?: string;

  @ApiPropertyOptional({ enum: ['upcoming', 'past'], description: 'upcoming: ainda não encerrados; past: já encerrados' })
  @IsOptional() @IsIn(['upcoming', 'past']) when?: 'upcoming' | 'past';

  @ApiPropertyOptional({ description: 'Eventos que começam a partir desta data (ISO 8601)', example: '2026-11-01T00:00:00-03:00' })
  @IsOptional() @Type(() => Date) @IsDate() from?: Date;

  @ApiPropertyOptional({ description: 'Eventos que começam até esta data (ISO 8601)', example: '2026-12-31T23:59:59-03:00' })
  @IsOptional() @Type(() => Date) @IsDate() to?: Date;

  @ApiPropertyOptional({ example: 'Assis Chateaubriand' })
  @IsOptional() @IsString() @MaxLength(100) city?: string;

  @ApiPropertyOptional({ description: 'Busca em título e resumo', maxLength: 100 })
  @IsOptional() @IsString() @MaxLength(100) q?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc', description: 'Ordenação por startsAt' })
  @IsOptional() @IsIn(['asc', 'desc']) order?: 'asc' | 'desc';
}

export class PublicEventQueryDto extends EventQueryDto {
  @ApiPropertyOptional({ enum: PUBLIC_EVENT_STATUSES, description: 'Rascunhos (DRAFT) nunca são públicos' })
  @IsOptional() @IsIn(PUBLIC_EVENT_STATUSES) status?: EventStatus;
}

export class AdminEventQueryDto extends EventQueryDto {
  @ApiPropertyOptional({ enum: EventStatus })
  @IsOptional() @IsEnum(EventStatus) status?: EventStatus;
}

export class CreateEventCategoryDto {
  @ApiProperty({ example: 'Adoção', maxLength: 60 })
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(60) name: string;

  @ApiPropertyOptional({ example: 'adocao', description: 'Gerado a partir do nome quando omitido' })
  @IsOptional() @IsString() @MaxLength(60) @Matches(SLUG, { message: 'slug deve conter apenas letras minúsculas, números e hífens' }) slug?: string;

  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional() @Transform(trim) @IsString() @MaxLength(300) description?: string;
}

export class UpdateEventCategoryDto extends PartialType(CreateEventCategoryDto) {}

export class RemoveGalleryImageDto {
  @ApiProperty({ format: 'uri', description: 'URL exata presente em galleryUrls' })
  @IsUrl({ protocols: ['https'], require_protocol: true }) url: string;
}
