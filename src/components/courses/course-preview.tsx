import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Building2Icon } from "lucide-react";
import { Placeholder } from "@/components/placeholders/placeholder";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import type { Organization } from "@/db/schema/organization";
import { orpc } from "@/lib/orpc/orpc";

const OrganizationPreview = ({
	organizationId,
}: {
	organizationId: Organization["id"];
}) => {
	const {
		data: organization,
		status,
		error,
	} = useQuery(
		orpc.organization.find.queryOptions({
			input: { id: organizationId },
			queryKey: orpc.organization.find.key({
				input: { id: organizationId },
			}),
		}),
	);

	if (status === "pending") {
		return <LoadingSpinner className="h-8 w-8" />;
	}

	if (status === "error") {
		return <Placeholder>{error.message}</Placeholder>;
	}

	if (!organization) {
		return <Placeholder>No such organisation</Placeholder>;
	}

	const { name, slug } = organization.data;

	return (
		<Card>
			<CardHeader className="flex flex-col justify-between sm:flex-row">
				<div className="flex flex-col gap-1">
					<p className="text-muted-foreground text-xs">Organisation</p>
					<CardTitle className="flex items-center gap-2">
						<Building2Icon className="size-5" />
						{name}
					</CardTitle>
				</div>
				<Link
					to={"/app/orgs/$orgId"}
					params={{ orgId: organizationId }}
					className={buttonVariants({ variant: "outline", size: "sm" })}
				>
					About the organisation
				</Link>
			</CardHeader>
			<CardContent>{slug}</CardContent>
		</Card>
	);
};

export { OrganizationPreview };
