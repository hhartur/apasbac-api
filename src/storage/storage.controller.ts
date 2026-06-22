import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GenerateUploadSignatureDto } from './dto/generate-upload-signature.dto';
import { StorageService } from './storage.service';

@ApiTags('Storage')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('signed-upload')
  @ApiOperation({
    summary: 'Gera assinatura do Cloudinary para upload direto (Signed Upload)',
    description:
      'Endpoint protegido por JWT. Retorna payload necessário para o app (Flutter) enviar o arquivo direto para o Cloudinary sem passar pelo backend.',
  })
  generateSignedUpload(@Body() dto: GenerateUploadSignatureDto) {
    return this.storageService.generateSignedUploadPayload(dto);
  }
}
