-- AlterTable
-- Adiciona a espécie do animal (ex.: "Cachorro", "Gato"). Linhas já existentes recebem
-- "Não informada" no backfill; o DEFAULT é removido em seguida para que a coluna continue
-- obrigatória (a API sempre envia species ao criar/editar).
ALTER TABLE "animals" ADD COLUMN "species" TEXT NOT NULL DEFAULT 'Não informada';
ALTER TABLE "animals" ALTER COLUMN "species" DROP DEFAULT;
