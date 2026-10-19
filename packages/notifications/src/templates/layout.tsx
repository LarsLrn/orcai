import type { Locale } from "@orcai/schema";
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
import { m } from "../paraglide/messages";

export function EmailLayout(props: {
	locale: Locale;
	recipientName: string | undefined;
	preview: string;
	title: string;
	children: ReactNode;
	actionLabel: string;
	actionUrl: string;
}) {
	const { locale } = props;
	return (
		<Html lang={locale}>
			<Head />
			<Preview>{props.preview}</Preview>
			<Body style={styles.body}>
				<Container style={styles.container}>
					<Heading style={styles.brand}>OrcAI</Heading>
					<Heading style={styles.heading}>{props.title}</Heading>
					<Text style={paragraphStyle}>
						{props.recipientName
							? m.email_layout_greeting(
									{
										name: props.recipientName,
									},
									{
										locale,
									},
								)
							: m.email_layout_greeting_anonymous(
									{},
									{
										locale,
									},
								)}
					</Text>
					{props.children}
					<Section style={styles.action}>
						<Button href={props.actionUrl} style={styles.button}>
							{props.actionLabel}
						</Button>
					</Section>
					<Text style={styles.fallback}>
						{m.email_layout_fallback(
							{},
							{
								locale,
							},
						)}
						{"\n"}
						{props.actionUrl}
					</Text>
					<Hr style={styles.hr} />
					<Text style={styles.footer}>
						{m.email_layout_footer(
							{},
							{
								locale,
							},
						)}
					</Text>
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
