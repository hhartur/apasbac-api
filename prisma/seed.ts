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

const EVENT_CATEGORIES: [string, string][] = [
  ['Adoção', 'adocao'], ['Saúde animal', 'saude-animal'], ['Educação', 'educacao'], ['Arrecadação', 'arrecadacao'],
  ['Voluntariado', 'voluntariado'], ['Campanha', 'campanha'], ['Evento beneficente', 'evento-beneficente'], ['Outros', 'outros'],
];

async function main() {
  // ── Admin inicial ────────────────────────────────────────────────────────
  // Em produção não existe senha padrão: defina SEED_ADMIN_PASSWORD no primeiro deploy.
  // Admins já existentes nunca são alterados (update: {}).
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@apasbac.org.br';
  const password = process.env.SEED_ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'Admin@123');
  if (password) {
    const admin = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        fullName: 'Administrador APASBAC',
        email,
        cpf: '00000000000',
        phone: '+55 44 99999-9999',
        password: await bcrypt.hash(password, 12),
        role: Role.ADMIN,
      },
    });
    console.log('✅ Admin garantido:', admin.email);
  } else {
    console.log('⚠️  SEED_ADMIN_PASSWORD não definido em produção: admin inicial não criado.');
  }

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

  // ── Categorias iniciais de eventos (administráveis depois via API) ─────────
  for (const [name, slug] of EVENT_CATEGORIES) {
    await prisma.eventCategory.upsert({ where: { slug }, update: {}, create: { name, slug } });
  }

  console.log('✅ Configurações e categorias de eventos padrão criadas');
  console.log('\n⚠️  Lembre-se de configurar apasbac_phone e apasbac_email via:');
  console.log('   PATCH /api/v1/configs/apasbac_phone');
  console.log('   PATCH /api/v1/configs/apasbac_email\n');
}

main().catch(console.error).finally(() => prisma.$disconnect());
