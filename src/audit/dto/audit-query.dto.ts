import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { Role } from '../../common/enums';

export class AuditQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 200 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;

  @ApiPropertyOptional({ description: 'ID (UUID) do usuário que executou a ação' })
  @IsOptional() @IsUUID() actorId?: string;

  @ApiPropertyOptional({ enum: Role })
  @IsOptional() @IsEnum(Role) actorRole?: Role;

  @ApiPropertyOptional({ example: 'AUTH_LOGIN_FAILED' })
  @IsOptional() @IsString() @MaxLength(64) action?: string;

  @ApiPropertyOptional({ example: 'animal' })
  @IsOptional() @IsString() @MaxLength(64) resource?: string;

  @ApiPropertyOptional({ example: '42' })
  @IsOptional() @IsString() @MaxLength(64) resourceId?: string;

  @ApiPropertyOptional({ enum: ['SUCCESS', 'FAILURE'] })
  @IsOptional() @IsIn(['SUCCESS', 'FAILURE']) outcome?: string;

  @ApiPropertyOptional({ example: '203.0.113.10' })
  @IsOptional() @IsString() @MaxLength(64) ipAddress?: string;

  @ApiPropertyOptional({ description: 'Valor do header X-Request-Id da requisição auditada' })
  @IsOptional() @IsString() @MaxLength(64) requestId?: string;

  @ApiPropertyOptional({ description: 'Início do período (ISO 8601)', example: '2026-10-01T00:00:00Z' })
  @IsOptional() @Type(() => Date) @IsDate() from?: Date;

  @ApiPropertyOptional({ description: 'Fim do período (ISO 8601)', example: '2026-10-31T23:59:59Z' })
  @IsOptional() @Type(() => Date) @IsDate() to?: Date;
}
