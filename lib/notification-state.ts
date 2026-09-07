import { trackedFetch as fetch } from "@/lib/api-tracker";

export interface NotifEnvelope {
    notif: any;
    user: string;
    id: string;
    read: boolean;
    trashed: boolean;
}

export function messageSelectionKey(message: Pick<NotifEnvelope, "user" | "id">): string {
    return `${message.user}\u0000${message.id}`;
}

export function mergeNotifications(previous: NotifEnvelope[], incoming: NotifEnvelope[]): NotifEnvelope[] {
    const keys = new Set(previous.map(messageSelectionKey));
    const fresh = incoming.filter((message) => {
        const key = messageSelectionKey(message);
        if (keys.has(key)) return false;
        keys.add(key);
        return true;
    });
    if (fresh.length === 0) return previous;
    return [...fresh, ...previous].sort((a, b) => {
        const aDate = a.notif?.notification?.eventDate ?? a.notif?.notification?.publishDate ?? "";
        const bDate = b.notif?.notification?.eventDate ?? b.notif?.notification?.publishDate ?? "";
        return bDate.localeCompare(aDate);
    }).slice(0, 200);
}

export type NotificationAction = "read" | "trash" | "delete";

interface MutationOptions {
    action: NotificationAction;
    message: NotifEnvelope;
    localOnly: boolean;
    apiBaseUrl?: string;
    inboxUri?: string;
    actionUri?: string;
    update: (apply: (current: NotifEnvelope[]) => NotifEnvelope[]) => void;
}

/** Persist one seller's message state, retaining a failed deletion for retry. */
export async function mutateNotification({
    action, message, localOnly, apiBaseUrl, inboxUri, actionUri, update,
}: MutationOptions): Promise<void> {
    const key = messageSelectionKey(message);
    const matches = (candidate: NotifEnvelope) => messageSelectionKey(candidate) === key;
    const property = action === "read" ? "read" : "trashed";
    if (action !== "delete" && message[property]) return;

    // A missing route is a failure, never a successful local change for members.
    if (!localOnly && (!apiBaseUrl || !inboxUri || !actionUri)) {
        throw new Error("Inbox API configuration is incomplete. Please try again later.");
    }

    const remove = () => update((current) => current.filter((candidate) => !matches(candidate)));
    const setState = (value: boolean) => update((current) => current.map((candidate) =>
        matches(candidate) ? { ...candidate, [property]: value } : candidate,
    ));

    if (localOnly) {
        if (action === "delete") remove();
        else setState(true);
        return;
    }

    if (action !== "delete") setState(true);
    try {
        const response = await fetch(
            `${apiBaseUrl}/${inboxUri}/${encodeURIComponent(message.user)}/${encodeURIComponent(message.id)}/${actionUri}`,
            { method: action === "delete" ? "DELETE" : "PUT" },
        );
        if (!response.ok) {
            const label = action === "read" ? "mark message as read" : `${action} message`;
            throw new Error(`Could not ${label} (${response.status}). Please try again.`);
        }
        // Permanent deletion waits for confirmation. Failed requests leave the
        // message visible, including when other messages arrive during the call.
        if (action === "delete") remove();
    } catch (error) {
        if (action !== "delete") setState(message[property]);
        throw error;
    }
}
