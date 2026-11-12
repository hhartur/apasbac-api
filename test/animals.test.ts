import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateAnimalDto } from '../src/animals/dto/create-animal.dto';
import { UpdateAnimalDto } from '../src/animals/dto/update-animal.dto';

// Mirrors the global ValidationPipe (whitelist + forbidNonWhitelisted + implicit conversion).
async function errorsFor(cls: any, payload: any): Promise<string[]> {
  const dto = plainToInstance(cls, payload, { enableImplicitConversion: true });
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  return errors.map((e) => e.property);
}

const base = {
  name: 'Rex', description: 'd', breed: 'SRD', sex: 'MALE', size: 'SMALL',
  vaccines: ['V10'], temperament: 't', escapeTendency: false,
};

test('creating an animal accepts species but does not require it (compat. com clientes antigos)', async () => {
  assert.deepEqual(await errorsFor(CreateAnimalDto, { ...base, species: 'Cachorro' }), []);
  assert.deepEqual(await errorsFor(CreateAnimalDto, base), []); // sem species -> sem 400
});

test('creating an animal still rejects unknown fields', async () => {
  assert.deepEqual(await errorsFor(CreateAnimalDto, { ...base, foo: 'x' }), ['foo']);
});

test('updating an animal accepts species as an optional field', async () => {
  assert.deepEqual(await errorsFor(UpdateAnimalDto, { species: 'Gato' }), []);
  assert.deepEqual(await errorsFor(UpdateAnimalDto, {}), []);
});
