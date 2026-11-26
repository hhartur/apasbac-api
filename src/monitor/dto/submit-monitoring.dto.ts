import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString, IsUrl, IsArray, ArrayMinSize, ArrayMaxSize, IsIn, Matches, IsISO8601, ValidateNested, IsNotEmpty, MaxLength,
} from 'class-validator';

const UPDATE_APP = 'Atualize o aplicativo: as fotos e o vídeo do monitoramento precisam ser gravados pela câmera do app.';

export class CapturedMediaDto {
  @ApiProperty({ format: 'uri', description: 'URL do arquivo enviado ao Cloudinary (deve ser uma das URLs do envio).' })
  @IsString() @IsUrl()
  url: string;

  @ApiProperty({ enum: ['image', 'video'] })
  @IsIn(['image', 'video'])
  kind: 'image' | 'video';

  @ApiProperty({ description: 'MD5 (hex) do arquivo gravado; conferido com o etag do Cloudinary.', example: 'd41d8cd98f00b204e9800998ecf8427e' })
  @Matches(/^[a-f0-9]{32}$/, { message: 'md5 inválido' })
  md5: string;

  @ApiProperty({ format: 'date-time', description: 'Momento da captura pela câmera do app (UTC).' })
  @IsISO8601()
  capturedAt: string;

  @ApiProperty({ description: 'HMAC-SHA256(captureKey, "kind|md5|capturedAt|monitoringId") em hex.' })
  @Matches(/^[a-f0-9]{64}$/, { message: 'assinatura inválida' })
  signature: string;
}

export class SubmitMonitoringDto {
  @ApiProperty({ format: 'uri', example: 'https://res.cloudinary.com/<cloud>/video/upload/v1/monitoring/videos/abc.mp4' })
  @IsString()
  @IsUrl()
  videoUrl: string;

  @ApiProperty({ type: [String], format: 'uri', minItems: 1, maxItems: 10 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsUrl({}, { each: true })
  imageUrls: string[];

  @ApiProperty({ description: 'Token da sessão de captura (POST /monitoring/:id/capture-session).' })
  @IsString({ message: UPDATE_APP }) @IsNotEmpty({ message: UPDATE_APP }) @MaxLength(2048)
  captureToken: string;

  @ApiProperty({ type: [CapturedMediaDto], description: 'Atestado de captura de cada foto e do vídeo.' })
  @IsArray({ message: UPDATE_APP })
  @ArrayMinSize(2, { message: UPDATE_APP })
  @ArrayMaxSize(11)
  @ValidateNested({ each: true })
  @Type(() => CapturedMediaDto)
  media: CapturedMediaDto[];
}
