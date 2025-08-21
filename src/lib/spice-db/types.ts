export type Action = "read" | "create" | "update" | "delete";

export type EntityType =
	| "course"
	| "user"
	| "chat"
	| "asset"
	| "organization"
	| "block"
	| "bot";

export type Relation = "owner" | "member";

export type Consistency = "minimizeLatency" | "fullyConsistent";
