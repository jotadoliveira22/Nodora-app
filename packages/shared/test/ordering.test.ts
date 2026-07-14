import { describe, expect, it } from 'vitest';
import { keyBetween, keysBetween, rebalancedKeys, needsRebalance } from '../src/ordering';

describe('keyBetween', () => {
  it('genera clave inicial', () => {
    const k = keyBetween(null, null);
    expect(k.length).toBeGreaterThan(0);
  });

  it('inserta después manteniendo orden', () => {
    let prev = keyBetween(null, null);
    for (let i = 0; i < 500; i++) {
      const next = keyBetween(prev, null);
      expect(next > prev).toBe(true);
      prev = next;
    }
  });

  it('inserta antes manteniendo orden', () => {
    let next = keyBetween(null, null);
    for (let i = 0; i < 500; i++) {
      const prev = keyBetween(null, next);
      expect(prev < next).toBe(true);
      next = prev;
    }
  });

  it('inserta en medio repetidamente (peor caso de crecimiento)', () => {
    let a = keyBetween(null, null);
    let b = keyBetween(a, null);
    for (let i = 0; i < 200; i++) {
      const m = keyBetween(a, b);
      expect(m > a).toBe(true);
      expect(m < b).toBe(true);
      if (i % 2 === 0) a = m;
      else b = m;
    }
  });

  it('rechaza rangos invertidos', () => {
    expect(() => keyBetween('Z', 'A')).toThrow();
    expect(() => keyBetween('A', 'A')).toThrow();
  });

  it('nunca produce claves terminadas en 0', () => {
    let prev = keyBetween(null, null);
    for (let i = 0; i < 300; i++) {
      const next = keyBetween(null, prev);
      expect(next.endsWith('0')).toBe(false);
      prev = next;
    }
  });

  it('simulación aleatoria de 2000 inserciones mantiene el orden total', () => {
    const keys = [keyBetween(null, null)];
    let seed = 42;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < 2000; i++) {
      const idx = Math.floor(rnd() * (keys.length + 1));
      const a = idx > 0 ? keys[idx - 1]! : null;
      const b = idx < keys.length ? keys[idx]! : null;
      keys.splice(idx, 0, keyBetween(a, b));
    }
    const sorted = [...keys].sort();
    expect(keys).toEqual(sorted);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('keysBetween', () => {
  it('genera n claves ordenadas dentro del rango', () => {
    const ks = keysBetween('A', 'z', 50);
    expect(ks).toHaveLength(50);
    for (let i = 0; i < ks.length; i++) {
      expect(ks[i]! > (i === 0 ? 'A' : ks[i - 1]!)).toBe(true);
      expect(ks[i]! < 'z').toBe(true);
    }
  });
});

describe('rebalancedKeys', () => {
  it('genera claves cortas, ordenadas y únicas', () => {
    const ks = rebalancedKeys(1000);
    expect(ks).toHaveLength(1000);
    const sorted = [...ks].sort();
    expect(ks).toEqual(sorted);
    expect(new Set(ks).size).toBe(1000);
    expect(Math.max(...ks.map((k) => k.length))).toBeLessThanOrEqual(3);
  });
});

describe('needsRebalance', () => {
  it('detecta claves largas', () => {
    expect(needsRebalance('AB')).toBe(false);
    expect(needsRebalance('V'.repeat(65))).toBe(true);
  });
});
