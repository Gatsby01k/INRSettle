import { isMfaStepUpFresh, requireSession } from "@/lib/auth";
import { PageHeader } from "@/components/ops/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MfaPanel } from "@/components/security/mfa-panel";

export const metadata = { title: "Security settings" };

export default async function SecuritySettingsPage() {
  const { user, session } = await requireSession();
  return (
    <>
      <PageHeader
        eyebrow="Identity assurance"
        title="Security settings"
        description="Enroll TOTP MFA, manage one-time recovery codes, and refresh the short-lived step-up required for approval actions."
      />
      <Card>
        <CardHeader>
          <CardTitle>Authenticator MFA</CardTitle>
          <CardDescription>
            Secrets are AES-256-GCM encrypted. Approval assurance expires after ten minutes and must be refreshed explicitly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MfaPanel
            enabled={user.mfaEnabled}
            stepUpFresh={isMfaStepUpFresh(session)}
            enrolledAt={user.mfaEnrolledAt?.toISOString() ?? null}
          />
        </CardContent>
      </Card>
    </>
  );
}
