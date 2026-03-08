pub mod detector;

pub use detector::{
    detect_ai_clis, test_cli, get_shell_profile_path, add_to_shell_profile,
    check_shell_profile, read_claude_settings, write_claude_settings,
    read_copilot_config, write_copilot_config
};
