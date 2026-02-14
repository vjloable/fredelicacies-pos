import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const token_hash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const next = requestUrl.searchParams.get("next") ?? "/login";

  // Create a Supabase client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Handle email confirmation
  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      type: type as any,
      token_hash,
    });

    if (!error && data.user) {
      // Email confirmed successfully
      // Check if user profile exists, if not create it
      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("id", data.user.id)
        .single();

      if (profileError && profileError.code === "PGRST116") {
        // Profile doesn't exist, create it
        // Note: At this point the user has a valid session so RLS should allow this
        const { error: createError } = await supabase
          .from("user_profiles")
          .insert({
            id: data.user.id,
            email: data.user.email!,
            name: data.user.user_metadata?.name || data.user.email!.split("@")[0],
            is_owner: false,
          });

        if (createError) {
          console.error("Failed to create profile after confirmation:", createError);
        }
      }

      // Redirect to login with success message
      return NextResponse.redirect(
        new URL(`/login?confirmed=true`, requestUrl.origin)
      );
    } else {
      console.error("Email confirmation error:", error);
      // Redirect to login with error
      return NextResponse.redirect(
        new URL(
          `/login?error=confirmation_failed&message=${encodeURIComponent(error?.message || "Confirmation failed")}`,
          requestUrl.origin
        )
      );
    }
  }

  // Handle other auth redirects (e.g., password reset)
  const code = requestUrl.searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    } else {
      console.error("Code exchange error:", error);
      return NextResponse.redirect(
        new URL(
          `/login?error=auth_failed&message=${encodeURIComponent(error.message)}`,
          requestUrl.origin
        )
      );
    }
  }

  // No token or code provided, redirect to login
  return NextResponse.redirect(new URL("/login", requestUrl.origin));
}
