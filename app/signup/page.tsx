"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authService } from "@/services/authService";
import LogoVerticalIcon from "@/components/icons/LogoVerticalIcon";
import Link from "next/link";
import VersionDisplay from "@/components/VersionDisplay";

interface SignUpFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface ValidationErrors {
  emailTaken?: boolean;
}

export default function SignUpPage() {
  const [formData, setFormData] = useState<SignUpFormData>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const router = useRouter();

  // Note: Email availability check removed as it's handled during sign up
  // Supabase will return an error if email already exists

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    // Validation
    if (!formData.firstName.trim()) {
      setError("First name is required");
      setIsLoading(false);
      return;
    }

    if (!formData.lastName.trim()) {
      setError("Last name is required");
      setIsLoading(false);
      return;
    }

    if (!formData.email.trim()) {
      setError("Email is required");
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long");
      setIsLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    try {
      // Create user account with Supabase
      const fullName = `${formData.firstName.trim()} ${formData.lastName.trim()}`;
      const { userId, error: signUpError } = await authService.signUp({
        email: formData.email,
        password: formData.password,
        name: fullName,
        isOwner: false, // New users are not admin by default
      });

      if (signUpError) {
        throw signUpError;
      }

      // Always redirect to waiting room after signup
      router.push("/waiting-room");
    } catch (error: unknown) {
      console.error("Sign up error:", error);

      // Handle Supabase auth errors
      let errorMessage = "Sign up failed. Please try again.";
      
      if (error && typeof error === 'object' && 'message' in error) {
        const errMsg = (error as { message: string }).message.toLowerCase();
        
        if (errMsg.includes('already registered') || errMsg.includes('already exists')) {
          errorMessage = "An account with this email already exists.";
          setValidationErrors(prev => ({ ...prev, emailTaken: true }));
        } else if (errMsg.includes('invalid email')) {
          errorMessage = "Invalid email address.";
        } else if (errMsg.includes('password')) {
          errorMessage = "Password is too weak. Please choose a stronger password.";
        } else {
          errorMessage = (error as { message: string }).message || "Sign up failed. Please try again.";
        }
      }

      setError(errorMessage);
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof SignUpFormData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    // Clear error when user starts typing
    if (error) setError("");
    
    // Clear validation errors for email field
    if (field === "email") {
      setValidationErrors(prev => ({ ...prev, emailTaken: undefined }));
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8"
      style={{
        backgroundImage: "url('/cover.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="w-full max-w-md">
        {/* Sign Up Form */}
        <div className="bg-white rounded-xl shadow-xl">
          {/* Logo/Header */}
          <div className="text-center mb-8">
            <div className="w-full h-full mx-auto mb-4 flex items-center justify-center bg-primary py-6 shadow-md rounded-t-xl">
              <div className="w-41.25 h-30">
                <LogoVerticalIcon />
              </div>
            </div>
          </div>
          <p className="text-center text-3.5 font-medium text-secondary">
            Create your account
          </p>
          <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name Fields Row */}
              <div className="grid grid-cols-2 gap-4">
                {/* First Name Field */}
                <div>
                  <label className="block text-xs font-medium text-secondary mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={handleInputChange("firstName")}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-md text-3 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                    placeholder="First name"
                    disabled={isLoading}
                    autoComplete="given-name"
                  />
                </div>

                {/* Last Name Field */}
                <div>
                  <label className="block text-xs font-medium text-secondary mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={handleInputChange("lastName")}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-md text-3 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                    placeholder="Last name"
                    disabled={isLoading}
                    autoComplete="family-name"
                  />
                </div>
              </div>

              {/* Email Field */}
              <div>
                <label className="block text-xs font-medium text-secondary mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange("email")}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-md text-3 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                  placeholder="Enter your email"
                  disabled={isLoading}
                  autoComplete="email"
                />
              </div>

              {/* Password Fields */}
              <div className="grid grid-cols-1 gap-4">
                {/* Password Field */}
                <div>
                  <label className="block text-xs font-medium text-secondary mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={handleInputChange("password")}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-md text-3 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                    placeholder="Create password (min. 6 characters)"
                    disabled={isLoading}
                    autoComplete="new-password"
                  />
                </div>

                {/* Confirm Password Field */}
                <div>
                  <label className="block text-xs font-medium text-secondary mb-2">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={handleInputChange("confirmPassword")}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-md text-3 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                    placeholder="Confirm your password"
                    disabled={isLoading}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-5 h-5 text-red-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-xs text-red-700">{error}</span>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={
                  isLoading || 
                  validationErrors.emailTaken
                }
                className={`w-full py-3 rounded-md font-semibold transition-all shadow-lg ${
                  isLoading || 
                  validationErrors.emailTaken
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-accent hover:bg-accent/90 text-white hover:scale-105 active:scale-95"
                }`}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                    Creating account...
                  </div>
                ) : (
                  "CREATE ACCOUNT"
                )}
              </button>
            </form>

            {/* Login Link */}
            <div className="mt-6 text-center">
              <p className="text-xs text-secondary">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="font-medium text-accent hover:text-accent/80 transition-colors"
                >
                  Sign in here
                </Link>
              </p>
            </div>

            {/* Footer */}
            <div className="mt-6 text-center">
              <p className="text-xs text-secondary opacity-50">
                Fredelicacies Point-of-Sales System <VersionDisplay variant="simple" />
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}