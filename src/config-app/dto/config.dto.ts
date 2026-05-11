import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength } from 'class-validator';

export class CreateConfigDto {
  @ApiProperty({ example: 'monitoring_period_value', description: 'Chave única da configuração' })
  @IsString() @MinLength(1) key: string;

  @ApiProperty({ example: '6', description: 'Valor da configuração' })
  @IsString() value: string;

  @ApiPropertyOptional({ example: 'Período de monitoramento em meses' })
  @IsOptional() @IsString() description?: string;
}

export class UpdateConfigDto {
  @ApiPropertyOptional({ example: '3' })
  @IsOptional() @IsString() value?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() description?: string;
}
