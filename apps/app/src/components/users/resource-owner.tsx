import type { ResourceOwner as Owner } from "@orcai/schema";
import { useRouteContext } from "@tanstack/react-router";
import { UserAvatar } from "@/components/users/user-avatar";
import { m } from "@/paraglide/messages";

/** Who owns a resource, as "You" for the current user. */
const ResourceOwner = ({ owner }: { owner: Owner }) => {
	const { auth } = useRouteContext({
		from: "/app",
	});

	return (
		<span
			data-slot="resource-owner"
			className="flex min-w-0 items-center gap-1.5"
		>
			<UserAvatar user={owner} size="sm" />
			<span className="truncate">
				<span className="sr-only">{m.resource_owner_label()} </span>
				{owner.id === auth.user.id ? m.resource_owner_you() : owner.name}
			</span>
		</span>
	);
};

export { ResourceOwner };
