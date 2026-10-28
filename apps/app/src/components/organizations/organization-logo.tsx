import { initialsOf } from "@orcai/core";
import { Building2Icon } from "lucide-react";
import type { ComponentProps } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/** An organisation's logo, or its initials while it loads or when there is none. */
const OrganizationLogo = ({
	organization,
	size,
	className,
}: {
	organization: {
		name: string;
		logo?: string | null;
	};
	size?: ComponentProps<typeof Avatar>["size"];
	className?: string;
}) => {
	const initials = initialsOf(organization.name);

	return (
		<Avatar
			size={size}
			className={cn("rounded-md after:rounded-md", className)}
		>
			{organization.logo ? (
				<AvatarImage
					src={organization.logo}
					alt={organization.name}
					className="rounded-md"
				/>
			) : null}
			<AvatarFallback className="rounded-md">
				{initials || <Building2Icon className="size-4" aria-hidden="true" />}
			</AvatarFallback>
		</Avatar>
	);
};

export { OrganizationLogo };
