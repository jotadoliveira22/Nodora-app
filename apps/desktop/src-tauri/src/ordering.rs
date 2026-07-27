//! Claves de orden fraccionarias (ADR-006).
//! Espejo exacto del algoritmo de `packages/shared/src/ordering.ts`; los
//! tests replican los casos TS para mantener ambas implementaciones alineadas.

use crate::error::{NodoraError, Result};

pub const ALPHABET: &[u8] = b"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE: usize = 62;

fn digit_value(c: u8) -> Result<usize> {
    ALPHABET
        .iter()
        .position(|&a| a == c)
        .ok_or_else(|| NodoraError::InvalidInput("clave de orden inválida".into()))
}

fn validate(key: &str) -> Result<()> {
    if key.is_empty() {
        return Err(NodoraError::InvalidInput("clave de orden vacía".into()));
    }
    for &c in key.as_bytes() {
        digit_value(c)?;
    }
    if key.as_bytes().last() == Some(&ALPHABET[0]) {
        return Err(NodoraError::InvalidInput(
            "clave de orden termina en 0".into(),
        ));
    }
    Ok(())
}

/// Punto medio estricto entre `a` ('' = límite inferior) y `b` (None = ∞).
fn mid(a: &str, b: Option<&str>) -> Result<String> {
    if let Some(b) = b {
        // Retira el prefijo común (a rellena conceptualmente con '0').
        let ab = a.as_bytes();
        let bb = b.as_bytes();
        let mut n = 0;
        while n < bb.len() && ab.get(n).copied().unwrap_or(ALPHABET[0]) == bb[n] {
            n += 1;
        }
        if n > 0 {
            let rest = mid(a.get(n..).unwrap_or(""), Some(&b[n..]))?;
            return Ok(format!("{}{}", &b[..n], rest));
        }
    }
    let digit_a = if a.is_empty() {
        0
    } else {
        digit_value(a.as_bytes()[0])?
    };
    let digit_b = match b {
        Some(b) => digit_value(b.as_bytes()[0])?,
        None => BASE,
    };
    if digit_b - digit_a > 1 {
        let m = digit_a + (digit_b - digit_a) / 2;
        return Ok((ALPHABET[m] as char).to_string());
    }
    // Dígitos consecutivos.
    if let Some(b) = b {
        if b.len() > 1 {
            return Ok((b.as_bytes()[0] as char).to_string());
        }
    }
    // b es None o de un solo dígito: fija el dígito de a y recurre sin cota.
    let rest = mid(if a.is_empty() { "" } else { &a[1..] }, None)?;
    Ok(format!("{}{}", ALPHABET[digit_a] as char, rest))
}

/// Clave estrictamente entre `a` y `b` (None = extremo abierto).
pub fn key_between(a: Option<&str>, b: Option<&str>) -> Result<String> {
    if let Some(a) = a {
        validate(a)?;
    }
    if let Some(b) = b {
        validate(b)?;
    }
    if let (Some(a), Some(b)) = (a, b) {
        if a >= b {
            return Err(NodoraError::InvalidInput(format!(
                "rango de orden inválido: {a} >= {b}"
            )));
        }
    }
    mid(a.unwrap_or(""), b)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn initial_key() {
        assert_eq!(key_between(None, None).unwrap(), "V");
    }

    #[test]
    fn appends_keep_order() {
        let mut prev = key_between(None, None).unwrap();
        for _ in 0..500 {
            let next = key_between(Some(&prev), None).unwrap();
            assert!(next > prev, "{next} <= {prev}");
            prev = next;
        }
    }

    #[test]
    fn prepends_keep_order() {
        let mut next = key_between(None, None).unwrap();
        for _ in 0..500 {
            let prev = key_between(None, Some(&next)).unwrap();
            assert!(prev < next, "{prev} >= {next}");
            assert!(!prev.ends_with('0'));
            next = prev;
        }
    }

    #[test]
    fn midpoints_keep_order() {
        let mut a = key_between(None, None).unwrap();
        let mut b = key_between(Some(&a), None).unwrap();
        for i in 0..200 {
            let m = key_between(Some(&a), Some(&b)).unwrap();
            assert!(m > a && m < b, "{a} < {m} < {b} falla");
            if i % 2 == 0 {
                a = m;
            } else {
                b = m;
            }
        }
    }

    #[test]
    fn rejects_bad_ranges() {
        assert!(key_between(Some("Z"), Some("A")).is_err());
        assert!(key_between(Some("A"), Some("A")).is_err());
        assert!(key_between(Some(""), None).is_err());
    }

    #[test]
    fn random_insert_simulation() {
        let mut keys = vec![key_between(None, None).unwrap()];
        let mut seed: u64 = 42;
        let mut rnd = move || {
            seed = (seed.wrapping_mul(1103515245).wrapping_add(12345)) % 2147483648;
            seed as f64 / 2147483648.0
        };
        for _ in 0..2000 {
            let idx = (rnd() * (keys.len() + 1) as f64) as usize;
            let a = if idx > 0 {
                Some(keys[idx - 1].clone())
            } else {
                None
            };
            let b = keys.get(idx).cloned();
            let k = key_between(a.as_deref(), b.as_deref()).unwrap();
            keys.insert(idx, k);
        }
        let mut sorted = keys.clone();
        sorted.sort();
        assert_eq!(keys, sorted);
        let unique: std::collections::HashSet<_> = keys.iter().collect();
        assert_eq!(unique.len(), keys.len());
    }
}
