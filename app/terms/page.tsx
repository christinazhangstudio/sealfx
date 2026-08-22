import type { Metadata } from "next";
import LegalLayout, { Section } from "../legal-layout";

export const metadata: Metadata = {
    title: "Terms of Service — Sealift",
    description: "The agreement between you and Sealift.",
};

// NOTE FOR MAINTAINERS: the sections on fees, cancellation and liability assume
// a paid subscription that does not exist yet. Revisit them when billing ships —
// particularly the refund terms, which must match what checkout actually does.

export default function TermsPage() {
    return (
        <LegalLayout title="Terms of Service" updated="29 July 2026">
            <p className="text-[var(--color-text-secondary)]">
                These terms govern your use of Sealift. By creating an account you agree to them.
                We have tried to keep them readable; where something is a genuine limit on what you
                can expect from us, we say so plainly rather than burying it.
            </p>

            <Section heading="Who you are agreeing with">
                <p>
                    Sealift is operated by <strong>[LEGAL ENTITY NAME]</strong> (“Sealift”, “we”).
                    These terms are governed by the laws of <strong>[JURISDICTION]</strong>. Questions
                    about them go to <strong>[SUPPORT EMAIL]</strong>.
                </p>
            </Section>

            <Section heading="What Sealift is">
                <p>
                    Sealift is a dashboard that connects to your eBay seller accounts and shows your
                    listings, payouts, transactions, account balances and buyer notifications in one
                    place. It also offers AI assistance for drafting listing descriptions and
                    answering questions about the product.
                </p>
                <p>
                    Sealift is an independent tool. It is not affiliated with, endorsed by, or
                    operated by eBay.
                </p>
            </Section>

            <Section heading="Your account">
                <p>
                    You must be at least 18 and provide accurate registration details. You are
                    responsible for keeping your password secure and for activity that happens under
                    your account. Tell us promptly at <strong>[SUPPORT EMAIL]</strong> if you believe
                    it has been compromised.
                </p>
                <p>
                    One person or business per account. Do not share credentials with people outside
                    your organisation.
                </p>
            </Section>

            <Section heading="Your eBay connection">
                <p>
                    Sealift needs your eBay developer keys and your authorization to access your
                    seller accounts. You confirm that you own or are authorized to use the eBay
                    accounts you connect, and that doing so does not breach your agreements with eBay.
                </p>
                <p>
                    Your use of eBay remains subject to eBay’s terms. Sealift’s access is limited to
                    what you grant and what eBay permits, and API usage against your keys counts
                    against your own eBay limits. You can revoke access at any time by removing the
                    seller in Sealift or withdrawing consent in eBay.
                </p>
            </Section>

            <Section heading="Acceptable use">
                <p>You agree not to:</p>
                <ul className="list-disc pl-6 space-y-1">
                    <li>connect eBay accounts you are not authorized to access</li>
                    <li>attempt to access another Sealift customer’s data</li>
                    <li>probe, scan, or interfere with the service or the infrastructure behind it</li>
                    <li>resell or redistribute Sealift’s output as your own competing service</li>
                    <li>use it for anything unlawful, or to violate eBay’s rules</li>
                    <li>automate abusive request volumes against Sealift or, through it, eBay</li>
                </ul>
                <p>
                    We may suspend accounts that do these things, and will tell you why when we
                    reasonably can.
                </p>
            </Section>

            <Section heading="AI features">
                <p>
                    AI-generated listing descriptions and assistant answers are suggestions, not
                    advice. They can be wrong. Review anything the AI produces before publishing it or
                    relying on it — particularly item descriptions, which become your representation
                    to a buyer. You are responsible for what you publish.
                </p>
                <p>
                    You keep ownership of the content you upload and of the descriptions generated
                    from it. We do not use your data to train AI models.
                </p>
            </Section>

            <Section heading="Your data">
                <p>
                    Your data stays yours. What we collect and why is described in our{" "}
                    <a href="/privacy" className="underline hover:text-[var(--color-primary)]">
                        Privacy Policy
                    </a>
                    , which forms part of these terms. You can delete your data and your account at
                    any time from within the app.
                </p>
            </Section>

            <Section heading="Fees">
                <p>
                    Paid plans, when offered, are billed in advance for the period shown at checkout
                    and renew automatically until cancelled. You can cancel at any time and keep
                    access until the end of the period you have paid for. We will give at least 30
                    days’ notice before changing the price of an existing subscription.
                </p>
                <p>
                    Sealift is currently provided free of charge. If that changes we will tell you
                    before you are asked to pay for anything.
                </p>
            </Section>

            <Section heading="Availability, and what we do not promise">
                <p>
                    We work to keep Sealift available and correct, but we do not guarantee
                    uninterrupted service. Sealift depends on eBay’s APIs: when eBay is slow, down,
                    rate-limits your keys, or changes its interfaces, parts of Sealift will not work,
                    and that is outside our control.
                </p>
                <p>
                    <strong>Sealift is a reporting tool, not a system of record.</strong> Figures shown
                    are derived from eBay’s data and may be delayed, incomplete, or wrong. Do not rely
                    on Sealift alone for accounting, tax filing, or any financial or legal decision —
                    verify against eBay’s own reports. To the extent the law allows, the service is
                    provided “as is” without warranties.
                </p>
            </Section>

            <Section heading="Limitation of liability">
                <p>
                    To the fullest extent permitted by law, Sealift is not liable for indirect or
                    consequential losses, lost profits, lost sales, or lost or inaccurate data arising
                    from your use of the service. Our total liability for any claim is limited to the
                    greater of the amount you paid us in the 12 months before the claim, or
                    <strong> [MINIMUM LIABILITY AMOUNT]</strong>.
                </p>
                <p>
                    Nothing here excludes liability that cannot lawfully be excluded, including for
                    fraud, or for death or personal injury caused by negligence. Some jurisdictions do
                    not allow certain exclusions, in which case they do not apply to you.
                </p>
            </Section>

            <Section heading="Ending the agreement">
                <p>
                    You can stop using Sealift and delete your account at any time from the Admin page.
                    We may suspend or close an account that breaches these terms, that we are legally
                    required to close, or if we discontinue the service — in which case we will give
                    reasonable notice and, for a paid plan, refund the unused portion.
                </p>
            </Section>

            <Section heading="Changes to these terms">
                <p>
                    We may update these terms. For material changes we will give notice before they
                    take effect; continuing to use Sealift afterwards means you accept them. The date
                    at the top always reflects the current version.
                </p>
            </Section>
        </LegalLayout>
    );
}
