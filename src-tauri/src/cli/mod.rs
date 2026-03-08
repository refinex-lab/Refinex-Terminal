pub mod detector;

pub use detector::{
    detect_ai_clis, test_cli, get_shell_profile_path, add_to_shell_profile,
    check_shell_profile, read_claude_settings, write_claude_settings,
    read_claude_instructions, write_claude_instructions,
    list_claude_agents, save_claude_agent, delete_claude_agent,
    list_claude_skills, save_claude_skill, delete_claude_skill,
    list_claude_commands, save_claude_command, delete_claude_command,
    read_copilot_config, write_copilot_config, read_copilot_mcp_config,
    write_copilot_mcp_config, read_copilot_instructions, write_copilot_instructions,
    list_copilot_agents, list_copilot_skills, save_copilot_agent, delete_copilot_agent,
    save_copilot_skill, delete_copilot_skill
};
