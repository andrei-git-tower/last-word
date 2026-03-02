import { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [exchangingCode, setExchangingCode] = useState(() => !!searchParams.get("code"));

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) return;
    supabase.auth.exchangeCodeForSession(code).finally(() => {
      setSearchParams({}, { replace: true });
      setExchangingCode(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || exchangingCode) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}
