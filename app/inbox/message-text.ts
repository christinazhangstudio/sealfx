const HTML_EMAIL_PATTERN = /<(?:!doctype|html|body|table|div|p|span|a|br|tr|td|th|h[1-6])\b/i;

function normalizeMessageWhitespace(value: string): string {
    return value
        .replace(/\u00a0/g, " ")
        .replace(/\r\n?/g, "\n")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n[ \t]+/g, "\n")
        .replace(/[ \t]{2,}/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

export function messageBodyHasHtml(value: unknown): boolean {
    return HTML_EMAIL_PATTERN.test(String(value ?? ""));
}

export function messageBodyToPlainText(value: unknown): string {
    const source = String(value ?? "").trim();
    if (source === "" || !messageBodyHasHtml(source)) {
        return normalizeMessageWhitespace(source);
    }
    if (typeof DOMParser === "undefined") {
        return normalizeMessageWhitespace(source.replace(/<[^>]*>/g, " "));
    }

    const document = new DOMParser().parseFromString(source, "text/html");
    document.querySelectorAll("script, style, noscript, template, svg, footer, #footer, #ReferenceId").forEach((element) => element.remove());
    document.querySelectorAll("br").forEach((element) => element.replaceWith("\n"));
    document.querySelectorAll("td, th").forEach((element) => element.append(" "));
    document.querySelectorAll("p, div, li, tr, h1, h2, h3, h4, h5, h6").forEach((element) => element.append("\n"));

    return normalizeMessageWhitespace(document.body.textContent ?? "");
}
