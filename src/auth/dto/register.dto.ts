import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, MaxLength, Matches, IsNotEmpty } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'João da Silva', description: 'Nome completo do usuário' })
  @IsString() @IsNotEmpty() @MinLength(3) @MaxLength(100)
  fullName: string;

  @ApiProperty({ example: '+55 46 99999-9999', description: 'Número de telefone com DDD' })
  @IsString() @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: '12345678901', description: 'CPF (apenas números, 11 dígitos)' })
  @IsString() @IsNotEmpty() @Matches(/^\d{11}$/, { message: 'CPF deve conter 11 dígitos numéricos' })
  cpf: string;

  @ApiProperty({ example: 'joao@email.com' })
  @IsEmail({}, { message: 'E-mail inválido' })
  email: string;

  @ApiProperty({ example: 'Senha@123', description: 'Mínimo 8 caracteres, 1 maiúscula, 1 número, 1 especial' })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, {
    message: 'Senha deve conter ao menos 1 maiúscula, 1 número e 1 caractere especial',
  })
  password: string;

  @ApiProperty({ example: 'Senha@123', description: 'Confirmação de senha (não é salvo)' })
  @IsString() @IsNotEmpty()
  confirmPassword: string;
}
