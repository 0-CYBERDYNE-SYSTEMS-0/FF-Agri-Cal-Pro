import { Button } from "@/components/ui/button";
import type { PendingAssistantAction } from "@/lib/openAiApi";

interface AssistantActionApprovalsProps {
  actions: PendingAssistantAction[];
  busyActionId?: string | null;
  onApprove: (actionId: string) => void;
  onDismiss: (actionId: string) => void;
}

export default function AssistantActionApprovals({ actions, busyActionId, onApprove, onDismiss }: AssistantActionApprovalsProps) {
  if (actions.length === 0) return null;

  return (
    <section className="mx-2 my-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-950" aria-label="Assistant action approval">
      <p className="mb-2 text-sm font-semibold">Review before the assistant acts</p>
      <p className="mb-3 text-xs">Calendar changes and private file access stay pending until you approve them here. Pending approvals expire after ten minutes.</p>
      <div className="space-y-3">
        {actions.map(action => (
          <div key={action.id} className="rounded border border-amber-200 bg-white p-3">
            <p className="break-words text-sm font-medium">{action.summary}</p>
            <p className="mt-1 text-xs text-neutral-600">Expires {new Date(action.expiresAt).toLocaleTimeString()}</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" disabled={!!busyActionId} onClick={() => onApprove(action.id)}>
                {busyActionId === action.id ? "Processing…" : "Approve action"}
              </Button>
              <Button size="sm" variant="outline" disabled={!!busyActionId} onClick={() => onDismiss(action.id)}>
                Dismiss
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
