import { CreativeBrief, MediaItem, ProductionMode, Storyboard, StoryboardSchema, VisualPlan, VisualPlanSchema } from "../domain";

function detectProductionMode(topic: string, media: MediaItem[]): ProductionMode {
  const lower = topic.toLowerCase();
  if (lower.match(/ai|technology|software|app|tool|generator/)) return media.length ? "HYBRID" : "TECH_EXPLAINER";
  if (lower.match(/product|feature|website/)) return "PRODUCT_DEMO";
  if (lower.match(/reading|study|coffee/)) return media.length ? "CINEMATIC_VLOG" : "FACELESS_EXPLAINER";
  if (media.length) return "HYBRID";
  return "FACELESS_EXPLAINER";
}

function splitNarration(script: string): string[] {
  return script.match(/[^.!?]+[.!?]*/g)?.map((line) => line.trim()).filter(Boolean).slice(0, 5) ?? [script];
}

export function createVisualPlan(brief: CreativeBrief, script: string, media: MediaItem[]): { mode: ProductionMode; visualPlan: VisualPlan[]; storyboard: Storyboard } {
  const mode = detectProductionMode(brief.topic, media);
  const segments = splitNarration(script || brief.hook);
  const segmentDuration = brief.targetDuration / Math.max(1, segments.length);
  const visualPlan = segments.map((narration, index) => {
    const isHook = index === 0;
    const visualType = isHook
      ? "TITLE_CARD"
      : media[index % Math.max(1, media.length)] ? "USER_VIDEO" : mode === "TECH_EXPLAINER" ? "MOTION_GRAPHIC" : "KINETIC_TEXT";
    return VisualPlanSchema.parse({
      segment: index,
      voiceStart: Number((index * segmentDuration).toFixed(2)),
      voiceEnd: Number(((index + 1) * segmentDuration).toFixed(2)),
      narration,
      visualGoal: isHook ? "Make the first second feel intentional and clear." : `Support the narration idea: ${narration}`,
      visualType,
      motion: isHook ? "text_reveal" : visualType === "USER_VIDEO" ? "slow_push" : "punch_in",
      overlay: {
        text: isHook ? brief.hook.toUpperCase() : narration.split(/\s+/).slice(0, 4).join(" "),
        style: isHook ? "bold-minimal" : "clean-callout"
      },
      reason: visualType === "USER_VIDEO" ? "Use authentic user footage and add motion/text polish." : "Create visual variety without paid generated video."
    });
  });
  const storyboard = StoryboardSchema.parse({
    topic: brief.topic,
    productionMode: mode,
    scenes: visualPlan.map((plan, index) => ({
      id: `SCENE_${String(index + 1).padStart(2, "0")}`,
      start: plan.voiceStart,
      end: plan.voiceEnd,
      purpose: index === 0 ? "HOOK" : index === visualPlan.length - 1 ? "CTA" : index === 1 ? "CONTEXT" : "STORY",
      visual: `${plan.visualType}: ${plan.visualGoal}`,
      text: plan.overlay?.text,
      sound: index === 0 ? "soft impact, then voice clarity" : "voice-over led mix",
      transition: index === 0 ? "graphic_cut" : "hard_cut",
      sourceType: plan.visualType === "DIAGRAM" ? "MOTION_GRAPHIC" : plan.visualType
    }))
  });
  return { mode, visualPlan, storyboard };
}
