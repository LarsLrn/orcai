import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Hr,
	Html,
	Preview,
	Section,
	Text,
} from "@react-email/components";
import type { ReactNode } from "react";

export function EmailLayout(props: {
	preview: string;
	title: string;
	children: ReactNode;
	actionLabel: string;
	actionUrl: string;
}) {
	return (
		<Html>
			<Head />
			<Preview>{props.preview}</Preview>
			<Body style={styles.body}>
				<Container style={styles.container}>
					<Heading style={styles.brand}>OrcAI</Heading>
					<Heading style={styles.heading}>{props.title}</Heading>
					{props.children}
					<Section style={styles.action}>
						<Button href={props.actionUrl} style={styles.button}>
							{props.actionLabel}
						</Button>
					</Section>
					<Text style={styles.fallback}>
						If the button does not work, copy this link into your browser:
						{"\n"}
						{props.actionUrl}
					</Text>
					<Hr style={styles.hr} />
					<Text style={styles.footer}>This message was sent by OrcAI.</Text>
				</Container>
			</Body>
		</Html>
	);
}

export const paragraphStyle = {
	color: "#374151",
	fontSize: "16px",
	lineHeight: "24px",
};

const styles = {
	body: {
		backgroundColor: "#f3f4f6",
		fontFamily: "Arial, sans-serif",
		margin: 0,
	},
	container: {
		backgroundColor: "#ffffff",
		margin: "32px auto",
		maxWidth: "560px",
		padding: "32px",
	},
	brand: {
		color: "#111827",
		fontSize: "20px",
		margin: "0 0 28px",
	},
	heading: {
		color: "#111827",
		fontSize: "26px",
		margin: "0 0 20px",
	},
	action: {
		margin: "28px 0",
	},
	button: {
		backgroundColor: "#111827",
		borderRadius: "6px",
		color: "#ffffff",
		padding: "12px 20px",
		textDecoration: "none",
	},
	fallback: {
		color: "#6b7280",
		fontSize: "12px",
		lineHeight: "18px",
		wordBreak: "break-all" as const,
	},
	hr: {
		borderColor: "#e5e7eb",
		margin: "28px 0 16px",
	},
	footer: {
		color: "#9ca3af",
		fontSize: "12px",
	},
};
