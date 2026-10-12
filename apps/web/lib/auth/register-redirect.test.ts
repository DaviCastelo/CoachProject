import { describe, expect, it } from 'vitest';
import { safeRegisterPath } from './register-redirect';

describe('safeRegisterPath', () => {
  it('aceita o formulário de inscrição, com ou sem idioma', () => {
    expect(safeRegisterPath('/register/summer-camp')).toBe('/register/summer-camp');
    expect(safeRegisterPath('/pt-BR/register/summer-camp')).toBe('/pt-BR/register/summer-camp');
    expect(safeRegisterPath('/es/register/camp')).toBe('/es/register/camp');
  });

  it('recusa endereço externo, outro caminho e query', () => {
    expect(safeRegisterPath('https://evil.test/register/x')).toBeNull();
    expect(safeRegisterPath('//evil.test/register/x')).toBeNull();
    expect(safeRegisterPath('/coach')).toBeNull();
    expect(safeRegisterPath('/register/camp?next=https://evil.test')).toBeNull();
    expect(safeRegisterPath('/pt-BR/family')).toBeNull();
    expect(safeRegisterPath(null)).toBeNull();
  });
});
