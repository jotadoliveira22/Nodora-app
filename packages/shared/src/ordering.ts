/**
 * Claves de orden fraccionarias (ADR-006).
 *
 * Cadenas base-62 comparables lexicográficamente. `keyBetween(a, b)` devuelve
 * una clave estrictamente entre `a` y `b` sin renumerar al resto de la
 * colección. Técnica documentada públicamente (Figma, "Realtime editing of
 * ordered sequences", 2017); implementación propia basada en el algoritmo de
 * punto medio sobre dígitos.
 *
 * Invariantes:
 *  - keyBetween(null, null) devuelve la clave central ("V").
 *  - a < keyBetween(a, b) < b (comparación lexicográfica, igual en JS, Rust
 *    y SQLite sobre TEXT ASCII).
 *  - Ninguna clave generada termina en el primer dígito ("0"), de modo que
 *    siempre existe una clave anterior a cualquier clave.
 */

export const ORDER_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE = ORDER_ALPHABET.length;
const FIRST = ORDER_ALPHABET[0]!;
const MID = ORDER_ALPHABET[Math.floor(BASE / 2)]!;

/** Longitud a partir de la cual el llamador debería rebalancear (perezoso). */
export const REBALANCE_THRESHOLD = 64;

function digitValue(ch: string): number {
  const v = ORDER_ALPHABET.indexOf(ch);
  if (v < 0) throw new Error(`Carácter inválido en clave de orden: ${JSON.stringify(ch)}`);
  return v;
}

function validate(key: string): void {
  if (key.length === 0) throw new Error('Clave de orden vacía');
  for (const ch of key) digitValue(ch);
  if (key.endsWith(FIRST)) {
    throw new Error(`Clave de orden no puede terminar en "${FIRST}": ${key}`);
  }
}

/**
 * Punto medio estricto entre `a` y `b` sobre dígitos base-62.
 * `a` puede ser '' (límite inferior abierto); `b` puede ser null (infinito).
 * Precondición: a < b cuando b !== null.
 */
function mid(a: string, b: string | null): string {
  if (b !== null) {
    // Retira el prefijo común (tratando a como si estuviera rellena con '0').
    let n = 0;
    while (n < b.length && (a[n] ?? FIRST) === b[n]) n += 1;
    if (n > 0) return b.slice(0, n) + mid(a.slice(n), b.slice(n));
  }
  const digitA = a !== '' ? digitValue(a[0]!) : 0;
  const digitB = b !== null ? digitValue(b[0]!) : BASE;
  if (digitB - digitA > 1) {
    // Hay hueco: un solo dígito estrictamente entre ambos.
    return ORDER_ALPHABET[digitA + Math.floor((digitB - digitA) / 2)]!;
  }
  // Dígitos consecutivos.
  if (b !== null && b.length > 1) {
    // b[0] es estrictamente mayor que a y estrictamente menor que b.
    return b.slice(0, 1);
  }
  // b es null o de un solo dígito: fija el dígito de a y recurre sin cota
  // superior sobre el resto de a.
  return ORDER_ALPHABET[digitA]! + mid(a.slice(1), null);
}

/**
 * Devuelve una clave estrictamente entre `a` y `b`.
 * `a === null` significa "antes de todo"; `b === null`, "después de todo".
 */
export function keyBetween(a: string | null, b: string | null): string {
  if (a !== null) validate(a);
  if (b !== null) validate(b);
  if (a !== null && b !== null && a >= b) {
    throw new Error(`Rango de orden inválido: ${a} >= ${b}`);
  }
  return mid(a ?? '', b);
}

/** n claves crecientes entre a y b (para inserciones múltiples). */
export function keysBetween(a: string | null, b: string | null, n: number): string[] {
  if (n <= 0) return [];
  const out: string[] = [];
  let lo = a;
  for (let i = 0; i < n; i += 1) {
    const k = keyBetween(lo, b);
    out.push(k);
    lo = k;
  }
  return out;
}

/** Claves equiespaciadas y cortas para rebalancear una colección completa. */
export function rebalancedKeys(count: number): string[] {
  if (count <= 0) return [];
  // step >= 2 garantiza que el ajuste de sufijo "0" -> "1" nunca alcanza la
  // clave siguiente.
  let digits = 1;
  while (Math.floor(Math.pow(BASE, digits) / (count + 1)) < 2) {
    digits += 1;
  }
  const total = Math.pow(BASE, digits);
  const step = Math.floor(total / (count + 1));
  const keys: string[] = [];
  for (let i = 1; i <= count; i += 1) {
    let n = i * step;
    let key = '';
    for (let d = 0; d < digits; d += 1) {
      key = ORDER_ALPHABET[n % BASE]! + key;
      n = Math.floor(n / BASE);
    }
    if (key.endsWith(FIRST)) key = key.slice(0, -1) + ORDER_ALPHABET[1]!;
    keys.push(key);
  }
  return keys;
}

export function needsRebalance(key: string): boolean {
  return key.length > REBALANCE_THRESHOLD;
}
