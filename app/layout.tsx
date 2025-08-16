import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { DateTimeProvider } from "@/contexts/DateTimeContext";
import { AuthProvider } from "@/contexts/AuthContext";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "FoodMood POS",
  description: "",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-title" content="FoodMood POS" />
      </head>
      <body
        className={`${poppins.variable} antialiased`}
      >
        <AuthProvider>
          <DateTimeProvider>
            {children}
          </DateTimeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
