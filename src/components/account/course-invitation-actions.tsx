import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { CourseInvitation } from "@/db/schema/course-invitation";
import { useUmami } from "@/hooks/use-umami";
import { courseInvitationQueryOptions } from "@/lib/query-options/course-invitation";

interface CourseInvitationActionsProps {
	invitation: CourseInvitation;
}

export function CourseInvitationActions({
	invitation,
}: CourseInvitationActionsProps) {
	// TODO: Replace with actual courseId
	const courseId = "placeholder";

	const { mutateAsync: respondToInvitation } = useMutation(
		courseInvitationQueryOptions.respond(),
	);

	const { trackEvent } = useUmami();

	const handleAccept = () => {
		toast.promise(
			respondToInvitation({ courseId, id: invitation.id, response: "accept" }),
			{
				loading: "Accepting invitation...",
				success: () => {
					trackEvent("accept-course-invitation", {
						courseId: invitation.courseId,
					});
					return "Invitation accepted!";
				},
				error: (error) => ({
					message: "Failed to accept invitation",
					description: error.message,
				}),
			},
		);
	};

	const handleReject = () => {
		toast.promise(
			respondToInvitation({ courseId, id: invitation.id, response: "reject" }),
			{
				loading: "Rejecting invitation...",
				success: () => {
					trackEvent("reject-course-invitation", {
						courseId: invitation.courseId,
					});
					return "Invitation rejected!";
				},
				error: (error) => ({
					message: "Failed to reject invitation",
					description: error.message,
				}),
			},
		);
	};

	return (
		<div className="mt-2 flex gap-2">
			<Button onClick={handleAccept} variant="default" size="sm">
				Accept
			</Button>
			<Button onClick={handleReject} variant="destructive" size="sm">
				Reject
			</Button>
		</div>
	);
}
