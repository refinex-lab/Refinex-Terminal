import { useState, useEffect } from "react";
import { FileText, Plus, Trash2, Edit2, Eye, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

export function CustomInstructionsManager() {
  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    loadInstructions();
  }, []);

  const loadInstructions = async () => {
    setLoading(true);
    try {
      const content = await invoke<string>("read_copilot_instructions");
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
      await invoke("write_copilot_instructions", { content: instructions });
      toast.success("Custom instructions saved successfully");
    } catch (error) {
      toast.error(`Failed to save instructions: ${error}`);
    } finally {
      setSaving(false);
    }
  };

  const openPreview = () => {
    setIsPreviewOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Custom Instructions</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Global instructions applied to all Copilot CLI sessions
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadInstructions} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </Button>
          <Button variant="outline" size="sm" onClick={openPreview}>
            <Eye className="size-3 mr-2" />
            Preview
          </Button>
          <Button size="sm" onClick={saveInstructions} disabled={saving}>
            <Save className="size-3 mr-2" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="instructions">Instructions (Markdown)</Label>
        <Textarea
          id="instructions"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="# Project Guidelines&#10;&#10;## Code Style&#10;- Use TypeScript strict mode&#10;- Prefer functional components&#10;&#10;## Testing&#10;- Write tests for all new features"
          rows={20}
          className="font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">
          File location: <code>~/.copilot/copilot-instructions.md</code>
        </p>
      </div>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Instructions Preview</DialogTitle>
          </DialogHeader>
          <div className="prose prose-sm dark:prose-it max-w-none">
            <pre className="whitespace-pre-wrap text-xs">{instructions || "No instructions configured"}</pre>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsPreviewOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
