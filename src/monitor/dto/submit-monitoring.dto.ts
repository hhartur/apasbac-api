import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUrl, IsArray, ArrayMinSize, ArrayMaxSize } from 'class-validator';

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
}
