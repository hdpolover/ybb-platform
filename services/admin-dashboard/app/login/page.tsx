import LoginPageClient from "./LoginPageClient";
import { getLoginRedirectMessage } from "@/src/shared/login-redirect";

type LoginPageProps = {
  searchParams: Promise<{
    reason?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = await searchParams;
  const redirectMessage = getLoginRedirectMessage(resolvedSearchParams.reason ?? null);

  return <LoginPageClient redirectMessage={redirectMessage} />;
}

