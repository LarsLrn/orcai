import type { ModelCapability } from "@orcai/schema";

/** What a provider row supplies to reach the provider's API. */
export interface ProviderConnection {
	readonly apiKey: string;
	readonly endpoint: string | null;
	/** Replaces the global fetch, e.g. in tests. */
	readonly fetch?: typeof globalThis.fetch;
}

export interface DiscoveredModel {
	readonly providerModelId: string;
	readonly name: string;
	readonly description: string;
	/** Null where the provider does not say. */
	readonly contextWindow: number | null;
	readonly maxOutputTokens: number | null;
	/** Null where the provider does not say. */
	readonly capabilities: ModelCapability[] | null;
}

/** A system prompt split by how often it changes. */
export interface SystemPrompt {
	/** Identical across steps and turns, so providers that cache can key on it. */
	readonly stable: string;
	readonly variable?: string;
}
