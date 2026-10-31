import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Audited } from '../audit/audit.interceptor';
import { GenerateUploadSignatureDto } from './dto/generate-upload-signature.dto';
import { StorageService } from './storage.service';

@ApiTags('Storage')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('signed-upload')
  @Audited({ action: 'UPLOAD_SIGNATURE_ISSUED', resource: 'storage' })
  @ApiOperation({
    summary: 'Gera assinatura do Cloudinary para upload direto (Signed Upload)',
    description:
      'Endpoint protegido por JWT. Retorna payload necessário para o app (Flutter) enviar o arquivo direto para o Cloudinary sem passar pelo backend. ' +
      'Pastas permitidas: monitoring/images e monitoring/videos (todos os perfis); animals/photos, events/covers e events/gallery (ADMIN/STAFF). ' +
      'Somente ADMIN/STAFF podem usar public_id, overwrite, upload_preset e eager. A assinatura inclui allowed_formats.',
  })
  generateSignedUpload(@Body() dto: GenerateUploadSignatureDto, @CurrentUser() user: any) {
    return this.storageService.generateSignedUploadPayload(dto, user.role);
  }
}
