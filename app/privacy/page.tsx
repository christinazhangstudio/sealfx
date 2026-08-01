import type { Metadata } from "next";
import LegalLayout, { Section } from "../legal-layout";

export const metadata: Metadata = {
    title: "Privacy Policy — Sealift",
    description: "What Sealift collects, why, and what it does with it.",
};

// NOTE FOR MAINTAINERS: this describes what the code actually does today. If you
// change what is collected, stored, or shared — especially the eBay credential
// handling or the AI features — update this page in the same change.

export default function PrivacyPage() {
    return (
        <LegalLayout title="Privacy Policy" updated="29 July 2026">
            <p className="text-[var(--color-text-secondary)]">
                This policy explains what Sealift collects, why it needs it, where it goes, and how
                to get rid of it. It describes how the service actually works rather than reserving
                every right we could imagine wanting later.
            </p>

            <Section heading="Who we are">
                <p>
                    Sealift is operated by <strong>[LEGAL ENTITY NAME]</strong> ("Sealift", "we").
                    For any privacy question, or to exercise any right described here, contact{" "}
                    <strong>[PRIVACY CONTACT EMAIL]</strong>.
                </p>
            </Section>

            <Section heading="What we collect">
                <p>
                    <strong>Your account.</strong> The email address you register with and a hash of
                    your password. We never store your password itself — it is hashed with argon2,
                    verified on our server, and cannot be recovered or read back, by us or anyone else.
                </p>
                <p>
                    <strong>Your eBay developer keys.</strong> The App ID, Dev ID, Cert ID and RuName
                    you provide so Sealift can identify itself to eBay as you. After you save them we
                    only ever display a masked hint of the Cert ID, never the value.
                </p>
                <p>
                    <strong>eBay access tokens.</strong> When you authorize a seller account, eBay
                    issues Sealift tokens that let it read that account's data. We store them, along
                    with when they expire, so you don't have to reauthorize constantly.
                </p>
                <p>
                    <strong>eBay notifications.</strong> When you subscribe a seller to a notification
                    topic, eBay sends us those events and we store them so your inbox has history.
                    For buyer messages this includes the message content, subject, and the eBay
                    usernames involved.
                </p>
                <p>
                    <strong>Images you upload.</strong> Photos you add in Create Listing are sent to
                    our AI service to generate a description. They are processed to produce that text
                    and are not stored afterwards.
                </p>
                <p>
                    <strong>A session cookie.</strong> Required to keep you signed in. We do not use
                    advertising cookies, and we do not run third-party analytics or tracking scripts.
                </p>
                <p>
                    <strong>In your browser only.</strong> A counter of how many API calls the app has
                    made, kept in your browser's local storage so the usage indicator works. It never
                    reaches our servers, and clearing your browser data erases it.
                </p>
            </Section>

            <Section heading="What we read but do not keep">
                <p>
                    Your listings, payouts, transaction summaries and account balances are fetched
                    from eBay when you open a page and sent straight to your browser. Sealift does not
                    keep its own copy of them. Close the page and that data is gone from our side; the
                    authoritative record stays with eBay.
                </p>
            </Section>

            <Section heading="Why we need it">
                <p>
                    Every item above exists to make the product work: to sign you in, to talk to eBay
                    on your behalf, to show your inbox, and to generate listing text you asked for. We
                    do not sell personal data, we do not share it for advertising, and we do not use
                    your data to train AI models.
                </p>
            </Section>

            <Section heading="Who else sees it">
                <p>
                    <strong>eBay.</strong> Unavoidably — Sealift is a client for their API. Your use of
                    eBay remains governed by eBay's own terms and privacy policy.
                </p>
                <p>
                    <strong>Our hosting and network provider.</strong> Traffic to Sealift passes
                    through Cloudflare before reaching our servers.
                </p>
                <p>
                    <strong>Our AI service.</strong> AI features (the assistant and listing-description
                    generation) run on hardware we operate ourselves. Your questions and uploaded
                    images are not sent to a third-party AI provider such as OpenAI or Google, and are
                    not used to train anything.
                </p>
                <p>
                    We will also disclose data if we are legally required to, and we will tell you
                    when we are permitted to do so.
                </p>
            </Section>

            <Section heading="How it is protected">
                <p>
                    Traffic to Sealift is encrypted in transit (HTTPS). Passwords are stored only as
                    argon2 hashes. Access to your data is scoped to your account, and our servers
                    reject requests that aren't authenticated as you.
                </p>
                <p>
                    Your eBay Cert ID and the access tokens for your seller accounts are encrypted
                    at rest with AES-256-GCM, using a key held separately from the database. Someone
                    who obtained a copy of the database would not be able to read them. They are
                    decrypted only in memory, at the moment a request needs to call eBay on your
                    behalf, and are never sent back to your browser — Settings shows only a masked
                    hint of your Cert ID.
                </p>
                <p>
                    Even so, treat your Cert ID the way you would any password. If you ever suspect
                    it has been exposed, rotate it in the eBay Developer portal and update it on
                    Sealift's Settings page.
                </p>
                <p>
                    No service can promise perfect security, and we are not going to pretend otherwise.
                </p>
            </Section>

            <Section heading="How long we keep it">
                <p>
                    Account details, eBay keys, tokens and stored notifications are kept until
                    you delete them or delete your account. Short-lived security records expire
                    automatically: password reset links within an hour, sign-in security tokens within
                    a day.
                </p>
            </Section>

            <Section heading="Deleting your data">
                <p>
                    You can delete individual notifications at any time. Removing a seller
                    from the Add Sellers page deletes Sealift's stored tokens for that account and
                    ends its access.
                </p>
                <p>
                    Deleting your account from the Admin page removes your account, your eBay keys,
                    your seller tokens and your notifications. It cannot be undone. One
                    caveat we want to be explicit about: if another Sealift account has also
                    authorized the same eBay seller, that seller's stored notifications are retained
                    because they belong to that account too.
                </p>
                <p>
                    Deleting your Sealift account does not touch your eBay account or your listings —
                    it only removes Sealift's access and the data described above.
                </p>
            </Section>

            <Section heading="Your rights">
                <p>
                    Depending on where you live, you may have the right to access, correct, export or
                    erase your personal data, and to object to how it is processed. Most of this you
                    can do yourself from Settings and Admin. For anything else — including a copy of
                    your data in portable form — contact <strong>[PRIVACY CONTACT EMAIL]</strong> and
                    we will respond within 30 days.
                </p>
            </Section>

            <Section heading="Children">
                <p>
                    Sealift is a tool for eBay sellers and is not intended for anyone under 18. We do
                    not knowingly collect data from children.
                </p>
            </Section>

            <Section heading="Changes">
                <p>
                    If we change this policy in a way that meaningfully affects you, we will tell you
                    before it takes effect rather than quietly editing this page. The date at the top
                    always reflects the current version.
                </p>
            </Section>
        </LegalLayout>
    );
}
