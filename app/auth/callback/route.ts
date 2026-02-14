import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  
  console.log("==============================================");
  console.log("[Auth Callback] FULL URL:", request.url);
  console.log("[Auth Callback] All params:", Object.fromEntries(requestUrl.searchParams.entries()));
  console.log("==============================================");
  
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
    console.log("[Auth Callback] Verifying OTP...");
    const { data, error } = await supabase.auth.verifyOtp({
      type: type as any,
      token_hash,
    });

    if (error) {
      console.error("[Auth Callback] OTP verification failed:", error);
      return NextResponse.redirect(
        new URL(
          `/login?error=confirmation_failed&message=${encodeURIComponent(error?.message || "Confirmation failed")}`,
          requestUrl.origin
        )
      );
    }

    if (data.user && data.session) {
      console.log("[Auth Callback] Email confirmed for user:", data.user.id);
      
      // Create a new client with the session to ensure RLS policies work
      const authenticatedSupabase = createClient(supabaseUrl, supabaseKey, {
        global: {
          headers: {
            Authorization: `Bearer ${data.session.access_token}`,
          },
        },
      });

      // Check if user profile exists, if not create it
      console.log("[Auth Callback] Checking if profile exists...");
      const { data: profile, error: profileError } = await authenticatedSupabase
        .from("user_profiles")
        .select("id")
        .eq("id", data.user.id)
        .maybeSingle();

      if (!profile && !profileError) {
        console.log("[Auth Callback] Profile doesn't exist, creating...");
        // Profile doesn't exist, create it
        const { error: createError } = await authenticatedSupabase
          .from("user_profiles")
          .insert({
            id: data.user.id,
            email: data.user.email!,
            name: data.user.user_metadata?.name || data.user.email!.split("@")[0],
            is_owner: false,
          });

        if (createError) {
          console.error("[Auth Callback] Failed to create profile:", createError);
          // Continue anyway - user can still log in
        } else {
          console.log("[Auth Callback] Profile created successfully");
        }
      } else if (profile) {
        console.log("[Auth Callback] Profile already exists");
      } else if (profileError) {
        console.error("[Auth Callback] Error checking profile:", profileError);
      }

      console.log("[Auth Callback] Redirecting to login...");
      // Redirect to login with success message
      return NextResponse.redirect(
        new URL(`/login?confirmed=true`, requestUrl.origin)
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
