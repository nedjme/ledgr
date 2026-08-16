"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.82-.07-1.42-.22-2.05H12v3.72h6.61c-.13 1.09-.86 2.74-2.47 3.85l-.02.15 3.59 2.75.25.02c2.28-2.09 3.56-5.16 3.56-8.44"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.06 7.93-2.88l-3.78-2.9c-1.01.7-2.37 1.19-4.15 1.19-3.17 0-5.86-2.09-6.82-4.98l-.14.01-3.73 2.86-.05.13C3.25 21.3 7.31 24 12 24"
      />
      <path
        fill="#FBBC05"
        d="M5.18 14.42a7.4 7.4 0 0 1-.4-2.4c0-.84.15-1.65.39-2.4l-.01-.16-3.78-2.9-.12.06A11.94 11.94 0 0 0 0 12.02c0 1.93.47 3.76 1.26 5.4z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c2.26 0 3.79.97 4.66 1.78l3.4-3.31C17.94 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.26 6.62l3.91 3.02c.97-2.89 3.66-4.89 6.83-4.89"
      />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";

  function callbackUrl() {
    const url = new URL("/auth/callback", window.location.origin);
    url.searchParams.set("next", next);
    return url.toString();
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl() },
    });
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in to Ledgr</CardTitle>
          <CardDescription>
            Track spending together.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            size="lg"
            variant="outline"
            className="w-full gap-3 bg-background text-foreground"
            onClick={signInWithGoogle}
          >
            <GoogleIcon className="size-5" />
            Continue with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
