// SPDX-License-Identifier: MIT
// Copyright (c) 2026 refinex-lab

//! `refinex-ui` — Shared UI types and components (Rust side).

/// Placeholder function until shared UI types are implemented.
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
