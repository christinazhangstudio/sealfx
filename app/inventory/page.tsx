"use client"; // Next.js 13+ App Router client component

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import LoginCtaBanner from "@/components/LoginCtaBanner";
import { trackedFetch as fetch } from "@/lib/api-tracker";
import { useEbayListings } from "@/lib/useEbayListings";
import {
  ReauthRequiredError,
  MAX_DAYS_PER_CHUNK,
  formatApiDate,
  firstListingImage,
  type Item,
  type Listings,
} from "@/lib/ebay-data";
import { defaultListingsRange, formatFetchedAt } from "@/lib/date-range";
import UserTableOfContents from "@/components/UserTableOfContents";
import PageHeader from "@/components/PageHeader";
import PageActionBar, { RefreshAction } from "@/components/PageActionBar";
import PersonIcon from "@/components/PersonIcon";
import {
  MOCK_INVENTORY_NOTES,
  MOCK_INVENTORY_SELLERS,
} from "@/lib/mock-listings";

const INVENTORY_NOTE_MAX_LENGTH = 4000;

interface InventoryNote {
  seller: string;
  itemId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

interface InventoryNoteEditor {
  seller: string;
  itemId: string;
  title: string;
  body: string;
}

function inventoryNoteKey(seller: string, itemId: string): string {
  return `${seller}\u0000${itemId}`;
}

function inventoryNotesUrl(seller: string, itemId?: string): string {
  const base = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");
  const sellerPath = encodeURIComponent(seller);
  return itemId
    ? `${base}/inventory-notes/${sellerPath}/${encodeURIComponent(itemId)}`
    : `${base}/inventory-notes/${sellerPath}`;
}

function listingStatusPillClass(status: string): string {
  switch (status.toLowerCase()) {
    case "active":
      return "border-emerald-600/45 bg-emerald-500/20 text-emerald-700";
    case "completed":
      return "border-blue-600/45 bg-blue-500/20 text-blue-700";
    case "ended":
      return "border-slate-500/45 bg-slate-500/20 text-slate-700";
    default:
      return "border-primary/30 bg-primary/10 text-primary";
  }
}

interface ListingsResponse {
  user: string;
  listings: Listings;
}

export default function InventoryPage() {
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Supersede any in-flight crawl when a new one starts, and stop it on unmount.
  const fetchAbortRef = useRef<AbortController | null>(null);
  useEffect(() => () => fetchAbortRef.current?.abort(), []);
  const [users, setUsers] = useState<string[]>([]);
  const [userListings, setUserListings] = useState<{
    [user: string]: Listings;
  }>({});
  const [userPages, setUserPages] = useState<{ [user: string]: number }>({});
  const [userTotalPages, setUserTotalPages] = useState<{
    [user: string]: number;
  }>({});
  const [startFrom, setStartFrom] = useState<Date>(() => defaultListingsRange().start);
  const [startTo, setStartTo] = useState<Date>(() => defaultListingsRange().end);
  const [appliedDates, setAppliedDates] = useState(() => defaultListingsRange());
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [userLoading, setUserLoading] = useState<{ [user: string]: boolean }>(
    {}
  );
  const [error, setError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [displaySize, setDisplaySize] = useState<"small" | "medium" | "large">(
    "medium"
  );
  const [inventoryNotes, setInventoryNotes] = useState<Record<string, InventoryNote>>({});
  const [noteLoadError, setNoteLoadError] = useState<string | null>(null);
  const [noteEditor, setNoteEditor] = useState<InventoryNoteEditor | null>(null);
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteEditorError, setNoteEditorError] = useState<string | null>(null);
  const [usingMockInventory, setUsingMockInventory] = useState(false);

  const [usingDefaultRange, setUsingDefaultRange] = useState(true);

  // Define separate page sizes
  const apiPageSize = 200; // For API requests
  const pageSizeMap: { [key in "small" | "medium" | "large"]: number } = {
    small: 20,
    medium: 12,
    large: 6,
  };
  const clientPageSize = pageSizeMap[displaySize];
  const { listingsByUser, errorsByUser, isLoading, isValidating, fetchedAt, refresh } = useEbayListings(users, appliedDates.start, appliedDates.end);
  const lastRefreshed = fetchedAt ? new Date(fetchedAt) : null;


  useEffect(() => {
    const newUserListings: { [user: string]: Listings } = {};
    const newTotalPages: { [user: string]: number } = {};
    const newPages: { [user: string]: number } = {};

    Object.entries(listingsByUser).forEach(([user, items]) => {
      newUserListings[user] = {
        PaginationResult: {
          TotalNumberOfEntries: items.length,
          TotalNumberOfPages: Math.ceil(items.length / clientPageSize) || 1,
        },
        HasMoreItems: false,
        ItemArray: { Items: items },
        ItemsPerPage: apiPageSize,
        PageNumber: 1,
        ReturnedItemCountActual: items.length,
      };
      newTotalPages[user] = Math.ceil(items.length / clientPageSize) || 1;
      newPages[user] = 1;
    });

    setUserListings(newUserListings);
    setUserTotalPages(newTotalPages);
    setUserPages(newPages);
  }, [listingsByUser, clientPageSize, users]);


  const fetchUsers = async () => {
    try {
      setUserLoading((prev) => ({
        ...prev,
        global: true,
      }));

      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
      const uri = process.env.NEXT_PUBLIC_USERS_URI;
      const apiUrl = `${apiBaseUrl}/${uri}?`;

      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch users: ${response.status}`);
      }
      const data = await response.json();

      const usersData: string[] = data.users || [];
      const activeUsers = usersData.length > 0 ? usersData : MOCK_INVENTORY_SELLERS;
      const usesOnlyFixtureSellers = activeUsers.every((seller) =>
        MOCK_INVENTORY_SELLERS.includes(seller)
      );
      setUsingMockInventory(usersData.length === 0 || usesOnlyFixtureSellers);
      setUsers(activeUsers);

      const initialPages = activeUsers.reduce((acc, user) => {
        acc[user] = 1;
        return acc;
      }, {} as { [user: string]: number });

      const initialTotalPages = activeUsers.reduce((acc, user) => {
        acc[user] = 1;
        return acc;
      }, {} as { [user: string]: number });

      const initialLoading = activeUsers.reduce((acc, user) => {
        acc[user] = false;
        return acc;
      }, {} as { [user: string]: boolean });

      setUserPages(initialPages);
      setUserTotalPages(initialTotalPages);
      setUserLoading((prev) => ({
        ...prev,
        ...initialLoading,
        global: false,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching users");
      setUserLoading((prev) => ({ ...prev, global: false }));
    }
  };
  const handleApply = useCallback(() => {
    if (startFrom > startTo) {
      setDateError("Start date cannot be after end date");
      return;
    }
    setDateError(null);
    setError(null);
    setUsingDefaultRange(false);
    setAppliedDates({ start: startFrom, end: startTo });
  }, [startFrom, startTo]);
  // Manual refresh: bypass the SWR cache and force a fresh crawl from eBay.
  // The cached view is shown instantly on load; this is how the user opts into
  // newer data when they suspect listings have changed since then.
  const handleRefresh = useCallback(() => {
    setError(null);
    const nextDefault = defaultListingsRange();
    if (usingDefaultRange && nextDefault.end.getTime() !== appliedDates.end.getTime()) {
      setStartFrom(nextDefault.start);
      setStartTo(nextDefault.end);
      setAppliedDates(nextDefault);
      return;
    }
    void refresh();
  }, [appliedDates.end, refresh, usingDefaultRange]);

  const resetDateRange = () => {
    const { start, end } = defaultListingsRange();
    setStartFrom(start);
    setStartTo(end);
    setAppliedDates({ start, end });
    setUsingDefaultRange(true);
    setStatusFilter("ALL");
    setDateError(null);
    setError(null);
  };

  // Effect to handle initial fetch of users
  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (usingMockInventory || isLoading || users.length === 0) return;
    if (users.some((seller) => errorsByUser[seller])) return;

    const allSellersLoaded = users.every((seller) =>
      Object.prototype.hasOwnProperty.call(listingsByUser, seller)
    );
    const hasAnyListings = users.some(
      (seller) => (listingsByUser[seller]?.length ?? 0) > 0
    );
    if (allSellersLoaded && !hasAnyListings) {
      setUsingMockInventory(true);
      setUsers(MOCK_INVENTORY_SELLERS);
    }
  }, [errorsByUser, isLoading, listingsByUser, users, usingMockInventory]);

  useEffect(() => {
    const controller = new AbortController();
    if (usingMockInventory) {
      const timestamp = "2026-08-23T12:00:00.000Z";
      const mockNotes: Record<string, InventoryNote> = {};
      for (const [seller, sellerNotes] of Object.entries(MOCK_INVENTORY_NOTES)) {
        for (const [itemId, body] of Object.entries(sellerNotes)) {
          mockNotes[inventoryNoteKey(seller, itemId)] = {
            seller,
            itemId,
            body,
            createdAt: timestamp,
            updatedAt: timestamp,
          };
        }
      }
      setInventoryNotes(mockNotes);
      setNoteLoadError(null);
      return () => controller.abort();
    }
    if (users.length === 0) {
      setInventoryNotes({});
      setNoteLoadError(null);
      return () => controller.abort();
    }

    const loadNotes = async () => {
      const results = await Promise.all(
        users.map(async (seller) => {
          try {
            const response = await fetch(inventoryNotesUrl(seller), {
              credentials: "include",
              signal: controller.signal,
            });
            if (!response.ok) {
              throw new Error(`Failed to load notes for ${seller}`);
            }
            const payload = (await response.json()) as { notes?: InventoryNote[] };
            return { notes: payload.notes ?? [], error: null };
          } catch (error) {
            if (controller.signal.aborted) return { notes: [], error: null };
            return {
              notes: [],
              error: error instanceof Error ? error.message : `Failed to load notes for ${seller}`,
            };
          }
        })
      );

      if (controller.signal.aborted) return;
      const nextNotes: Record<string, InventoryNote> = {};
      for (const result of results) {
        for (const note of result.notes) {
          nextNotes[inventoryNoteKey(note.seller, note.itemId)] = note;
        }
      }
      setInventoryNotes(nextNotes);
      setNoteLoadError(results.find((result) => result.error)?.error ?? null);
    };

    void loadNotes();
    return () => controller.abort();
  }, [users, usingMockInventory]);

  useEffect(() => {
    if (!noteEditor) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !noteSaving) {
        setNoteEditor(null);
        setNoteEditorError(null);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [noteEditor, noteSaving]);

  const openNoteEditor = (seller: string, item: Item) => {
    const note = inventoryNotes[inventoryNoteKey(seller, item.ItemID)];
    setNoteEditor({
      seller,
      itemId: item.ItemID,
      title: item.Title,
      body: note?.body ?? "",
    });
    setNoteEditorError(null);
  };

  const saveInventoryNote = async () => {
    if (!noteEditor || noteSaving) return;
    const body = noteEditor.body.trim();
    if (!body) {
      setNoteEditorError("Enter a note before saving.");
      return;
    }

    if (usingMockInventory) {
      const key = inventoryNoteKey(noteEditor.seller, noteEditor.itemId);
      const timestamp = new Date().toISOString();
      setInventoryNotes((current) => ({
        ...current,
        [key]: {
          seller: noteEditor.seller,
          itemId: noteEditor.itemId,
          body,
          createdAt: current[key]?.createdAt ?? timestamp,
          updatedAt: timestamp,
        },
      }));
      setNoteEditor(null);
      return;
    }

    setNoteSaving(true);
    setNoteEditorError(null);
    try {
      const response = await fetch(inventoryNotesUrl(noteEditor.seller, noteEditor.itemId), {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!response.ok) {
        throw new Error((await response.text()).trim() || "Failed to save note");
      }
      const savedNote = (await response.json()) as InventoryNote;
      setInventoryNotes((current) => ({
        ...current,
        [inventoryNoteKey(savedNote.seller, savedNote.itemId)]: savedNote,
      }));
      setNoteEditor(null);
    } catch (error) {
      setNoteEditorError(error instanceof Error ? error.message : "Failed to save note");
    } finally {
      setNoteSaving(false);
    }
  };

  const deleteInventoryNote = async () => {
    if (!noteEditor || noteSaving) return;
    if (usingMockInventory) {
      const key = inventoryNoteKey(noteEditor.seller, noteEditor.itemId);
      setInventoryNotes((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      setNoteEditor(null);
      return;
    }
    setNoteSaving(true);
    setNoteEditorError(null);
    try {
      const response = await fetch(inventoryNotesUrl(noteEditor.seller, noteEditor.itemId), {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error((await response.text()).trim() || "Failed to remove note");
      }
      const key = inventoryNoteKey(noteEditor.seller, noteEditor.itemId);
      setInventoryNotes((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      setNoteEditor(null);
    } catch (error) {
      setNoteEditorError(error instanceof Error ? error.message : "Failed to remove note");
    } finally {
      setNoteSaving(false);
    }
  };


  // Effect to handle pagination adjustments when displaySize changes
  useEffect(() => {
    if (Object.keys(userListings).length > 0) {
      // Update total pages for all users based on the new clientPageSize
      const newTotalPages = { ...userTotalPages };
      const newCurrentPages = { ...userPages };

      Object.keys(userListings).forEach((user) => {
        const items = Array.isArray(userListings[user]?.ItemArray?.Items)
          ? userListings[user].ItemArray.Items
          : [];

        // Match the inventory renderer's status filtering so pagination stays accurate.
        const filteredItems =
          statusFilter === "ALL"
            ? items
            : items.filter(
              (item) => item.SellingStatus.ListingStatus === statusFilter
            );

        newTotalPages[user] = Math.ceil(filteredItems.length / clientPageSize) || 1;
        newCurrentPages[user] = 1; // Reset to page 1 to avoid out-of-bounds
      });

      setUserTotalPages(newTotalPages);
      setUserPages(newCurrentPages);
    }
  }, [displaySize, statusFilter]); // Also update when statusFilter changes

  const sizeStyles = {
    small: {
      grid: "grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-10",
      imageHeight: "h-[160px]",
      captionSize: "text-sm",
      placeholder: "",

    },
    medium: {
      grid: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6",
      imageHeight: "h-[180px]",
      captionSize: "text-s",
      placeholder: "",

    },
    large: {
      grid: "grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
      imageHeight: "h-[300px]",
      captionSize: "text-lg",
      placeholder: "",

    },
  };

  // Dedicated image component to handle image loading errors without flicker.
  const InventoryImage = ({ src, alt, placeholder, className }: { src: string, alt: string, placeholder: string, className: string }) => {
    const [imgSrc, setImgSrc] = useState(src);
    const [hasError, setHasError] = useState(false);

    // Update src if it changes from props (e.g. pagination or filter change)
    useEffect(() => {
      setImgSrc(src);
      setHasError(false);
    }, [src]);

    const handleError = () => {
      if (hasError) return;
      setHasError(true);
      if (placeholder) setImgSrc(placeholder);
    };

    if (hasError && !placeholder) return null;

    return (
      <img
        src={imgSrc}
        alt={alt}
        className={className}
        referrerPolicy="no-referrer"
        onError={handleError}
      />
    );
  };

  const renderUserInventory = (
    user: string,
    listings: Listings,
    statusFilter: string,
    pageIdx: number,
    clientPageSize: number
  ) => {
    const items = Array.isArray(listings?.ItemArray?.Items)
      ? listings.ItemArray.Items
      : [];

    const filteredItems =
      statusFilter === "ALL"
        ? items
        : items.filter(
          (item) => item.SellingStatus.ListingStatus === statusFilter
        );

    const startIdx = (pageIdx - 1) * clientPageSize;
    const paginatedItems = filteredItems.slice(startIdx, startIdx + clientPageSize);

    return (
      <div
        key={user}
        className="seller-card"
      >
        <h2 className="seller-card-title flex items-center gap-2">
          <span>{user}</span>
          <PersonIcon />
        </h2>
        <p className="text-base sm:text-xl text-primary mb-8">
          Total Items: {filteredItems.length} 📦
        </p>
        {paginatedItems.length > 0 ? (
          <div className={`grid ${sizeStyles[displaySize].grid} gap-6`}>
            {paginatedItems.map((item) => {
              const imageUrl =
                firstListingImage(item.PictureDetails) ||
                sizeStyles[displaySize].placeholder;
              const note = inventoryNotes[inventoryNoteKey(user, item.ItemID)];
              const listingStatus = item.SellingStatus.ListingStatus || "Unknown";
              return (
                <div key={item.ItemID} className="relative group">
                  <a
                    href={item.ListingDetails.ViewItemURL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <div className="duration-500 group-hover:scale-105">
                      <InventoryImage
                        src={imageUrl}
                        alt={`Image for ${item.Title}`}
                        placeholder={sizeStyles[displaySize].placeholder}
                        className={`w-full ${sizeStyles[displaySize].imageHeight} max-w-full object-contain rounded-lg transition-transform`}
                      />
                      <div className="absolute bottom-2 left-2">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm backdrop-blur-sm ${listingStatusPillClass(listingStatus)}`}
                        >
                          {listingStatus}
                        </span>
                      </div>
                    </div>
                  </a>
                  <div className="group/note absolute right-2 top-2 z-20">
                    <button
                      type="button"
                      onClick={() => openNoteEditor(user, item)}
                      aria-haspopup="dialog"
                      aria-label={`${note ? "Edit" : "Add"} note for ${item.Title}`}
                      aria-describedby={
                        note ? `inventory-note-tooltip-${user}-${item.ItemID}` : undefined
                      }
                      title={note ? undefined : "Add a private note"}
                      data-inventory-note-action={note ? "edit" : "add"}
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border shadow-sm backdrop-blur-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                        note
                          ? "border-primary/30 bg-primary text-white hover:bg-primary-hover"
                          : "border-border/70 bg-surface/90 text-text-secondary hover:border-primary/40 hover:text-primary"
                      }`}
                    >
                      <svg
                        aria-hidden="true"
                        width="17"
                        height="17"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                        <path d="M14 2v6h6" />
                        <path d="M9 13h6M9 17h4" />
                      </svg>
                    </button>
                    {note && (
                      <div
                        id={`inventory-note-tooltip-${user}-${item.ItemID}`}
                        role="tooltip"
                        data-inventory-note-tooltip
                        className="pointer-events-none invisible absolute right-0 top-full z-50 mt-2 w-52 translate-y-1 rounded-xl border border-border bg-surface/95 p-3 text-left opacity-0 shadow-xl backdrop-blur-md transition-[opacity,transform,visibility] duration-150 group-hover/note:visible group-hover/note:translate-y-0 group-hover/note:opacity-100 group-focus-within/note:visible group-focus-within/note:translate-y-0 group-focus-within/note:opacity-100"
                      >
                        <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                          Private note
                        </p>
                        <p className="mt-1 whitespace-pre-wrap break-words text-xs font-medium leading-relaxed text-text-primary">
                          {note.body}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-text-secondary text-lg">
            No items available for {user}.
          </p>
        )}
      </div>
    );
  };

  if (!mounted) {
    return null;
  }

  const editedNote = noteEditor
    ? inventoryNotes[inventoryNoteKey(noteEditor.seller, noteEditor.itemId)]
    : undefined;

  return (
    <>
          <div className="page-content-shell bg-background">
        <PageHeader
          title="Inventory"
          description="Browse and manage listings across your sellers."
        />
        <PageActionBar ariaLabel="Inventory controls" comfortable>
          {usingMockInventory && (
            <div
              role="status"
              className="w-fit rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
            >
              Showing sample inventory
            </div>
          )}
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
            <div className="min-w-0 space-y-3">
              <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
                <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:w-auto">
                  <div className="flex min-w-0 items-center overflow-hidden rounded-xl border border-border/60 bg-background/60 focus-within:ring-2 focus-within:ring-primary/30">
                    <label className="shrink-0 border-r border-border/60 px-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                      From
                    </label>
                    <input
                      type="date"
                      value={formatApiDate(startFrom)}
                      onChange={(event) => {
                        const newDate = new Date(event.target.value);
                        if (!Number.isNaN(newDate.getTime())) setStartFrom(newDate);
                      }}
                      className="min-w-0 flex-1 cursor-pointer bg-transparent px-3 py-2.5 text-sm text-text-primary outline-none"
                      max={formatApiDate(new Date())}
                    />
                  </div>
                  <div className="flex min-w-0 items-center overflow-hidden rounded-xl border border-border/60 bg-background/60 focus-within:ring-2 focus-within:ring-primary/30">
                    <label className="shrink-0 border-r border-border/60 px-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                      To
                    </label>
                    <input
                      type="date"
                      value={formatApiDate(startTo)}
                      onChange={(event) => {
                        const newDate = new Date(event.target.value);
                        if (!Number.isNaN(newDate.getTime())) setStartTo(newDate);
                      }}
                      className="min-w-0 flex-1 cursor-pointer bg-transparent px-3 py-2.5 text-sm text-text-primary outline-none"
                      max={formatApiDate(new Date())}
                    />
                  </div>
                </div>

                <div className="flex self-start rounded-xl border border-border/60 bg-background/60 p-1">
                  <button
                    type="button"
                    onClick={handleApply}
                    className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover"
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={resetDateRange}
                    className="rounded-lg px-5 py-2.5 text-sm font-semibold text-text-secondary transition-colors hover:bg-hover/70 hover:text-text-primary"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 sm:w-fit">
                <label className="flex min-w-0 items-center overflow-hidden rounded-xl border border-border/60 bg-background/60">
                  <span className="shrink-0 border-r border-border/60 px-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    Status
                  </span>
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className="min-w-32 flex-1 cursor-pointer bg-transparent px-3 py-2.5 text-sm text-text-primary outline-none"
                  >
                    <option value="ALL">All</option>
                    <option value="Active">Active</option>
                    <option value="Completed">Completed</option>
                    <option value="Ended">Ended</option>
                  </select>
                </label>

                <label className="flex min-w-0 items-center overflow-hidden rounded-xl border border-border/60 bg-background/60">
                  <span className="shrink-0 border-r border-border/60 px-3 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                    View
                  </span>
                  <select
                    value={displaySize}
                    onChange={(event) => setDisplaySize(event.target.value as "small" | "medium" | "large")}
                    className="min-w-32 flex-1 cursor-pointer bg-transparent px-3 py-2.5 text-sm text-text-primary outline-none"
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </label>
              </div>
            </div>

            <RefreshAction
              updated={lastRefreshed ? formatFetchedAt(lastRefreshed) : null}
              refreshing={isValidating}
              onRefresh={handleRefresh}
            />
          </div>

          <UserTableOfContents users={users} />
        </PageActionBar>
        {dateError && <p className="text-error-text text-lg mb-4">{dateError}</p>}
        {error && <p className="text-error-text text-lg mb-4">{error}</p>}
        {noteLoadError && <p className="text-error-text text-sm mb-4">{noteLoadError}</p>}
        {userLoading.global ? (
          <div className="seller-card">
            <p className="text-primary text-lg">Loading Users... </p>
          </div>
        ) : users.length > 0 ? (
          <div className="space-y-6">
            <div className="w-full min-w-0 space-y-8">
              {users.map((user) => (
                <div key={user} id={`user-section-${user}`}>
                  {isLoading ? (
                    <div className="seller-card">
                      <h2 className="seller-card-title flex items-center gap-2">
                        <span>{user}</span>
                        <PersonIcon />
                      </h2>
                      <p className="text-primary text-lg">
                        Loading Listings...
                      </p>
                    </div>
                  ) : errorsByUser[user] ? (
                    <div className="seller-card border-l-4 border-l-red-500">
                      <h2 className="seller-card-title flex items-center gap-2 text-red-500">
                        <span>{user}</span>
                        <PersonIcon />
                      </h2>
                      <p className="text-red-500 font-medium">
                        Request failed: {errorsByUser[user]}
                      </p>
                    </div>
                  ) : userListings[user]?.ReturnedItemCountActual > 0 ? (
                    renderUserInventory(
                      user,
                      userListings[user],
                      statusFilter,
                      userPages[user],
                      clientPageSize
                    )
                  ) : (
                    <div className="seller-card">
                      <h2 className="seller-card-title flex items-center gap-2">
                        <span>{user}</span>
                        <PersonIcon />
                      </h2>
                      <p className="text-text-secondary text-lg">
                        No listings for {user}.
                      </p>
                    </div>
                  )}
                  {userListings[user]?.ReturnedItemCountActual > 0 && (
                    <div className="flex gap-4 mt-2 mb-6 justify-center">
                      <button
                        onClick={() => {
                          setUserPages((prev) => ({
                            ...prev,
                            [user]: prev[user] - 1,
                          }));
                        }}
                        disabled={userPages[user] === 1}
                        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Previous
                      </button>
                      <span className="text-primary text-lg flex items-center">
                        Page {userPages[user]} of {userTotalPages[user] || 1}
                      </span>
                      <button
                        onClick={() => {
                          setUserPages((prev) => ({
                            ...prev,
                            [user]: prev[user] + 1,
                          }));
                        }}
                        disabled={userPages[user] >= (userTotalPages[user] || 1)}
                        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover disabled:bg-border disabled:cursor-not-allowed transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="seller-card">
            <p className="text-text-secondary text-lg">No listings available. </p>
          </div>
        )}
      </div>

      {noteEditor && (
        <div
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="inventory-note-title"
          data-inventory-note-editor
          onClick={(event) => {
            if (event.target === event.currentTarget && !noteSaving) {
              setNoteEditor(null);
              setNoteEditorError(null);
            }
          }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2
                  id="inventory-note-title"
                  className="text-xs font-semibold uppercase tracking-wider text-primary"
                >
                  Private inventory note
                </h2>
                <p className="mt-2 line-clamp-2 text-sm text-text-secondary">{noteEditor.title}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNoteEditor(null);
                  setNoteEditorError(null);
                }}
                disabled={noteSaving}
                aria-label="Collapse note editor"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg
                  aria-hidden="true"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="m18 15-6-6-6 6" />
                </svg>
              </button>
            </div>

            <label htmlFor="inventory-note-body" className="mt-5 block text-sm font-semibold text-text-primary">
              Note
            </label>
            <textarea
              id="inventory-note-body"
              value={noteEditor.body}
              onChange={(event) =>
                setNoteEditor((current) =>
                  current ? { ...current, body: event.target.value } : current
                )
              }
              maxLength={INVENTORY_NOTE_MAX_LENGTH}
              rows={7}
              autoFocus
              placeholder="Add condition details, storage location, packing reminders, or anything else you need to remember."
              aria-describedby="inventory-note-count inventory-note-error"
              className="mt-2 w-full resize-y rounded-xl border border-border bg-background/70 px-4 py-3 text-sm leading-relaxed text-text-primary outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            />
            <div className="mt-2 flex items-start justify-between gap-4">
              <p id="inventory-note-error" className="min-h-5 text-sm text-error-text">
                {noteEditorError}
              </p>
              <p id="inventory-note-count" className="shrink-0 text-xs text-text-muted">
                {noteEditor.body.length.toLocaleString()} / {INVENTORY_NOTE_MAX_LENGTH.toLocaleString()}
              </p>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => void saveInventoryNote()}
                disabled={noteSaving || !noteEditor.body.trim()}
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {noteSaving ? "Saving…" : "Save note"}
              </button>
              {editedNote && (
                <button
                  type="button"
                  onClick={() => void deleteInventoryNote()}
                  disabled={noteSaving}
                  aria-label="Remove note"
                  title="Remove note"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-error-border/50 text-error-text transition-colors hover:bg-error-bg disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <svg
                    aria-hidden="true"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 6h18" />
                    <path d="M8 6V4h8v2" />
                    <path d="m19 6-1 14H6L5 6" />
                    <path d="M10 11v5M14 11v5" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
