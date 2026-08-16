export const SANDBOX_SELLERS = ["czhang19", "zha_5764"] as const;

export interface SandboxOrder {
  orderId: string;
  legacyOrderId: string;
  creationDate: string;
  orderFulfillmentStatus: string;
  orderPaymentStatus: string;
  salesRecordReference?: string;
  buyer?: { username?: string };
  pricingSummary?: {
    total?: { value: string; currency: string };
    deliveryCost?: { value: string; currency: string };
  };
  fulfillmentStartInstructions?: {
    minEstimatedDeliveryDate?: string;
    maxEstimatedDeliveryDate?: string;
    shippingStep?: {
      shippingCarrierCode?: string;
      shippingServiceCode?: string;
      shipTo?: {
        fullName?: string;
        city?: string;
        stateOrProvince?: string;
        postalCode?: string;
        countryCode?: string;
      };
    };
  }[];
  lineItems: {
    lineItemId: string;
    legacyItemId: string;
    title: string;
    sku: string;
    quantity: number;
    lineItemFulfillmentStatus?: string;
    total: { value: string; currency: string };
  }[];
  shippingFulfillments?: {
    fulfillmentId: string;
    shipmentTrackingNumber: string;
    shippingCarrierCode: string;
    shippedDate: string;
  }[];
}

export interface SandboxListing {
  ItemID: string;
  Title: string;
  PictureDetails: {
    GalleryURL: string;
    PictureURLs: string[];
  };
}

export const SANDBOX_ORDERS: Record<string, SandboxOrder[]> = {
  czhang19: [
    {
      orderId: "01-14822-01194",
      legacyOrderId: "01-14822-01194",
      creationDate: "2026-06-23T01:33:29.000Z",
      orderFulfillmentStatus: "FULFILLED",
      orderPaymentStatus: "PAID",
      salesRecordReference: "14822-01194",
      buyer: { username: "austin_buyer92" },
      pricingSummary: {
        total: { value: "144.48", currency: "USD" },
        deliveryCost: { value: "7.49", currency: "USD" },
      },
      fulfillmentStartInstructions: [
        {
          minEstimatedDeliveryDate: "2026-06-26T00:00:00.000Z",
          maxEstimatedDeliveryDate: "2026-06-30T00:00:00.000Z",
          shippingStep: {
            shippingCarrierCode: "USPS",
            shippingServiceCode: "USPSPriority",
            shipTo: {
              fullName: "Alex Rivera",
              city: "Austin",
              stateOrProvince: "TX",
              postalCode: "78704",
              countryCode: "US",
            },
          },
        },
      ],
      lineItems: [
        {
          lineItemId: "10081911587501",
          legacyItemId: "307014723203",
          title: "Elgato 4K60 Pro MK.2 Internal Capture Card",
          sku: "",
          quantity: 1,
          lineItemFulfillmentStatus: "FULFILLED",
          total: { value: "136.99", currency: "USD" },
        },
      ],
      shippingFulfillments: [
        {
          fulfillmentId: "sf-elgato-4k60",
          shipmentTrackingNumber: "9400111899562537875111",
          shippingCarrierCode: "USPS",
          shippedDate: "2026-06-23T16:00:00.000Z",
        },
      ],
    },
    {
      orderId: "06-14804-63293",
      legacyOrderId: "06-14804-63293",
      creationDate: "2026-06-21T07:40:22.000Z",
      orderFulfillmentStatus: "NOT_STARTED",
      orderPaymentStatus: "FULLY_REFUNDED",
      salesRecordReference: "14804-63293",
      buyer: { username: "buildbox_tx" },
      pricingSummary: {
        total: { value: "175.48", currency: "USD" },
        deliveryCost: { value: "7.49", currency: "USD" },
      },
      fulfillmentStartInstructions: [
        {
          minEstimatedDeliveryDate: "2026-06-25T00:00:00.000Z",
          maxEstimatedDeliveryDate: "2026-06-29T00:00:00.000Z",
          shippingStep: {
            shippingCarrierCode: "USPS",
            shippingServiceCode: "USPSGroundAdvantage",
            shipTo: {
              fullName: "Jordan Lee",
              city: "Houston",
              stateOrProvince: "TX",
              postalCode: "77007",
              countryCode: "US",
            },
          },
        },
      ],
      lineItems: [
        {
          lineItemId: "10082682708606",
          legacyItemId: "307014720318",
          title:
            "G. SKILL Trident Z RGB 32GB DDR4 3200 MHz PC4-17000 (F4-3200C16Q-32GTZR)",
          sku: "",
          quantity: 1,
          lineItemFulfillmentStatus: "NOT_STARTED",
          total: { value: "167.99", currency: "USD" },
        },
      ],
    },
    {
      orderId: "13-14791-57660",
      legacyOrderId: "13-14791-57660",
      creationDate: "2026-06-20T20:12:00.000Z",
      orderFulfillmentStatus: "NOT_STARTED",
      orderPaymentStatus: "FULLY_REFUNDED",
      salesRecordReference: "14791-57660",
      buyer: { username: "ssd_hunter", },
      pricingSummary: {
        total: { value: "75.49", currency: "USD" },
        deliveryCost: { value: "6.49", currency: "USD" },
      },
      fulfillmentStartInstructions: [
        {
          minEstimatedDeliveryDate: "2026-06-24T00:00:00.000Z",
          maxEstimatedDeliveryDate: "2026-06-28T00:00:00.000Z",
          shippingStep: {
            shippingCarrierCode: "USPS",
            shippingServiceCode: "USPSGroundAdvantage",
            shipTo: {
              fullName: "Sam Patel",
              city: "Dallas",
              stateOrProvince: "TX",
              postalCode: "75201",
              countryCode: "US",
            },
          },
        },
      ],
      lineItems: [
        {
          lineItemId: "10084076415613",
          legacyItemId: "307014254263",
          title: "Samsung SSD 850 EVO 1TB",
          sku: "",
          quantity: 1,
          lineItemFulfillmentStatus: "NOT_STARTED",
          total: { value: "69.0", currency: "USD" },
        },
      ],
    },
  ],
  zha_5764: [
    {
      orderId: "16-14982-19002",
      legacyOrderId: "16-14982-19002",
      creationDate: "2026-08-05T20:19:36.000Z",
      orderFulfillmentStatus: "NOT_STARTED",
      orderPaymentStatus: "FULLY_REFUNDED",
      salesRecordReference: "14982-19002",
      buyer: { username: "lunchbag_mom" },
      pricingSummary: {
        total: { value: "16.48", currency: "USD" },
        deliveryCost: { value: "4.49", currency: "USD" },
      },
      fulfillmentStartInstructions: [
        {
          minEstimatedDeliveryDate: "2026-08-09T00:00:00.000Z",
          maxEstimatedDeliveryDate: "2026-08-13T00:00:00.000Z",
          shippingStep: {
            shippingCarrierCode: "USPS",
            shippingServiceCode: "USPSGroundAdvantage",
            shipTo: {
              fullName: "Riley Chen",
              city: "Richmond",
              stateOrProvince: "TX",
              postalCode: "77469",
              countryCode: "US",
            },
          },
        },
      ],
      lineItems: [
        {
          lineItemId: "10083884697516",
          legacyItemId: "376392857985",
          title:
            "Adidas insulated lunch Bag 4 compartments gray/black/silver lining 3/zips W/Box",
          sku: "",
          quantity: 1,
          lineItemFulfillmentStatus: "NOT_STARTED",
          total: { value: "11.99", currency: "USD" },
        },
      ],
    },
    {
      orderId: "24-14969-67234",
      legacyOrderId: "24-14969-67234",
      creationDate: "2026-08-03T00:19:33.000Z",
      orderFulfillmentStatus: "FULFILLED",
      orderPaymentStatus: "PAID",
      salesRecordReference: "14969-67234",
      buyer: { username: "fairway_reads" },
      pricingSummary: {
        total: { value: "17.99", currency: "USD" },
        deliveryCost: { value: "5.49", currency: "USD" },
      },
      fulfillmentStartInstructions: [
        {
          minEstimatedDeliveryDate: "2026-08-06T00:00:00.000Z",
          maxEstimatedDeliveryDate: "2026-08-10T00:00:00.000Z",
          shippingStep: {
            shippingCarrierCode: "UPS",
            shippingServiceCode: "UPSGround",
            shipTo: {
              fullName: "Morgan Hale",
              city: "Katy",
              stateOrProvince: "TX",
              postalCode: "77494",
              countryCode: "US",
            },
          },
        },
      ],
      lineItems: [
        {
          lineItemId: "10082779818924",
          legacyItemId: "376392857969",
          title: "Lot-3-Golf Digest Magazines Feb 2025, Mar/Apr 2025, May 2025",
          sku: "",
          quantity: 1,
          lineItemFulfillmentStatus: "FULFILLED",
          total: { value: "12.5", currency: "USD" },
        },
      ],
      shippingFulfillments: [
        {
          fulfillmentId: "sf-golf-digest",
          shipmentTrackingNumber: "1Z999AA10123456784",
          shippingCarrierCode: "UPS",
          shippedDate: "2026-08-03T18:10:00.000Z",
        },
      ],
    },
    {
      orderId: "22-14855-29207",
      legacyOrderId: "22-14855-29207",
      creationDate: "2026-07-09T16:02:32.000Z",
      orderFulfillmentStatus: "FULFILLED",
      orderPaymentStatus: "PAID",
      salesRecordReference: "14855-29207",
      buyer: { username: "purple_tote_co" },
      pricingSummary: {
        total: { value: "19.74", currency: "USD" },
        deliveryCost: { value: "4.49", currency: "USD" },
      },
      fulfillmentStartInstructions: [
        {
          minEstimatedDeliveryDate: "2026-07-13T00:00:00.000Z",
          maxEstimatedDeliveryDate: "2026-07-17T00:00:00.000Z",
          shippingStep: {
            shippingCarrierCode: "USPS",
            shippingServiceCode: "USPSGroundAdvantage",
            shipTo: {
              fullName: "Casey Nguyen",
              city: "Sugar Land",
              stateOrProvince: "TX",
              postalCode: "77479",
              countryCode: "US",
            },
          },
        },
      ],
      lineItems: [
        {
          lineItemId: "10082446137522",
          legacyItemId: "377110889023",
          title:
            "Lot-2-Xfinity Reusable Tote Shopping Bags Size L Purple color W/Logo-New",
          sku: "",
          quantity: 1,
          lineItemFulfillmentStatus: "FULFILLED",
          total: { value: "15.25", currency: "USD" },
        },
      ],
      shippingFulfillments: [
        {
          fulfillmentId: "sf-xfinity-totes",
          shipmentTrackingNumber: "9400111899562537875222",
          shippingCarrierCode: "USPS",
          shippedDate: "2026-07-10T14:22:00.000Z",
        },
      ],
    },
    {
      orderId: "03-14848-25401",
      legacyOrderId: "03-14848-25401",
      creationDate: "2026-06-30T12:05:08.000Z",
      orderFulfillmentStatus: "FULFILLED",
      orderPaymentStatus: "PAID",
      salesRecordReference: "14848-25401",
      buyer: { username: "calendar_wall" },
      pricingSummary: {
        total: { value: "12.48", currency: "USD" },
        deliveryCost: { value: "5.49", currency: "USD" },
      },
      fulfillmentStartInstructions: [
        {
          minEstimatedDeliveryDate: "2026-07-03T00:00:00.000Z",
          maxEstimatedDeliveryDate: "2026-07-08T00:00:00.000Z",
          shippingStep: {
            shippingCarrierCode: "FedEx",
            shippingServiceCode: "FedExHomeDelivery",
            shipTo: {
              fullName: "Taylor Brooks",
              city: "Pearland",
              stateOrProvince: "TX",
              postalCode: "77584",
              countryCode: "US",
            },
          },
        },
      ],
      lineItems: [
        {
          lineItemId: "10082894884203",
          legacyItemId: "377304261071",
          title:
            '2027 Wall Calendar Paper Print: America the Beautiful   11"x16.5"',
          sku: "",
          quantity: 1,
          lineItemFulfillmentStatus: "FULFILLED",
          total: { value: "6.99", currency: "USD" },
        },
      ],
      shippingFulfillments: [
        {
          fulfillmentId: "sf-calendar-2027",
          shipmentTrackingNumber: "794644011680",
          shippingCarrierCode: "FedEx",
          shippedDate: "2026-06-30T19:05:00.000Z",
        },
      ],
    },
  ],
};

/** ItemID → first PictureURL, matching listings the sandbox seller has. */
export const SANDBOX_LISTING_IMAGES: Record<string, string> = {
  "307014232143":
    "https://i.ebayimg.com/00/s/MTYwMFgxMjA0/z/lNQAAeSwTLhqNtFc/$_1.JPG?set_id=8800005007",
  "307014254263":
    "https://i.ebayimg.com/00/s/MTYwMFgxMjA0/z/WJgAAeSwxiZqNtZq/$_1.JPG?set_id=8800005007",
  "307014712708":
    "https://i.ebayimg.com/00/s/MTYwMFgxMjA0/z/LTgAAeSwt5tqNxfe/$_1.JPG?set_id=8800005007",
  "307014720318":
    "https://i.ebayimg.com/00/s/MTUwMlgxMTYw/z/CaYAAeSwOgVqNxmr/$_1.JPG?set_id=8800005007",
  "307014723203":
    "https://i.ebayimg.com/00/s/MTYwMFgxMjA0/z/XrwAAeSwMtBqNxtq/$_1.JPG?set_id=8800005007",
  "307014728027":
    "https://i.ebayimg.com/00/s/MTQ5MVgxMTQx/z/S-UAAeSw8n5qNxxa/$_1.JPG?set_id=8800005007",
  "307025390141":
    "https://i.ebayimg.com/00/s/MTYwMFgxNjAw/z/yd0AAeSwGNVqPb4E/$_1.JPG?set_id=8800005007",
  "307029461243":
    "https://i.ebayimg.com/00/s/MTIwNFgxNjAw/z/uMkAAeSwbtlqQHmU/$_1.JPG?set_id=8800005007",
  "377304261071":
    "https://i.ebayimg.com/00/s/MTA5NFgxMzY0/z/D44AAeSwezVqQnN0/$_57.PNG?set_id=880000500F",
};


