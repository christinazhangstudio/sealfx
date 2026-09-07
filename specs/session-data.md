# Private data lifetime

`SessionDataBoundary` separates account data from the long-lived app layout.
When the session changes to another tenant, a guest, or no account, it unmounts
the users, notifications, and page components before clearing listings data.
The next identity then mounts with a new SWR cache. A late users response,
notification event, or SWR response from the old tree cannot update the new one.

The key uses the JWT subject exposed by the session callback, with email as a
fallback for older sessions. It excludes expiration time and session object
identity, so routine token renewal preserves private state within the same
account. Private pages wait for an unresolved session without a user. Login,
registration, password recovery, and legal pages immediately render with empty
anonymous providers, preserving server-rendered content and form input while
the initial session lookup is pending.

Tracking and Calendar use `loadListingItem` for listing photos outside their
normal date range. The loader retains the original seller store while fetching
and discards its result if that store was cleared before the response arrived.

The existing guest request gate and sandbox inbox fixtures still apply inside
the boundary. Signing out in a different browser tab now clears this tab when
Auth.js reports the session change, as does a direct account switch.

Run the behavioral regression tests with Node 24+ after installing development
dependencies:

```sh
node --test lib/session-*.test.mjs
```
