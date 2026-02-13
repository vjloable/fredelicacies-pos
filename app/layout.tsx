import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { DateTimeProvider } from "@/contexts/DateTimeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { TimeTrackingProvider } from "@/contexts/TimeTrackingContext";
import { BranchProvider } from "@/contexts/BranchContext";

const poppins = Poppins({
	variable: "--font-poppins",
	subsets: ["latin"],
	weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
	title: "Fredelicacies POS",
	description: "",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang='en'>
			<head>
        <meta name="apple-mobile-web-app-title" content="Fredelicacies POS" />
			</head>
			<body className={`${poppins.variable} antialiased`}>
				<AuthProvider>
					<TimeTrackingProvider options={{ autoRefresh: true }}>
						<BranchProvider>
							<DateTimeProvider>{children}</DateTimeProvider>
						</BranchProvider>
					</TimeTrackingProvider>
				</AuthProvider>
			</body>
		</html>
	);
}
