import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token JWT' })
  @IsString() refreshToken: string;
}

export class LogoutDto {
  @ApiPropertyOptional({ description: 'Refresh token da sessão a encerrar. Se omitido, todas as sessões do usuário são encerradas.' })
  @IsOptional() @IsString() refreshToken?: string;
}
