import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function upsertConfig(key: string, value: string, description: string) {
  return prisma.appConfig.upsert({
    where: { key },
    update: {},
    create: { key, value, description },
  });
}

async function main() {
  // ── Admin padrão ─────────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('Admin@123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@apasbac.org.br' },
    update: {},
    create: {
      fullName: 'Administrador APASBAC',
      email: 'admin@apasbac.org.br',
      cpf: '00000000000',
      phone: '+55 46 99999-9999',
      password: adminPassword,
      role: Role.ADMIN,
    },
  });
  console.log('✅ Admin criado:', admin.email);

  // ── Configurações de monitoramento ────────────────────────────────────────
  await upsertConfig(
    'monitoring_period_value',
    '6',
    'Valor numérico do período entre envios de monitoramento',
  );
  await upsertConfig(
    'monitoring_period_unit',
    'MONTHS',
    'Unidade do período de monitoramento: DAYS | WEEKS | MONTHS | YEARS',
  );

  // ── Contato APASBAC (configurável pelo Admin — não exposto no .env) ───────
  await upsertConfig(
    'apasbac_phone',
    '',
    'Telefone/WhatsApp de contato da APASBAC (exibido no QR Code do animal)',
  );
  await upsertConfig(
    'apasbac_email',
    '',
    'E-mail de contato da APASBAC (exibido no QR Code do animal)',
  );

  console.log('✅ Configurações padrão criadas');
  console.log('\n⚠️  Lembre-se de configurar apasbac_phone e apasbac_email via:');
  console.log('   PATCH /api/v1/configs/apasbac_phone');
  console.log('   PATCH /api/v1/configs/apasbac_email\n');
}

main().catch(console.error).finally(() => prisma.$disconnect());
