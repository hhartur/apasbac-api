import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EventCategoryResponse {
  @ApiProperty({ example: 1 }) id: number;
  @ApiProperty({ example: 'Adoção' }) name: string;
  @ApiProperty({ example: 'adocao' }) slug: string;
  @ApiPropertyOptional({ nullable: true }) description?: string | null;
}

export class EventResponse {
  @ApiProperty({ example: 3 }) id: number;
  @ApiProperty({ format: 'uuid' }) uuid: string;
  @ApiProperty() title: string;
  @ApiProperty() slug: string;
  @ApiPropertyOptional({ nullable: true }) summary: string | null;
  @ApiProperty({ description: 'Texto puro; renderize escapando' }) description: string;
  @ApiPropertyOptional({ nullable: true, format: 'uri' }) coverImageUrl: string | null;
  @ApiProperty({ type: [String] }) galleryUrls: string[];
  @ApiProperty({ enum: ['DRAFT', 'PUBLISHED', 'CANCELLED', 'FINISHED'] }) status: string;
  @ApiProperty({ format: 'date-time' }) startsAt: string;
  @ApiPropertyOptional({ nullable: true, format: 'date-time' }) endsAt: string | null;
  @ApiProperty({ example: 'America/Sao_Paulo' }) timezone: string;
  @ApiPropertyOptional({ nullable: true }) locationName: string | null;
  @ApiPropertyOptional({ nullable: true }) address: string | null;
  @ApiPropertyOptional({ nullable: true }) city: string | null;
  @ApiPropertyOptional({ nullable: true }) state: string | null;
  @ApiPropertyOptional({ nullable: true }) latitude: number | null;
  @ApiPropertyOptional({ nullable: true }) longitude: number | null;
  @ApiPropertyOptional({ nullable: true }) cancellationReason: string | null;
  @ApiPropertyOptional({ nullable: true, format: 'date-time' }) publishedAt: string | null;
  @ApiProperty({ type: EventCategoryResponse }) category: EventCategoryResponse;
}
