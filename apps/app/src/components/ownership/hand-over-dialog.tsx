import type { ContentReceiver, ResourceIdentity } from "@orcai/schema";
import { useState } from "react";
import { ReceiverPicker } from "@/components/ownership/receiver-picker";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useHandOverMutation } from "@/hooks/mutations/use-ownership-mutations";
import { m } from "@/paraglide/messages";

type HandOverProps = {
	resource: ResourceIdentity;
	name: string;
	onDone: () => void;
};

const HandOverContent = ({ resource, name, onDone }: HandOverProps) => {
	const [receiver, setReceiver] = useState<ContentReceiver | null>(null);
	const handOver = useHandOverMutation(name, {
		onSuccess: onDone,
	});

	return (
		<>
			<DialogHeader>
				<DialogTitle>
					{m.ownership_hand_over_title({
						name,
					})}
				</DialogTitle>
				<DialogDescription>
					{m.ownership_hand_over_description()}
				</DialogDescription>
			</DialogHeader>
			<ReceiverPicker
				source={{
					kind: "item",
					resource,
				}}
				value={receiver}
				onChange={setReceiver}
				disabled={handOver.isPending}
			/>
			{receiver ? (
				<p className="text-sm">
					{m.ownership_hand_over_confirm({
						name: receiver.name,
					})}
				</p>
			) : null}
			<DialogFooter>
				<Button
					variant="outline"
					disabled={handOver.isPending}
					onClick={onDone}
				>
					{m.common_cancel_button()}
				</Button>
				<Button
					disabled={!receiver}
					loading={handOver.isPending}
					onClick={() =>
						receiver &&
						handOver.mutate({
							...resource,
							receiverId: receiver.id,
						})
					}
				>
					{m.ownership_hand_over_action()}
				</Button>
			</DialogFooter>
		</>
	);
};

/** The owner hands a bot, block or asset to a member who may own it, and keeps Can manage. */
export const HandOverDialog = ({
	open,
	onOpenChange,
	resource,
	name,
}: Omit<HandOverProps, "onDone"> & {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) => (
	<Dialog open={open} onOpenChange={onOpenChange}>
		<DialogContent>
			<HandOverContent
				resource={resource}
				name={name}
				onDone={() => onOpenChange(false)}
			/>
		</DialogContent>
	</Dialog>
);
