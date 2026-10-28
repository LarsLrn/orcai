import { initialsOf } from "@orcai/core";
import { UserIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/** A user's profile picture, or their initials while it loads or when there is none. */
const UserAvatar = ({
	user,
	size,
	className,
}: {
	user: {
		name: string;
		image?: string | null;
	};
	size?: ComponentProps<typeof Avatar>["size"];
	className?: string;
}) => {
	const initials = initialsOf(user.name);

	return (
		<Avatar size={size} className={className}>
			{user.image ? <AvatarImage src={user.image} alt={user.name} /> : null}
			<AvatarFallback>
				{initials || <UserIcon className="size-4" aria-hidden="true" />}
			</AvatarFallback>
		</Avatar>
	);
};

export { UserAvatar };
