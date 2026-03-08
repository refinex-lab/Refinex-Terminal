import { useState, useEffect } from "react";
import { Zap, Plus, Trash2, Edit2, Eye, Save } from "lucide-react";
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
  fileName: string;
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
      const skillsList = await invoke<Skill[]>("list_claude_skills");
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
        fileName: "",
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
    if (!editingSkill || !editingSkill.fileName.trim()) {
      toast.error("Skill file name is required");
      return;
    }

    if (!editingSkill.content.trim()) {
      toast.error("Skill content is required");
      return;
    }

    try {
      await invoke("save_claude_skill", {
        fileName: editingSkill.fileName,
        content: editingSkill.content,
      });
      toast.success("Skill saved successfully");
      loadSkills();
      closeEditDialog();
    } catch (error) {
      toast.error(`Failed to save skill: ${error}`);
    }
  };

  const deleteSkill = async (fileName: string) => {
    try {
      await invoke("delete_claude_skill", { fileName });
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
          <Label className="text-sm font-medium">Custom Skills</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Define reusable skills and capabilities (stored in ~/.claude/skills/)
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
            No custom skills configured. Click "New Skill" to create one.
          </div>
        ) : (
          skills.map((skill) => (
            <div
              key={skill.fileName}
              className="p-4 border rounded-lg space-y-2"
              style={{ borderColor: "var(--ui-border)" }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Zap className="size-4" />
                    <h4 className="font-medium">{skill.name || skill.fileName.replace(".md", "")}</h4>
                    <Badge variant="outline" className="text-xs">Markdown</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {skill.fileName}
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
                    onClick={() => deleteSkill(skill.fileName)}
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
            <DialogTitle>{editingSkill?.fileName ? "Edit Skill" : "New Skill"}</DialogTitle>
          </DialogHeader>

          {editingSkill && (
            <div className="space-y-4">
              {/* File Name */}
              <div className="space-y-2">
                <Label htmlFor="file-name">File Name</Label>
                <Input
                  id="file-name"
                  value={editingSkill.fileName}
                  onChange={(e) => setEditingSkill({ ...editingSkill, fileName: e.target.value })}
                  placeholder="my-skill.md"
                />
                <p className="text-xs text-muted-foreground">
                  Location: <code>~/.claude/skills/{editingSkill.fileName || "..."}</code>
                </p>
              </div>

              {/* Display Name */}
              <div className="space-y-2">
                <Label htmlFor="display-name">Display Name</Label>
                <Input
                  id="display-name"
                  value={editingSkill.name || ""}
                  onChange={(e) => setEditingSkill({ ...editingSkill, name: e.target.value })}
                  placeholder="My Custom Skill"
                />
              </div>

              {/* Skill Instructions */}
              <div className="space-y-2">
                <Label htmlFor="content">Skill Instructions (Markdown)</Label>
                <Textarea
                  id="content"
                  value={editingSkill.content}
                  onChange={(e) => setEditingSkill({ ...editingSkill, content: e.target.value })}
                  placeholder="# Skill Name&#10;&#10;## Description&#10;This skill provides...&#10;&#10;## Usage&#10;Use this skill when...&#10;&#10;## Examples&#10;```bash&#10;example command&#10;```"
                  rows={16}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Define reusable capabilities and procedures. Use Markdown formatting.
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
            <DialogTitle>Skill Preview: {previewSkill?.name || previewSkill?.fileName}</DialogTitle>
          </DialogHeader>
          {previewSkill && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-medium">File Name</Label>
                <p className="text-sm mt-1 font-mono">{previewSkill.fileName}</p>
              </div>
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
