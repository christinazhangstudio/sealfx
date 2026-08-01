import type { Metadata } from "next";
import ChangelogCard from "@/components/ChangelogCard";
import LegalLayout from "../legal-layout";

export const metadata: Metadata = {
  title: "About — Sealift",
  description: "About Sealift and its development history.",
};

export default function AboutPage() {
  return (
    <LegalLayout title="About">
      <p className="text-[var(--color-text-secondary)]">
        Sealift is a multi-store marketplace manager built to keep seller operations in one place.
      </p>
      <ChangelogCard />
    </LegalLayout>
  );
}
