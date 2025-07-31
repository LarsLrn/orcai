import { BuildingIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardHeader, CardTitle } from "@/components/ui/card";
import type { Organization } from "@/db/schema/organization";

const OrganizationCard = ({
	organization,
	onSelect,
}: {
	organization: Organization;
	onSelect: () => void;
}) => {
	return (
		<Card className="h-full">
			<CardHeader>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
							<BuildingIcon className="h-6 w-6 text-primary" />
						</div>
						<div className="space-y-1">
							<CardTitle className="text-xl transition-colors group-hover:text-primary">
								{organization.name}
							</CardTitle>
							{organization.slug && (
								<p className="text-muted-foreground text-sm">
									@{organization.slug}
								</p>
							)}
						</div>
					</div>
					<CardAction>
						<Button
							variant="outline"
							size="sm"
							className="transition-all group-hover:bg-primary group-hover:text-primary-foreground"
							tabIndex={-1}
							onClick={onSelect}
							aria-label={`Select ${organization.name} organization`}
						>
							Select
							<ChevronRightIcon className="ml-1 h-4 w-4" />
						</Button>
					</CardAction>
				</div>
			</CardHeader>
		</Card>
	);
};

export { OrganizationCard };
