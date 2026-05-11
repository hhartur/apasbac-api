import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class ParseFilePipe implements PipeTransform {
  transform(files: Express.Multer.File | Express.Multer.File[]) {
    if (!files) throw new BadRequestException('Arquivo obrigatório');
    return files;
  }
}
