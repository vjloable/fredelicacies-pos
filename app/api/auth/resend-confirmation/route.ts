import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Resend confirmation email using Supabase
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email,
    });

    if (error) {
      console.error("Error resending confirmation email:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: "Confirmation email resent successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Resend confirmation error:", error);
    return NextResponse.json(
      { error: "Failed to resend confirmation email" },
      { status: 500 }
    );
  }
}
