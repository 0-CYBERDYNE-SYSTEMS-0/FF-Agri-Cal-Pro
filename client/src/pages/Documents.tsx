import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import MarkdownRenderer from "@/components/ui/markdown-renderer";

interface UserDocument {
  id: number;
  title: string;
  content: string;
  documentType: string;
  tags: string[] | null;
  projectId: number | null;
  createdAt: string;
  updatedAt: string;
}

const TYPES = ["all", "note", "plan", "report", "analysis"];

function typeBadgeClass(type: string): string {
  switch (type) {
    case "plan":
      return "bg-green-100 text-green-800";
    case "report":
      return "bg-blue-100 text-blue-800";
    case "analysis":
      return "bg-purple-100 text-purple-800";
    default:
      return "bg-neutral-100 text-neutral-700";
  }
}

export default function Documents() {
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState("note");
  const [newContent, setNewContent] = useState("");
  const queryClient = useQueryClient();

  const { data: documents = [], isLoading } = useQuery<UserDocument[]>({
    queryKey: ["/api/documents"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/documents", {
        title: newTitle,
        documentType: newType,
        content: newContent,
      });
      return res.json();
    },
    onSuccess: (created: UserDocument) => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      setNewTitle("");
      setNewContent("");
      setNewType("note");
      setShowCreate(false);
      setSelectedId(created.id);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      if (selectedId != null) setSelectedId(null);
    },
  });

  const visible = documents.filter(doc => filter === "all" || doc.documentType === filter);
  const selected = documents.find(doc => doc.id === selectedId) ?? null;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold text-neutral-900">Documents</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Notes, plans, and reports — written by you or by Farm Friend.
          </p>
        </div>
        <Button
          className="bg-primary hover:bg-primary-dark"
          onClick={() => setShowCreate(!showCreate)}
        >
          {showCreate ? "Cancel" : "New Document"}
        </Button>
      </div>

      {showCreate && (
        <div className="bg-white rounded-lg shadow p-5 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="md:col-span-3">
              <Label htmlFor="doc-title">Title</Label>
              <Input
                id="doc-title"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="e.g. Cover crop rotation notes"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="doc-type">Type</Label>
              <select
                id="doc-type"
                value={newType}
                onChange={e => setNewType(e.target.value)}
                className="mt-1 w-full h-10 rounded-md border border-neutral-300 bg-white px-3 text-sm"
              >
                {TYPES.filter(t => t !== "all").map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <Label htmlFor="doc-content">Content (Markdown supported)</Label>
          <Textarea
            id="doc-content"
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            rows={10}
            className="mt-1 font-mono text-sm"
            placeholder={"## Steps\n1. ...\n\n## Materials\n- ..."}
          />
          <div className="mt-4 flex justify-end">
            <Button
              className="bg-primary hover:bg-primary-dark"
              disabled={!newTitle.trim() || !newContent.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? "Saving..." : "Save Document"}
            </Button>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-5 flex-wrap">
        {TYPES.map(type => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`px-3 py-1.5 rounded-full text-sm capitalize transition ${
              filter === type
                ? "bg-primary text-white"
                : "bg-white text-neutral-600 border border-neutral-200 hover:border-neutral-300"
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* List */}
        <div className="lg:col-span-2 space-y-2">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
          ) : visible.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-sm text-neutral-500">
              No documents{filter !== "all" ? ` typed "${filter}"` : ""} yet. Farm Friend can
              write plans and notes here — try asking it in chat.
            </div>
          ) : (
            visible.map(doc => (
              <button
                key={doc.id}
                onClick={() => setSelectedId(doc.id)}
                className={`w-full text-left bg-white rounded-lg shadow p-4 transition border-l-4 ${
                  selectedId === doc.id ? "border-primary" : "border-transparent hover:border-neutral-300"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm">{doc.title}</span>
                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${typeBadgeClass(doc.documentType)}`}>
                    {doc.documentType}
                  </span>
                </div>
                <div className="text-xs text-neutral-400 mt-1">
                  Updated {new Date(doc.updatedAt).toLocaleDateString()}
                  {doc.tags && doc.tags.length > 0 && (
                    <span className="ml-2 text-neutral-500">{doc.tags.join(", ")}</span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Viewer */}
        <div className="lg:col-span-3">
          {selected ? (
            <div className="bg-white rounded-lg shadow">
              <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
                <div>
                  <h2 className="font-serif font-bold text-lg">{selected.title}</h2>
                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${typeBadgeClass(selected.documentType)}`}>
                    {selected.documentType}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (window.confirm(`Delete "${selected.title}"? This cannot be undone.`)) {
                      deleteMutation.mutate(selected.id);
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
              <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">
                <MarkdownRenderer content={selected.content} className="prose prose-sm max-w-none" />
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-10 text-center text-sm text-neutral-500 h-fit">
              Select a document to read it.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
