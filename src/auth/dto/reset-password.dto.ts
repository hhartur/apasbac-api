import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, Matches } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token recebido por e-mail' })
  @IsString() token: string;

  @ApiProperty({ example: 'NovaSenha@123' })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, { message: 'Senha fraca' })
  password: string;

  @ApiProperty({ example: 'NovaSenha@123' })
  @IsString() confirmPassword: string;
}
