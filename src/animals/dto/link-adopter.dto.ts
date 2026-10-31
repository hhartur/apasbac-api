import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class LinkAdopterDto {
  @ApiProperty({ format: 'uuid', description: 'ID do usuário adotante' })
  @IsUUID() userId: string;
}
