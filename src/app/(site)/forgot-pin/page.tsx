import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { InfoBanner } from "@/components/ui/InfoBanner";
import { getShopSettings } from "@/lib/shop-settings";
import { buildTelLink } from "@/lib/phone-link";
import { buildWhatsAppClickToChatUrl, toWhatsAppPhoneDigits } from "@/lib/whatsapp/click-to-chat";

export const metadata: Metadata = {
  title: "Forgot PIN",
};

// No OTP, no SMS, no self-service reset of any kind — a customer can
// only ever get a new PIN through the admin-assisted reset workflow
// (ResetPinDialog / admin_reset_customer_pin(), Phase 12). This page is
// purely informational: it reads the shop's own contact details and
// renders a Call/WhatsApp/Back-to-login set of plain links, nothing
// else. There is no form here, so there is nothing that could change a
// PIN by someone simply opening this page.
export default async function ForgotPinPage() {
  const shop = await getShopSettings();
  const callHref = buildTelLink(shop.shopPhone);

  const whatsappDigits = toWhatsAppPhoneDigits(shop.whatsappNumber);
  const whatsappUrl = whatsappDigits
    ? buildWhatsAppClickToChatUrl(
        whatsappDigits,
        `Hi, I'd like help resetting my ${shop.shopName} account PIN.`,
      )
    : null;

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-foreground">Forgot your PIN?</h1>

      <div className="mt-4">
        <InfoBanner>
          For security reasons, customers cannot reset their PIN directly. Please contact the shop admin to
          reset your PIN.
        </InfoBanner>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {callHref ? (
          <a href={callHref}>
            <Button type="button" size="lg" fullWidth>
              📞 Call Admin
            </Button>
          </a>
        ) : (
          <p className="text-sm text-muted-foreground">
            No contact number is configured yet — please reach out to the shop directly.
          </p>
        )}

        {whatsappUrl && (
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
            <Button type="button" variant="outline" size="lg" fullWidth>
              Contact Admin on WhatsApp
            </Button>
          </a>
        )}

        <Link href="/login">
          <Button type="button" variant="outline" size="lg" fullWidth>
            Back to Login
          </Button>
        </Link>
      </div>
    </div>
  );
}
