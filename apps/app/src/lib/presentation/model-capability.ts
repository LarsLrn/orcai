import type { ModelCapability } from "@orcai/schema";
import { m } from "@/paraglide/messages";

const modelCapabilityLabels: Record<ModelCapability, () => string> = {
	text: m.models_capability_text_label,
	embedding: m.models_capability_embedding_label,
	image: m.models_capability_image_label,
	"image-generation": m.models_capability_image_generation_label,
	video: m.models_capability_video_label,
	audio: m.models_capability_audio_label,
	"audio-generation": m.models_capability_audio_generation_label,
	reasoning: m.models_capability_reasoning_label,
	"tool-calling": m.models_capability_tool_calling_label,
};

export const getModelCapabilityLabel = (capability: ModelCapability) =>
	modelCapabilityLabels[capability]();
