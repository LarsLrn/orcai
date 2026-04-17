import type { AssetId, BlockId } from "@orcai/core";

type JobResource =
	| {
			resourceId: BlockId;
			resourceType: "block";
	  }
	| {
			resourceId: AssetId;
			resourceType: "asset";
	  };

export type { JobResource };
