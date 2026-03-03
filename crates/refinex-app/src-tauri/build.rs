// SPDX-License-Identifier: MIT
// Copyright (c) 2026 refinex-lab

//! Tauri build script — invokes `tauri-build` to generate the Tauri context
//! (capabilities, icons, asset embedding) at compile time.

fn main() {
    tauri_build::build();
}
