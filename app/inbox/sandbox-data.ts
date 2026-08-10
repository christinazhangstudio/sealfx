export const SANDBOX_SELLER = "czhang19";

const ebayMessage = ({
    id,
    date,
    subject,
    body,
    read = false,
}: {
    id: string;
    date: string;
    subject: string;
    body: string;
    read?: boolean;
}) => ({
    metadata: {
        deprecated: false,
        schemaVersion: "1.0",
        source: "MESSAGE_API",
        topic: "NEW_MESSAGE",
    },
    notification: {
        data: {
            conversationId: id.replace("ebay-message-", ""),
            conversationType: "FROM_EBAY",
            createdDate: date,
            messageBody: body,
            messageId: id.replace("ebay-message-", ""),
            messageMedia: null,
            readStatus: read,
            recipientUserName: SANDBOX_SELLER,
            senderUserName: "eBay",
            subject,
        },
        eventDate: date,
        notificationId: id,
        publishAttemptCount: 1,
        publishDate: date,
    },
    sealift_read: read,
    sealift_trashed: false,
});

const marketingFooter = `
Your opinion matters. Rate this email.

*Results are based on eBay marketplace data. Results may vary.
eBay Inc., 2025 Hamilton Avenue, San Jose, CA 95125, United States
© 1995–2025 eBay Inc. or its affiliates`;

export const SANDBOX_NOTIFICATIONS = [
    ebayMessage({
        id: "ebay-message-202607288597",
        date: "2025-11-07T18:06:57Z",
        subject: "Christina, activate your in-app offer 🚀",
        body: `Your exclusive seller offer is ready

Activate your in-app offer to boost the visibility of your listings and reach more buyers. The offer is available for a limited time.

Activate now${marketingFooter}`,
    }),
    ebayMessage({
        id: "ebay-message-202202468287",
        date: "2025-10-25T18:57:41Z",
        subject: "Don't miss $15 off to boost your listings 🔥",
        body: `Your last chance for $15 off

It’s not too late to save up to $15 off to boost the visibility of your listings. Reach more buyers and sell things faster with this exclusive offer.

Activate now
Ends 12-31-2025. T&Cs apply.

Why boost your listings?
• Show up higher in search
• Control what you spend
• Only pay when you sell${marketingFooter}`,
    }),
    ebayMessage({
        id: "ebay-message-201946293457",
        date: "2025-10-16T18:49:36Z",
        subject: "Get $15 off to help boost your listings 🚀",
        body: `$15 off to boost your visibility

Promote your listings with up to $15 off to reach more buyers. Activate your offer, choose the items you want to boost, and get $15 off ad fees when you sell by 12-31-2025.

Activate
Ends 12-31-2025. T&Cs apply.

Why boost your listings?
• Show up higher in search
• Control what you spend
• Only pay when you sell${marketingFooter}`,
        read: true,
    }),
    ebayMessage({
        id: "ebay-message-200875418867",
        date: "2025-09-10T04:35:58Z",
        subject: "Christina, unlock your daily deal now 🙌",
        body: `Daily mystery deals start now

Unlock today’s limited-time offer, plus a new one every day.

Click to reveal

Hurry—the countdown to your next deal is on!${marketingFooter}`,
    }),
    ebayMessage({
        id: "ebay-message-200144960037",
        date: "2025-08-17T03:59:43Z",
        subject: "A new device is using your account",
        body: `Let’s make sure this was you

Hi Christina,

We noticed a new sign-in on your account at ebay.com.

Time of sign-in
Aug 16, 2025 8:58 PM PST

Device
Unknown

Approximate location
Austin, Texas, United States

If this was you, there’s nothing you need to do. If it wasn’t, please change your password right away.

Change your password`,
    }),
    ebayMessage({
        id: "ebay-message-200144919457",
        date: "2025-08-17T03:55:56Z",
        subject: "A new device is using your account",
        body: `Let’s make sure this was you

Hi Christina,

We noticed a new sign-in on your account at ebay.com.

Time of sign-in
Aug 16, 2025 8:55 PM PST

Device
Unknown

Approximate location
Austin, Texas, United States

If this was you, there’s nothing you need to do. If it wasn’t, please change your password right away.

Change your password`,
    }),
    ebayMessage({
        id: "ebay-message-199968596957",
        date: "2025-08-10T23:22:50Z",
        subject: "You’ve removed a payment method from your account.",
        body: `You removed a payment method from your account.

Hi Christina,

As you requested on Sunday, August 10, 2025 at 4:22 PM PDT, we removed a card ending in 0197 from your account.

Location: USA
Device type: Other
Operating system: Android

If you didn’t make this request, please contact us. If this payment method was your preferred option for charges or payouts, you’ll need to select a new one.

Manage payment options`,
    }),
] as const;

