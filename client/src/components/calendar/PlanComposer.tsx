import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Sparkles } from "lucide-react";

interface Plan {
  id: number;
  title: string;
  goal: string;
  status: string; // draft | applied | dismissed
  summary: string | null;
  sources: Array<{ url: string; title?: string }> | null;
  projectId: number | null;
  startDate: string | null;
  createdAt: string;
  eventCount?: number;
}

interface PreviewEvent {
  index: number;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  dependsOnIndex: number | null;
  offsetDays: number;
  location: string | null;
  checkWeather: boolean;
  recurring: { frequency: string; interval: number; endDate: string | null } | null;
}

interface PreviewResponse {
  anchorDate: string;
  events: PreviewEvent[];
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function PlanComposer() {
  const [isOpen, setIsOpen] = useState(false);
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const [draftPlan, setDraftPlan] = useState<Plan | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: plans = [], isLoading: isLoadingPlans, refetch: refetchPlans } = useQuery<Plan[]>({
    queryKey: ["/api/plans"],
    enabled: isOpen,
  });

  const { data: preview } = useQuery<PreviewResponse>({
    queryKey: ["/api/plans", draftPlan?.id, "preview"],
    enabled: !!draftPlan,
  });

  const generate = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/plans/generate", {
        goal,
        startDate: `${startDate}T00:00`,
      });
      return res.json();
    },
    onSuccess: (plan: Plan) => {
      setDraftPlan(plan);
      refetchPlans();
    },
    onError: (err: any) => {
      toast({
        title: "Plan generation failed",
        description: err?.message || "The research service could not build a plan. Nothing was saved.",
        variant: "destructive",
      });
    },
  });

  const apply = useMutation({
    mutationFn: async (planId: number) => {
      const res = await apiRequest("POST", `/api/plans/${planId}/apply`);
      return res.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      toast({
        title: "Plan applied",
        description: `${result.events.length} events were added to your calendar.`,
      });
      setDraftPlan(null);
      setIsOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Could not apply plan", description: err?.message, variant: "destructive" });
    },
  });

  const dismiss = useMutation({
    mutationFn: async (planId: number) => {
      await apiRequest("POST", `/api/plans/${planId}/dismiss`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
      setDraftPlan(null);
    },
  });

  const draftPlans = plans.filter(p => p.status === "draft");

  // EventModal's "Plan This Goal" opens the composer with the event title as
  // a starting goal. Dispatch: window event "open-plan-composer" {detail:{goal}}
  useEffect(() => {
    const handler = (event: Event) => {
      const goal = (event as CustomEvent).detail?.goal;
      if (typeof goal === "string" && goal.trim()) setGoal(goal.trim());
      setIsOpen(true);
    };
    window.addEventListener("open-plan-composer", handler as EventListener);
    return () => window.removeEventListener("open-plan-composer", handler as EventListener);
  }, []);

  return (
    <>
      <Button onClick={() => setIsOpen(true)} variant="outline" className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        AI Plan
      </Button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl my-8">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
              <div>
                <h2 className="font-serif font-bold text-lg">Plan Composer</h2>
                <p className="text-xs text-neutral-500">Describe a goal — get a researched, step-by-step calendar plan to approve.</p>
              </div>
              <button className="text-neutral-400 hover:text-neutral-600 text-2xl leading-none" onClick={() => setIsOpen(false)} aria-label="Close">×</button>
            </div>

            <div className="px-6 py-5">
              {/* Goal form */}
              {!draftPlan && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-3">
                      <Label htmlFor="plan-goal">Your goal</Label>
                      <Textarea
                        id="plan-goal"
                        value={goal}
                        onChange={e => setGoal(e.target.value)}
                        rows={3}
                        className="mt-1"
                        placeholder="e.g. I want to plant a vegetable garden · manage 5 acres of sorghum · make insecticide by fermenting tobacco"
                      />
                    </div>
                    <div>
                      <Label htmlFor="plan-start">Start date (day 0)</Label>
                      <Input
                        id="plan-start"
                        type="date"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end mt-4">
                    <Button
                      className="bg-primary hover:bg-primary-dark"
                      disabled={goal.trim().length < 3 || generate.isPending}
                      onClick={() => generate.mutate()}
                    >
                      {generate.isPending ? "Researching & drafting… this can take a minute" : "Research & Draft Plan"}
                    </Button>
                  </div>

                  {/* Existing drafts */}
                  {draftPlans.length > 0 && (
                    <div className="mt-6">
                      <h3 className="text-sm font-semibold text-neutral-700 mb-2">Saved drafts</h3>
                      <div className="space-y-2">
                        {draftPlans.map(plan => (
                          <div key={plan.id} className="flex items-center justify-between bg-neutral-50 rounded-md px-4 py-3">
                            <button
                              className="text-left flex-1"
                              onClick={() => setDraftPlan(plan)}
                            >
                              <span className="text-sm font-medium">{plan.title}</span>
                              <span className="text-xs text-neutral-400 ml-2">
                                {new Date(plan.createdAt).toLocaleDateString()}
                              </span>
                            </button>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setDraftPlan(plan)}>
                                Review
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 text-xs bg-primary hover:bg-primary-dark"
                                disabled={apply.isPending}
                                onClick={() => apply.mutate(plan.id)}
                              >
                                Apply
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Generating state */}
              {generate.isPending && (
                <div className="py-10 text-center">
                  <div className="animate-pulse text-sm text-neutral-600">
                    Researching your goal, checking the forecast and farm context, composing a step-by-step plan…
                  </div>
                </div>
              )}

              {/* Draft review */}
              {draftPlan && (
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-serif font-bold text-xl">{draftPlan.title}</h3>
                      {draftPlan.summary && (
                        <p className="text-sm text-neutral-600 mt-1 max-w-2xl">{draftPlan.summary}</p>
                      )}
                      {draftPlan.sources && draftPlan.sources.length > 0 && (
                        <div className="mt-2 text-xs text-neutral-500">
                          Sources:{" "}
                          {draftPlan.sources.map((source, i) => (
                            <a key={i} href={source.url} target="_blank" rel="noreferrer" className="text-primary hover:underline mr-2">
                              [{i + 1}] {source.title || new URL(source.url).hostname}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                    <button className="text-neutral-400 hover:text-neutral-600 text-sm shrink-0" onClick={() => setDraftPlan(null)}>
                      ← back
                    </button>
                  </div>

                  <div className="mt-4 border rounded-md divide-y divide-neutral-100 max-h-[45vh] overflow-y-auto">
                    {(preview?.events ?? []).map(event => (
                      <div key={event.index} className="px-4 py-3">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-sm font-medium">
                            {event.index + 1}. {event.title}
                            {event.recurring && (
                              <span className="ml-2 text-[10px] uppercase font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                                every {event.recurring.interval} {event.recurring.frequency}(s)
                              </span>
                            )}
                          </span>
                          <span className="text-xs text-neutral-500 shrink-0 text-right">
                            {fmtDate(event.startDate)} · {fmtTime(event.startDate)}
                            {event.dependsOnIndex != null && (
                              <span className="text-neutral-400"> (after #{event.dependsOnIndex + 1} +{event.offsetDays}d)</span>
                            )}
                          </span>
                        </div>
                        {event.description && (
                          <details className="mt-1">
                            <summary className="text-xs text-primary cursor-pointer">instructions</summary>
                            <pre className="text-xs text-neutral-600 whitespace-pre-wrap mt-1 bg-neutral-50 rounded p-2">{event.description}</pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-end gap-3 mt-5">
                    <Button
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      disabled={dismiss.isPending}
                      onClick={() => dismiss.mutate(draftPlan.id)}
                    >
                      Discard plan
                    </Button>
                    <Button
                      className="bg-primary hover:bg-primary-dark"
                      disabled={apply.isPending || !preview}
                      onClick={() => apply.mutate(draftPlan.id)}
                    >
                      {apply.isPending ? "Applying…" : `Approve & add ${preview?.events.length ?? "?"} events`}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
