import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, MinLength, MaxLength } from 'class-validator';
import { Role } from '../../common/enums';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'João da Silva' })
  @IsOptional() @IsString() @MinLength(3) @MaxLength(100) fullName?: string;

  @ApiPropertyOptional({ example: '+55 46 99999-9999' })
  @IsOptional() @IsString() phone?: string;
}

export class UpdateUserRoleDto {
  @ApiPropertyOptional({ enum: Role, example: Role.STAFF })
  @IsEnum(Role) role: Role;
}
