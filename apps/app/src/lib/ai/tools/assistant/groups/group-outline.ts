import type { GroupId } from "@orcai/core";

/** What a group tool tells the model about the group it wrote. */
export const groupOutline = ({
	data,
}: {
	data: {
		id: GroupId;
		name: string;
		description: string | null;
	};
}) => ({
	type: "group" as const,
	id: data.id,
	name: data.name,
	description: data.description,
});
