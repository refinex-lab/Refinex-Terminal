use font_kit::source::SystemSource;

#[tauri::command]
pub fn list_fonts() -> Result<Vec<String>, String> {
    let source = SystemSource::new();
    let families = source
        .all_families()
        .map_err(|e| format!("Failed to list fonts: {}", e))?;

    // Filter to only monospace fonts and sort
    let mut monospace_fonts: Vec<String> = families
        .into_iter()
        .filter(|family| {
            // Try to load the font and check if it's monospace
            if let Ok(handle) = source.select_best_match(
                &[font_kit::family_name::FamilyName::Title(family.clone())],
                &Default::default(),
            ) {
                if let Ok(font) = handle.load() {
                    // Check if font is monospace by comparing glyph widths
                    return font.is_monospace();
                }
            }
            false
        })
        .collect();

    monospace_fonts.sort();
    Ok(monospace_fonts)
}
