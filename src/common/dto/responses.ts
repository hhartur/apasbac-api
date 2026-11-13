import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AnimalSex, AnimalSize, MonitoringStatus, Role } from '../enums';

// Response models used only for OpenAPI documentation. They mirror what the services actually return.

export class MessageResponse {
  @ApiProperty({ example: 'Operação realizada com sucesso' }) message: string;
}

export class ErrorResponse {
  @ApiProperty({ example: false }) success: boolean;
  @ApiProperty({ example: 400 }) statusCode: number;
  @ApiProperty({ example: 'Bad Request' }) error: string;
  @ApiProperty({ oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }], example: ['email must be an email'] })
  message: string | string[];
  @ApiProperty({ format: 'date-time' }) timestamp: string;
  @ApiProperty({ example: '/api/v1/auth/login' }) path: string;
  @ApiPropertyOptional({ example: '2f1c7a9e-6a43-4f4e-9d0a-1b2c3d4e5f60', description: 'Mesmo valor do header X-Request-Id' })
  requestId?: string;
}

export class UserResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'João da Silva' }) fullName: string;
  @ApiProperty({ example: '+55 44 99999-9999' }) phone: string;
  @ApiProperty({ example: '12345678901' }) cpf: string;
  @ApiProperty({ example: 'joao@email.com' }) email: string;
  @ApiProperty({ enum: Role, example: Role.USER }) role: Role;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
  @ApiProperty({ format: 'date-time' }) updatedAt: string;
}

export class TokenPairResponse {
  @ApiProperty({ description: 'JWT de acesso (padrão 15 min). Envie em Authorization: Bearer.' }) accessToken: string;
  @ApiProperty({ description: 'JWT de renovação (padrão 7 dias). Uso único: é rotacionado a cada /auth/refresh.' }) refreshToken: string;
}

export class AuthSessionResponse extends TokenPairResponse {
  @ApiProperty({ type: UserResponse }) user: UserResponse;
}

export class AdopterSummary {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() fullName: string;
  @ApiPropertyOptional() phone?: string;
  @ApiPropertyOptional() email?: string;
}

export class AnimalResponse {
  @ApiProperty({ example: 11 }) id: number;
  @ApiPropertyOptional({ format: 'uuid', description: 'Identificador do QR Code. Omitido em listagens para quem não é ADMIN/STAFF nem tutor do animal.' })
  uuid?: string;
  @ApiProperty({ example: 'Leão' }) name: string;
  @ApiProperty() description: string;
  @ApiProperty({ example: 'Cachorro', description: 'Espécie do animal (ex.: Cachorro, Gato)' }) species: string;
  @ApiProperty({ example: 'Vira-Lata' }) breed: string;
  @ApiProperty({ enum: AnimalSex }) sex: AnimalSex;
  @ApiProperty({ enum: AnimalSize }) size: AnimalSize;
  @ApiProperty({ type: [String], example: ['V10', 'Antirrábica'] }) vaccines: string[];
  @ApiProperty({ example: 'Brincalhão' }) temperament: string;
  @ApiProperty() escapeTendency: boolean;
  @ApiProperty({ type: [String], format: 'uri' }) photos: string[];
  @ApiProperty() isAdopted: boolean;
  @ApiPropertyOptional({ nullable: true, format: 'uri' }) qrCodeUrl?: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
  @ApiProperty({ format: 'date-time' }) updatedAt: string;
  @ApiPropertyOptional({ nullable: true, format: 'uuid', description: 'Visível para ADMIN/STAFF e para o próprio tutor' }) adoptedById?: string | null;
  @ApiPropertyOptional({ nullable: true, type: AdopterSummary }) adoptedBy?: AdopterSummary | null;
}

export class PublicAnimalResponse {
  @ApiProperty() name: string;
  @ApiProperty() description: string;
  @ApiProperty({ example: 'Cachorro', description: 'Espécie do animal (ex.: Cachorro, Gato)' }) species: string;
  @ApiProperty() breed: string;
  @ApiProperty({ enum: AnimalSex }) sex: AnimalSex;
  @ApiProperty({ enum: AnimalSize }) size: AnimalSize;
  @ApiProperty({ type: [String] }) vaccines: string[];
  @ApiProperty() temperament: string;
  @ApiProperty() escapeTendency: boolean;
  @ApiProperty() isAdopted: boolean;
  @ApiProperty({ type: [String], format: 'uri' }) photos: string[];
}

export class ApasbacContact {
  @ApiProperty({ nullable: true, description: 'Config apasbac_phone (vazio = não exibir)' }) phone: string | null;
  @ApiProperty({ nullable: true, description: 'Config apasbac_email (vazio = não exibir)' }) email: string | null;
}

export class TutorContact {
  @ApiProperty() name: string;
  @ApiProperty() phone: string;
  @ApiProperty() email: string;
}

export class QrAnimalResponse extends PublicAnimalResponse {
  @ApiProperty() id: number;
  @ApiProperty({ type: ApasbacContact }) apasbac: ApasbacContact;
  @ApiProperty({ type: TutorContact, nullable: true, description: 'Somente quando o animal está adotado' }) tutor: TutorContact | null;
}

export class QrCodeResponse {
  @ApiProperty({ format: 'uri' }) qrCodeUrl: string;
}

export class MonitoringResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: MonitoringStatus }) status: MonitoringStatus;
  @ApiPropertyOptional({ nullable: true, format: 'uri', description: 'Apagado após a revisão' }) videoUrl: string | null;
  @ApiProperty({ type: [String], description: 'Apagadas após a revisão' }) imageUrls: string[];
  @ApiPropertyOptional({ nullable: true }) notes: string | null;
  @ApiProperty({ format: 'date-time' }) dueDate: string;
  @ApiPropertyOptional({ nullable: true, format: 'date-time' }) submittedAt: string | null;
  @ApiPropertyOptional({ nullable: true, format: 'date-time' }) reviewedAt: string | null;
  @ApiProperty({ format: 'uuid' }) userId: string;
  @ApiProperty() animalId: number;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
  @ApiProperty({ format: 'date-time' }) updatedAt: string;
}

export class ConfigResponse {
  @ApiProperty() id: number;
  @ApiProperty({ example: 'monitoring_period_value' }) key: string;
  @ApiProperty({ example: '6' }) value: string;
  @ApiPropertyOptional({ nullable: true }) description: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
  @ApiProperty({ format: 'date-time' }) updatedAt: string;
}

export class SignedUploadResponse {
  @ApiProperty() signature: string;
  @ApiProperty() timestamp: number;
  @ApiProperty() api_key: string;
  @ApiProperty() cloud_name: string;
  @ApiProperty({ enum: ['image', 'video', 'raw', 'auto'] }) resource_type: string;
  @ApiProperty({ example: 'https://api.cloudinary.com/v1_1/<cloud>/image/upload' }) upload_url: string;
  @ApiProperty({ type: 'object', additionalProperties: true }) params: Record<string, unknown>;
  @ApiProperty({ type: 'object', additionalProperties: true, description: 'Envie todos estes campos + file no multipart para upload_url' })
  form_fields: Record<string, unknown>;
}

export class AuditLogResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiPropertyOptional({ nullable: true, format: 'uuid' }) actorId: string | null;
  @ApiPropertyOptional({ nullable: true, enum: Role }) actorRole: string | null;
  @ApiProperty({ example: 'ANIMAL_UPDATE' }) action: string;
  @ApiProperty({ example: 'animal' }) resource: string;
  @ApiPropertyOptional({ nullable: true, example: '11' }) resourceId: string | null;
  @ApiProperty({ enum: ['SUCCESS', 'FAILURE'] }) outcome: string;
  @ApiPropertyOptional({ nullable: true }) description: string | null;
  @ApiPropertyOptional({ nullable: true, type: 'object', additionalProperties: true,
    description: 'Somente nomes de campos e dados técnicos; valores sensíveis são removidos' }) metadata: Record<string, unknown> | null;
  @ApiPropertyOptional({ nullable: true }) ipAddress: string | null;
  @ApiPropertyOptional({ nullable: true }) userAgent: string | null;
  @ApiPropertyOptional({ nullable: true }) requestId: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt: string;
}
