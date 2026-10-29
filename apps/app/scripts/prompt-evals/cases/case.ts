import type { Check } from "../checks";
import type { EvalModel, Transcript } from "../harness";

/** A case passes a sample when every check passes. Its area is the id's prefix. */
export interface EvalCase {
	id: `${string}/${string}`;
	run: (model: EvalModel) => Promise<Transcript>;
	checks: Check[];
}
