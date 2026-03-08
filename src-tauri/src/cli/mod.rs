pub mod detector;

pub use detector::{
    detect_ai_clis, test_cli, get_shell_profile_path, add_to_shell_profile,
    check_shell_profile, read_claude_settings, write_claude_settings,
    read_copilot_config, write_copilot_config, read_copilot_mcp_config,
    write_copilot_mcp_config, read_copilot_instructions, write_copilot_instructions,
    list_copilot_agents, list_copilot_skills, save_copilot_agent, delete_copilot_agent,
    save_copilot_skill, delete_copilot_skill
};
