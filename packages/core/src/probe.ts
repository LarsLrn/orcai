/** What a dependency reports when the instance health check reaches it. */
export interface ProbeResult {
	readonly ok: boolean;
	readonly version?: string;
	readonly detail?: string;
}
