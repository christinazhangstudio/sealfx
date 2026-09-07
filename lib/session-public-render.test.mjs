import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToString } from "react-dom/server";
import "./test-module-hooks.mjs";

const { default: SessionDataBoundary } = await import("../components/SessionDataBoundary.tsx");
const { isPublicSessionRoute, sessionDataKey } = await import("./session-data-key.ts");

test("public routes render server content before the initial session lookup resolves", () => {
    for (const pathname of ["/login", "/register", "/forgot-password", "/reset-password", "/about", "/privacy", "/terms"]) {
        const html = renderToString(React.createElement(SessionDataBoundary, {
            identity: sessionDataKey(null, "loading"),
            allowAnonymousWhileLoading: isPublicSessionRoute(pathname),
        }, React.createElement("h1", null, `Content for ${pathname}`)));
        assert.ok(html.includes(`Content for ${pathname}`), `${pathname} lost its server-rendered content`);
    }
});

test("private routes still withhold account content until the session resolves", () => {
    for (const pathname of ["/", "/inbox", "/inventory", "/guest", "/login-settings"]) {
        const html = renderToString(React.createElement(SessionDataBoundary, {
            identity: sessionDataKey(null, "loading"),
            allowAnonymousWhileLoading: isPublicSessionRoute(pathname),
        }, React.createElement("h1", null, "Private account content")));
        assert.equal(html, "", `${pathname} rendered before its session resolved`);
    }
});
