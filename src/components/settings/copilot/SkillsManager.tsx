import { useState, useEffect } from "react";
import { Zap, Plus, Trash2, Edit2, Eye, Save, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

interface Skill {
  name: string;
  dirName: string;
  frontmatter: {
    name: string;
    description: string;
    license?: string;
  };
  content: string;
}

export function SkillsManager() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewSkill, setPreviewSkill] = useState<Skill | null>(null);

  useEffect(() => {
    loadSkills();
  }, []);

  const loadSkills = async () => {
    setLoading(true);
    try {
      const skillsList = await invoke<Skill[]>("list_copilot_skills");
      setSkills(skillsList);
    } catch (error) {
      console.error("Failed to load skills:", error);
      setSkills([]);
    } finally {
      setLoading(false);
    }
  };

  const openEditDialog = (skill?: Skill) => {
    if (skill) {
      setEditingSkill(skill);
    } else {
      setEditingSkill({
        name: "",
        dirName: "",
        frontmatter: {
          name: "",
          description: "",
        },
        content: "",
      });
    }
    setIsDialogOpen(true);
  };

  const closeEditDialog = () => {
    setEditingSkill(null);
    setIsDialogOpen(false);
  };

  const saveSkill = async () => {
    if (!editingSkill || !editingSkill.dirName.trim()) {
      toast.error("Skill directory name is required");
      return;
    }

    if (!editingSkill.frontmatter.name.trim()) {
      toast.error("Skill name is required");
      return;
    }

    if (!editingSkill.frontmatter.description.trim()) {
      toast.error("Skill description is required");
      return;
    }

    try {
      await invoke("save_copilot_skill", {
        dirName: editingSkill.dirName,
        frontmatter: editingSkill.frontmatter,
        content: editingSkill.content,
      });
      toast.success("Skill saved successfully");
      loadSkills();
      closeEditDialog();
    } catch (error) {
      toast.error(`Failed to save skill: ${error}`);
    }
  };

  const deleteSkill = async (dirName: string) => {
    try {
      await invoke("delete_copilot_skill", { dirName });
      toast.success("Skill deleted successfully");
      loadSkills();
    } catch (error) {
      toast.error(`Failed to delete skill: ${error}`);
    }
  };

  const openPreview = (skill: Skill) => {
    setPreviewSkill(skill);
    setIsPreviewOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Skills</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Task-specific workflows that Copilot loads when relevant
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadSkills} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => openEditDialog()}>
            <Plus className="size-3 mr-2" />
            New Skill
          </Button>
        </div>
      </div>

      {/* Skill List */}
      <div className="space-y-2">
        {skills.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground border rounded-lg" style={{ borderColor: "var(--ui-border)" }}>
            No skills configured. Click "New Skill" to create one.
          </div>
        ) : (
          skills.map((skill) => (
            <div
              key={skill.dirName}
              className="p-4 border rounded-lg space-y-2"
              style={{ borderColor: "var(--ui-border)" }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Zap className="size-4" />
                    <h4 className="font-medium">{skill.frontmatter.name}</h4>
                    {skill.frontmatter.license && (
                      <Badge variant="outline">{skill.frontmatter.license}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {skill.frontmatter.description}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Directory: <code>{skill.dirName}</code>
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openPreview(skill)}
                  >
                    <Eye className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(skill)}
                  >
                    <Edit2 className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteSkill(skill.dirName)}
                  >
                    <Trash2 className="size-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSkill?.dirName ? "Edit Skill" : "New Skill"}</DialogTitle>
          </DialogHeader>

          {editingSkill && (
            <div className="space-y-4">
              {/* Directory Name */}
              <div className="space-y-2">
                <Label htmlFor="dir-name">Directory Name</Label>
                <Input
                  id="dir-name"
                  value={editingSkill.dirName}
                  onChange={(e) => setEditingSkill({ ...editingSkill, dirName: e.target.value })}
                  placeholder="my-skill"
                />
                <p className="text-xs text-muted-foreground">
                  Location: <code>~/.copilot/skills/{editingSkill.dirName || "..."}/SKILL.md</code>
                </p>
              </div>

              {/* Skill Name */}
              <div className="space-y-2">
                <Label htmlFor="skill-name">Skill Name *</Label>
                <Input
                  id="skill-name"
                  value={editingSkill.frontmatter.name}
                  onChange={(e) => setEditingSkill({
                    ...editingSkill,
                    frontmatter: { ...editingSkill.frontmatter, name: e.target.value },
                  })}
                  placeholder="my-skill"
                />
                <p className="text-xs text-muted-foreground">
                  Use lowercase letters and hyphens (e.g., github-actions-debugging)
                </p>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={editingSkill.frontmatter.description}
                  onChange={(e) => setEditingSkill({
                    ...editingSkill,
                    frontmatter: { ...editingSkill.frontmatter, description: e.target.value },
                  })}
                  placeholder="Guide for debugging failing GitHub Actions workflows. Use this when asked to debug failing GitHub Actions workflows."
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Copilot uses this to decide when to load this skill
                </p>
              </div>

              {/* License */}
              <div className="space-y-2">
                <Label htmlFor="license">License (Optional)</Label>
                <Input
                  id="license"
                  value={editingSkill.frontmatter.license || ""}
                  onChange={(e) => setEditingSkill({
                    ...editingSkill,
                    frontmatter: { ...editingSkill.frontmatter, license: e.target.value },
                  })}
                  placeholder="MIT"
                />
              </div>

              {/* Skill Instructions */}
              <div className="space-y-2">
                <Label htmlFor="content">Skill Instructions (Markdown) *</Label>
                <Textarea
                  id="content"
                  value={editingSkill.content}
                  onChange={(e) => setEditingSkill({ ...editingSkill, content: e.target.value })}
                  placeholder="To debug failing GitHub Actions workflows in a pull request, follow this process:&#10;&#10;1. Use the `list_workflow_runs` tool to look up recent workflow runs&#10;2. Use the `summarize_job_log_failures` tool to get an AI summary&#10;3. If more information is needed, use `get_job_logs` for full logs&#10;4. Try to reproduce the failure locally&#10;5. Fix the failing build and verify"
                  rows={12}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Provide step-by-step instructions for completing the task
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog}>
              Cancel
            </Button>
            <Button onClick={saveSkill}>
              <Save className="size-3 mr-2" />
              Save Skill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Skill Preview: {previewSkill?.frontmatter.name}</DialogTitle>
          </DialogHeader>
          {previewSkill && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-medium">Description</Label>
                <p className="text-sm mt-1">{previewSkill.frontmatter.description}</p>
              </div>
              {previewSkill.frontmatter.license && (
                <div>
                  <Label className="text-xs font-medium">License</Label>
                  <p className="text-sm mt-1">{previewSkill.frontmatter.license}</p>
                </div>
              )}
              <div>
                <Label className="text-xs font-medium">Instructions</Label>
                <pre className="mt-1 p-3 bg-muted rounded-lg text-xs whitespace-pre-wrap">
                  {previewSkill.content || "No instructions provided"}
                </pre>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsPreviewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
