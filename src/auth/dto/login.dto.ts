import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'joao@email.com' })
  @IsEmail({}, { message: 'E-mail inválido' }) email: string;

  @ApiProperty({ example: 'Senha@123' })
  @IsString() @IsNotEmpty() password: string;
}
