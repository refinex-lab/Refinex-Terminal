// SPDX-License-Identifier: MIT
// Copyright (c) 2026 refinex-lab

//! `refinex-core` — PTY engine, VT emulation, and rendering primitives.

/// Returns the sum of two numbers.
/// Placeholder until PTY and VT emulation are implemented.
#[must_use]
pub const fn add(left: u64, right: u64) -> u64 {
    left + right
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        let result = add(2, 2);
        assert_eq!(result, 4);
    }
}
