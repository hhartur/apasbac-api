import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ReviewMonitoringDto {
  @ApiProperty({ description: 'true = Aprovado, false = Rejeitado' })
  @IsBoolean() approved: boolean;

  @ApiPropertyOptional({ description: 'Observações da revisão' })
  @IsOptional() @IsString() notes?: string;
}
