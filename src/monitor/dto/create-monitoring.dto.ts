import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsUUID, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateMonitoringDto {
  @ApiProperty({ description: 'ID numérico do animal' })
  @Transform(({ value }) => parseInt(value)) @IsInt() animalId: number;

  @ApiProperty({ description: 'ID (UUID) do tutor responsável pelo animal' })
  @IsUUID() tutorId: string;

  @ApiPropertyOptional({ description: 'Observações adicionais' })
  @IsOptional() @IsString() notes?: string;
}