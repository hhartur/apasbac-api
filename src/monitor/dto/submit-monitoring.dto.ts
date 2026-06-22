import { IsString, IsUrl, IsArray, ArrayMinSize, ArrayMaxSize } from 'class-validator';

export class SubmitMonitoringDto {
  @IsString()
  @IsUrl()
  videoUrl: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsUrl({}, { each: true })
  imageUrls: string[];
}