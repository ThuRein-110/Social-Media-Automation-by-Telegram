import { CreativeBrief } from "../domain";
import { createVideoConceptProfile } from "./conceptProfile";

export interface ScriptPackage {
  voiceoverScript: string;
  socialCaption: string;
  textOverlays: string[];
  hashtags: string[];
}

export function writeScript(brief: CreativeBrief, brandName: string): ScriptPackage {
  const topicWords = brief.topic.toLowerCase().split(/\W+/).filter(Boolean);
  const cinematicTopic = /movie|film|scene|cinematic|cinema/.test(brief.topic.toLowerCase());
  const noVoice = !brief.voiceOver.required;
  const concept = createVideoConceptProfile(brief.topic);
  const cinematicVoice = [
    "Watch the quiet moment first.",
    "Nothing feels loud yet, but something is already changing.",
    "The camera stays close, the details move slowly, and every small pause starts to feel important.",
    "Then one choice pushes the whole story forward.",
    "This is the kind of moment people remember, because it does not explain everything.",
    "It lets the feeling build, then leaves one final beat behind.",
    "By the end, the scene should feel finished, not empty or rushed."
  ].join(" ");
  const readingVoice = /reading|book|library/i.test(brief.topic)
    ? [
      "I hadn't finished a book in months.",
      "Not because I stopped loving stories.",
      "I just stopped giving them quiet space.",
      "So I put my phone down and opened one page.",
      "Then another.",
      "The room felt slower.",
      "My mind stopped jumping so much.",
      "And for the first time in a while, reading didn't feel like a task.",
      "It gave the day a softer ending.",
      "It felt like coming back to myself."
    ].join(" ")
    : "";
  const reflectiveVoice = readingVoice || (/alone|yourself|quiet|time|reset|slow|tired/i.test(brief.topic)
    ? [
      "I didn't realize how tired I was.",
      "Not tired from one thing, just from always being switched on.",
      "So I took a little time alone.",
      "No big plan. No perfect routine.",
      "I put my phone down and made the room quiet.",
      "Just a slower breath, a small pause, and a few minutes where nobody needed anything from me.",
      "And honestly, that was enough.",
      "My thoughts felt less crowded.",
      "The next thing I had to do felt smaller.",
      "Sometimes you don't need more motivation.",
      "You need less noise."
    ].join(" ")
    : [
      `Here's the part of ${brief.topic} people usually miss.`,
      "The best moment is not the loudest one.",
      "It's the small detail that makes the whole idea click.",
      "Show it clearly, keep the pace moving, and let the final beat feel earned."
    ].join(" "));
  const voiceoverScript = brief.voiceOver.required ? (cinematicTopic ? cinematicVoice : reflectiveVoice) : "";
  const hashtags = [...new Set(["shorts", brandName.toLowerCase().replace(/\W+/g, ""), ...topicWords].filter(Boolean))].slice(0, 8).map((tag) => `#${tag}`);
  const overlays = cinematicTopic || noVoice
    ? [brief.hook, "Watch the room change", "One choice moves the story", "Remember the final beat"]
    : [brief.hook, "Motion, detail, and a clean finish", "Save this idea for later"];
  return {
    voiceoverScript,
    socialCaption: `${brief.hook}\n\n${concept.coreIdea}\n\n${hashtags.join(" ")}`,
    textOverlays: overlays,
    hashtags
  };
}
