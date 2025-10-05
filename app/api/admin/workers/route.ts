import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { authService } from "@/services/authService";

export async function POST(request: NextRequest) {
	try {
		const { userData } = await request.json();

		if (!userData || !userData.email) {
			return NextResponse.json({ error: "Email is required" }, { status: 400 });
		}

		// Check if user with email already exists
		let existingUser = null;
		try {
			existingUser = await adminAuth.getUserByEmail(userData.email);
		} catch (error: any) {
			// User doesn't exist, which is what we want for creation
			if (error.code !== "auth/user-not-found") {
				throw error;
			}
		}

		if (existingUser) {
			return NextResponse.json({
				success: true,
				userId: existingUser.uid,
				message: "Worker already exists",
			});
		}

		const userRecord = await adminAuth.createUser({
			email: userData.email,
			password: userData.password,
			displayName: userData.name,
			emailVerified: false,
		});

		return NextResponse.json({
			success: true,
			userId: userRecord.uid,
			message: "Worker created successfully",
		});
	} catch (error: any) {
		console.error("Error creating worker:", error);
		if (error.code === "auth/email-already-exists") {
			throw new Error("Email already exists");
		}
		if (error.code === "auth/weak-password") {
			throw new Error("Password is too weak (minimum 6 characters)");
		}
		if (error.code === "auth/invalid-email") {
			throw new Error("Invalid email address");
		}
		return NextResponse.json(
			{ error: error.message || "Failed to create worker" },
			{ status: 500 }
		);
	}
}
