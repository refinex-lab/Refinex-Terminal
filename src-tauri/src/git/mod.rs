use git2::{Repository, Status, StatusOptions, DiffOptions, BranchType};
use serde::{Deserialize, Serialize};
use std::path::Path;
use tauri::command;

/// Git file status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitFileStatus {
    pub path: String,
    pub status: String, // "modified", "added", "deleted", "renamed", "untracked"
    pub staged: bool,
}

/// Git repository status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitStatus {
    pub branch: String,
    pub ahead: usize,
    pub behind: usize,
    pub staged: Vec<GitFileStatus>,
    pub unstaged: Vec<GitFileStatus>,
    pub untracked: Vec<GitFileStatus>,
}

/// Git commit information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitInfo {
    pub hash: String,
    pub message: String,
    pub author: String,
    pub email: String,
    pub timestamp: i64,
}

/// Git branch information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BranchInfo {
    pub name: String,
    pub is_current: bool,
    pub is_remote: bool,
    pub upstream: Option<String>,
}

/// Get Git repository status
#[command]
pub async fn git_status(repo_path: String) -> Result<GitStatus, String> {
    let repo = Repository::open(&repo_path)
        .map_err(|e| format!("Failed to open repository: {}", e))?;

    // Get current branch
    let head = repo.head().map_err(|e| format!("Failed to get HEAD: {}", e))?;
    let branch = head
        .shorthand()
        .unwrap_or("HEAD")
        .to_string();

    // Get ahead/behind counts
    let (ahead, behind) = get_ahead_behind(&repo, &head)?;

    // Get file statuses
    let mut opts = StatusOptions::new();
    opts.include_untracked(true);
    opts.recurse_untracked_dirs(true);

    let statuses = repo
        .statuses(Some(&mut opts))
        .map_err(|e| format!("Failed to get statuses: {}", e))?;

    let mut staged = Vec::new();
    let mut unstaged = Vec::new();
    let mut untracked = Vec::new();

    for entry in statuses.iter() {
        let path = entry.path().unwrap_or("").to_string();
        let status = entry.status();

        if status.contains(Status::WT_NEW) {
            untracked.push(GitFileStatus {
                path: path.clone(),
                status: "untracked".to_string(),
                staged: false,
            });
        }

        if status.contains(Status::INDEX_NEW) {
            staged.push(GitFileStatus {
                path: path.clone(),
                status: "added".to_string(),
                staged: true,
            });
        } else if status.contains(Status::INDEX_MODIFIED) {
            staged.push(GitFileStatus {
                path: path.clone(),
                status: "modified".to_string(),
                staged: true,
            });
        } else if status.contains(Status::INDEX_DELETED) {
            staged.push(GitFileStatus {
                path: path.clone(),
                status: "deleted".to_string(),
                staged: true,
            });
        } else if status.contains(Status::INDEX_RENAMED) {
            staged.push(GitFileStatus {
                path: path.clone(),
                status: "renamed".to_string(),
                staged: true,
            });
        }

        if status.contains(Status::WT_MODIFIED) {
            unstaged.push(GitFileStatus {
                path: path.clone(),
                status: "modified".to_string(),
                staged: false,
            });
        } else if status.contains(Status::WT_DELETED) {
            unstaged.push(GitFileStatus {
                path: path.clone(),
                status: "deleted".to_string(),
                staged: false,
            });
        } else if status.contains(Status::WT_RENAMED) {
            unstaged.push(GitFileStatus {
                path: path.clone(),
                status: "renamed".to_string(),
                staged: false,
            });
        }
    }

    Ok(GitStatus {
        branch,
        ahead,
        behind,
        staged,
        unstaged,
        untracked,
    })
}

/// Get ahead/behind counts for current branch
fn get_ahead_behind(repo: &Repository, head: &git2::Reference) -> Result<(usize, usize), String> {
    let local_oid = head
        .target()
        .ok_or_else(|| "Failed to get HEAD target".to_string())?;

    // Create a new reference from the head to avoid borrowing issues
    let head_ref = repo.find_reference(head.name().unwrap())
        .map_err(|e| format!("Failed to find reference: {}", e))?;

    let branch = git2::Branch::wrap(head_ref);
    let upstream = match branch.upstream() {
        Ok(upstream) => upstream,
        Err(_) => return Ok((0, 0)), // No upstream configured
    };

    let upstream_oid = upstream
        .get()
        .target()
        .ok_or_else(|| "Failed to get upstream target".to_string())?;

    let (ahead, behind) = repo
        .graph_ahead_behind(local_oid, upstream_oid)
        .map_err(|e| format!("Failed to calculate ahead/behind: {}", e))?;

    Ok((ahead, behind))
}

/// Get diff for a specific file
#[command]
pub async fn git_diff(
    repo_path: String,
    file_path: String,
    staged: bool,
) -> Result<String, String> {
    let repo = Repository::open(&repo_path)
        .map_err(|e| format!("Failed to open repository: {}", e))?;

    let mut opts = DiffOptions::new();
    opts.pathspec(&file_path);

    let diff = if staged {
        // Diff between HEAD and index (staged changes)
        let head = repo.head().map_err(|e| format!("Failed to get HEAD: {}", e))?;
        let tree = head
            .peel_to_tree()
            .map_err(|e| format!("Failed to get tree: {}", e))?;
        repo.diff_tree_to_index(Some(&tree), None, Some(&mut opts))
    } else {
        // Diff between index and working directory (unstaged changes)
        repo.diff_index_to_workdir(None, Some(&mut opts))
    }
    .map_err(|e| format!("Failed to get diff: {}", e))?;

    let mut diff_text = String::new();
    diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
        let content = String::from_utf8_lossy(line.content());
        diff_text.push_str(&content);
        true
    })
    .map_err(|e| format!("Failed to format diff: {}", e))?;

    Ok(diff_text)
}

/// Get recent commits
#[command]
pub async fn git_log(repo_path: String, limit: u32) -> Result<Vec<CommitInfo>, String> {
    let repo = Repository::open(&repo_path)
        .map_err(|e| format!("Failed to open repository: {}", e))?;

    let mut revwalk = repo
        .revwalk()
        .map_err(|e| format!("Failed to create revwalk: {}", e))?;

    revwalk
        .push_head()
        .map_err(|e| format!("Failed to push HEAD: {}", e))?;

    let mut commits = Vec::new();

    for (i, oid) in revwalk.enumerate() {
        if i >= limit as usize {
            break;
        }

        let oid = oid.map_err(|e| format!("Failed to get OID: {}", e))?;
        let commit = repo
            .find_commit(oid)
            .map_err(|e| format!("Failed to find commit: {}", e))?;

        commits.push(CommitInfo {
            hash: commit.id().to_string(),
            message: commit.message().unwrap_or("").to_string(),
            author: commit.author().name().unwrap_or("").to_string(),
            email: commit.author().email().unwrap_or("").to_string(),
            timestamp: commit.time().seconds(),
        });
    }

    Ok(commits)
}

/// Stage files
#[command]
pub async fn git_stage(repo_path: String, paths: Vec<String>) -> Result<(), String> {
    let repo = Repository::open(&repo_path)
        .map_err(|e| format!("Failed to open repository: {}", e))?;

    let mut index = repo
        .index()
        .map_err(|e| format!("Failed to get index: {}", e))?;

    for path in paths {
        index
            .add_path(Path::new(&path))
            .map_err(|e| format!("Failed to stage {}: {}", path, e))?;
    }

    index
        .write()
        .map_err(|e| format!("Failed to write index: {}", e))?;

    Ok(())
}

/// Unstage files
#[command]
pub async fn git_unstage(repo_path: String, paths: Vec<String>) -> Result<(), String> {
    let repo = Repository::open(&repo_path)
        .map_err(|e| format!("Failed to open repository: {}", e))?;

    let head = repo.head().map_err(|e| format!("Failed to get HEAD: {}", e))?;
    let head_commit = head
        .peel_to_commit()
        .map_err(|e| format!("Failed to get HEAD commit: {}", e))?;

    let head_object = head_commit.into_object();

    for path in paths {
        repo.reset_default(Some(&head_object), &[Path::new(&path)])
            .map_err(|e| format!("Failed to unstage {}: {}", path, e))?;
    }

    Ok(())
}

/// Create a commit
#[command]
pub async fn git_commit(repo_path: String, message: String) -> Result<String, String> {
    let repo = Repository::open(&repo_path)
        .map_err(|e| format!("Failed to open repository: {}", e))?;

    let signature = repo
        .signature()
        .map_err(|e| format!("Failed to get signature: {}", e))?;

    let mut index = repo
        .index()
        .map_err(|e| format!("Failed to get index: {}", e))?;

    let tree_id = index
        .write_tree()
        .map_err(|e| format!("Failed to write tree: {}", e))?;

    let tree = repo
        .find_tree(tree_id)
        .map_err(|e| format!("Failed to find tree: {}", e))?;

    let head = repo.head().map_err(|e| format!("Failed to get HEAD: {}", e))?;
    let parent_commit = head
        .peel_to_commit()
        .map_err(|e| format!("Failed to get parent commit: {}", e))?;

    let commit_id = repo
        .commit(
            Some("HEAD"),
            &signature,
            &signature,
            &message,
            &tree,
            &[&parent_commit],
        )
        .map_err(|e| format!("Failed to create commit: {}", e))?;

    Ok(commit_id.to_string())
}

/// Push to remote (shells out to git for SSH support)
#[command]
pub async fn git_push(repo_path: String) -> Result<String, String> {
    use std::process::Command;

    let output = Command::new("git")
        .arg("push")
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to execute git push: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

/// Pull from remote (shells out to git for SSH support)
#[command]
pub async fn git_pull(repo_path: String) -> Result<String, String> {
    use std::process::Command;

    let output = Command::new("git")
        .arg("pull")
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to execute git pull: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

/// Fetch from remote (shells out to git for SSH support)
#[command]
pub async fn git_fetch(repo_path: String) -> Result<String, String> {
    use std::process::Command;

    let output = Command::new("git")
        .arg("fetch")
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to execute git fetch: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

/// List branches
#[command]
pub async fn git_branches(repo_path: String) -> Result<Vec<BranchInfo>, String> {
    let repo = Repository::open(&repo_path)
        .map_err(|e| format!("Failed to open repository: {}", e))?;

    let mut branches = Vec::new();

    // Get current branch
    let head = repo.head().ok();
    let current_branch = head.as_ref().and_then(|h| h.shorthand()).map(|s| s.to_string());

    // List local branches
    let local_branches = repo
        .branches(Some(BranchType::Local))
        .map_err(|e| format!("Failed to list local branches: {}", e))?;

    for branch in local_branches {
        let (branch, _) = branch.map_err(|e| format!("Failed to get branch: {}", e))?;
        let name = branch
            .name()
            .map_err(|e| format!("Failed to get branch name: {}", e))?
            .unwrap_or("")
            .to_string();

        let is_current = current_branch.as_ref() == Some(&name);
        let upstream = branch.upstream().ok().and_then(|u| {
            u.name()
                .ok()
                .flatten()
                .map(|s| s.to_string())
        });

        branches.push(BranchInfo {
            name,
            is_current,
            is_remote: false,
            upstream,
        });
    }

    // List remote branches
    let remote_branches = repo
        .branches(Some(BranchType::Remote))
        .map_err(|e| format!("Failed to list remote branches: {}", e))?;

    for branch in remote_branches {
        let (branch, _) = branch.map_err(|e| format!("Failed to get branch: {}", e))?;
        let name = branch
            .name()
            .map_err(|e| format!("Failed to get branch name: {}", e))?
            .unwrap_or("")
            .to_string();

        branches.push(BranchInfo {
            name,
            is_current: false,
            is_remote: true,
            upstream: None,
        });
    }

    Ok(branches)
}

/// Checkout branch
#[command]
pub async fn git_checkout(repo_path: String, branch: String) -> Result<(), String> {
    let mut repo = Repository::open(&repo_path)
        .map_err(|e| format!("Failed to open repository: {}", e))?;

    let obj = repo
        .revparse_single(&branch)
        .map_err(|e| format!("Failed to find branch: {}", e))?;

    repo.checkout_tree(&obj, None)
        .map_err(|e| format!("Failed to checkout tree: {}", e))?;

    repo.set_head(&format!("refs/heads/{}", branch))
        .map_err(|e| format!("Failed to set HEAD: {}", e))?;

    Ok(())
}

/// Stash changes
#[command]
pub async fn git_stash(repo_path: String) -> Result<String, String> {
    let mut repo = Repository::open(&repo_path)
        .map_err(|e| format!("Failed to open repository: {}", e))?;

    let signature = repo
        .signature()
        .map_err(|e| format!("Failed to get signature: {}", e))?;

    let stash_id = repo
        .stash_save(&signature, "Stashed changes", None)
        .map_err(|e| format!("Failed to stash: {}", e))?;

    Ok(stash_id.to_string())
}

/// Pop stash
#[command]
pub async fn git_stash_pop(repo_path: String) -> Result<(), String> {
    let mut repo = Repository::open(&repo_path)
        .map_err(|e| format!("Failed to open repository: {}", e))?;

    repo.stash_pop(0, None)
        .map_err(|e| format!("Failed to pop stash: {}", e))?;

    Ok(())
}
