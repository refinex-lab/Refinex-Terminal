// SPDX-License-Identifier: MIT
// Copyright (c) 2026 refinex-lab

//! `refinex-workspace` — File tree, file watcher, and git status integration.

/// Placeholder function until workspace management is implemented.
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
