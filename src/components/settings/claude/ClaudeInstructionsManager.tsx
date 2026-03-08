import { useState, useEffect } from "react";
import { FileText, Eye, Save, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { open } from "@tauri-apps/plugin-dialog";

export function ClaudeInstructionsManager() {
  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [customPath, setCustomPath] = useState("");

  useEffect(() => {
    loadInstructions();
  }, []);

  const loadInstructions = async () => {
    setLoading(true);
    try {
      const content = await invoke<string>("read_claude_instructions");
      setInstructions(content);
    } catch (error) {
      console.error("Failed to load instructions:", error);
      setInstructions("");
    } finally {
      setLoading(false);
    }
  };

  const saveInstructions = async () => {
    setSaving(true);
    try {
      await invoke("write_claude_instructions", { content: instructions });
      toast.success("Instructions saved successfully");
    } catch (error) {
      toast.error(`Failed to save instructions: ${error}`);
    } finally {
      setSaving(false);
    }
  };

  const selectCustomPath = async () => {
    try {
      const selected = await open({
        directory: false,
        multiple: false,
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });
      if (selected) {
        setCustomPath(selected);
        toast.success(`Custom path set: ${selected}`);
      }
    } catch (error) {
      toast.error(`Failed to select path: ${error}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">CLAUDE.md Instructions</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Project-specific instructions for Claude Code (CLAUDE.md in project root)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadInstructions} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsPreviewOpen(true)}>
            <Eye className="size-3 mr-2" />
            Preview
          </Button>
          <Button size="sm" onClick={saveInstructions} disabled={saving}>
            <Save className="size-3 mr-2" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Custom Path */}
      <div className="space-y-2">
        <Label htmlFor="custom-path">Custom Instructions Path (Optional)</Label>
        <div className="flex gap-2">
          <Input
            id="custom-path"
            value={customPath}
            onChange={(e) => setCustomPath(e.target.value)}
            placeholder="~/.claude/global-instructions.md"
            className="flex-1 font-mono text-xs"
          />
          <Button variant="outline" size="icon" onClick={selectCustomPath}>
            <FolderOpen className="size-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Override default CLAUDE.md location. Leave empty to use project root.
        </p>
      </div>

      {/* Editor */}
      <div className="space-y-2">
        <Label htmlFor="instructions">Instructions (Markdown)</Label>
        <Textarea
          id="instructions"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="# Project Instructions&#10;&#10;## Code Style&#10;- Use TypeScript strict mode&#10;- Follow functional programming patterns&#10;&#10;## Testing&#10;- Write unit tests for all utilities&#10;- Use Jest for testing"
          rows={20}
          className="font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">
          These instructions are loaded automatically when Claude Code starts in this project.
        </p>
      </div>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Instructions Preview</DialogTitle>
          </DialogHeader>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <pre className="whitespace-pre-wrap text-xs bg-muted p-4 rounded-lg">
              {instructions || "No instructions provided"}
            </pre>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsPreviewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
