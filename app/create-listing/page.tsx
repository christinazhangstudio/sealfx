"use client";

import { useState, useRef, useEffect, DragEvent, ChangeEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { generateListingDescription } from "./actions";
import PageHeader from "@/components/PageHeader";

// Downscale client-side before sending to the server action: full-resolution
// photos base64-encode past Next's server-action body limit (the action then
// throws before running), and smaller images make vision inference faster.
function downscaleImage(file: File, maxDim = 1280): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = document.createElement("img");
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas unsupported"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      resolve({ base64: dataUrl.split(",")[1], mimeType: "image/jpeg" });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load image"));
    };
    img.src = url;
  });
}

export default function CreateListing() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [genError, setGenError] = useState("");
  const [lastImage, setLastImage] = useState<{ base64: string; mimeType: string } | null>(null);
  
  const [formData, setFormData] = useState({
    title: "",
    price: "",
    description: ""
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: session } = useSession();
  const isGuest = !!(session?.user && (session.user as any).isGuest);
  const MAX_GUEST_AI_USES = 2;
  const [aiUses, setAiUses] = useState(0);
  const [limitReached, setLimitReached] = useState(false);

  useEffect(() => {
    if (isGuest) {
      const saved = localStorage.getItem("fb_listing_ai_uses");
      const count = saved ? parseInt(saved, 10) : 0;
      setAiUses(count);
      if (count >= MAX_GUEST_AI_USES) {
        setLimitReached(true);
      }
    }
  }, [isGuest]);

  const incrementAiUses = () => {
    if (!isGuest) return;
    const newCount = aiUses + 1;
    setAiUses(newCount);
    localStorage.setItem("fb_listing_ai_uses", newCount.toString());
    if (newCount >= MAX_GUEST_AI_USES) {
      setLimitReached(true);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return;

    // Create a preview
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
    setGenError("");

    try {
      const image = await downscaleImage(file);
      setLastImage(image);
      await runGeneration(image);
    } catch (err) {
      console.error("Failed to read image", err);
      setGenError("Could not read that image file. Try a different one.");
    }
  };

  const runGeneration = async (image: { base64: string; mimeType: string }) => {
    if (isGuest && aiUses >= MAX_GUEST_AI_USES) {
      setLimitReached(true);
      // Allow preview but block AI generation
      setFormData(prev => ({
        ...prev,
        description: prev.description || "Sign in to unlock AI description generation."
      }));
      return;
    }

    setIsGenerating(true);
    setGenError("");
    try {
      const result = await generateListingDescription(image.base64, image.mimeType);
      if (result.error) {
        setGenError(result.error);
      } else {
        setFormData(prev => ({ ...prev, description: result.description || "" }));
        if (isGuest) {
          incrementAiUses();
        }
      }
    } catch (err) {
      console.error("Failed to generate description", err);
      setGenError("AI generation failed - the service may be unreachable. Try again or write a description manually.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCopy = async () => {
    const listing = [
      formData.title,
      formData.price ? `$${formData.price}` : "",
      formData.description,
    ]
      .filter(Boolean)
      .join("\n\n");

    try {
      await navigator.clipboard.writeText(listing);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setGenError("Couldn't copy to the clipboard — select the text and copy manually.");
    }
  };

  return (
    <div className="page-content-shell @container">
      <div className="max-w-5xl mx-auto">
        <PageHeader
          title="Create Listing"
          description="Upload a photo and let AI draft the listing copy, then copy it wherever you need it."
        />

        <div className="grid @4xl:grid-cols-2 gap-8 items-start">
          {/* Left Column: Image Upload Area */}
          <div 
            className={`relative flex items-center justify-center w-full min-h-[400px] h-full rounded-3xl border-2 border-dashed transition-all duration-300 overflow-hidden cursor-pointer group ${
              isDragging ? "border-primary bg-primary/10 shadow-lg shadow-primary/30" : "border-border hover:border-hover-content bg-surface hover:bg-hover"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              className="hidden" 
              accept="image/*" 
              ref={fileInputRef}
              onChange={handleFileChange}
            />

            {imagePreview ? (
              <div className="relative w-full h-full p-4 flex flex-col items-center justify-center group-hover:scale-[1.02] transition-transform duration-500">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={imagePreview} 
                  alt="Item preview" 
                  className="rounded-xl object-contain max-h-[85%] w-full shadow-lg"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center rounded-3xl">
                   <span className="text-white font-medium px-4 py-2 bg-black/40 rounded-full backdrop-blur-md">Change Image</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 text-center">
                <div className="w-20 h-20 mb-4 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </div>
                <p className="mb-2 text-xl font-semibold text-primary">Drag & Drop Image Here</p>
                <p className="text-sm text-secondary">or click to browse from your device</p>
              </div>
            )}
            
            {/* Scanning Overlay Animation */}
            {isGenerating && (
              <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex flex-col items-center justify-center z-10 transition-all">
                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-lg shadow-primary/30"></div>
                <p className="mt-6 text-lg font-medium text-primary animate-pulse w-full text-center tracking-wide">Analyzing image...</p>
              </div>
            )}
          </div>

          {/* Right Column: Form Area */}
          <div className="flex flex-col gap-6 bg-surface p-8 rounded-3xl shadow-xl shadow-black/5 border border-border/50">
            <div className="group relative">
              <label htmlFor="title" className="block text-sm font-semibold text-primary mb-2 transition-colors">Listing Title</label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="E.g. Vintage Leather Sofa"
                className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all duration-200 text-primary placeholder:text-secondary/50 shadow-inner"
              />
            </div>

            <div className="group relative">
              <label htmlFor="price" className="block text-sm font-semibold text-primary mb-2 transition-colors">Price ($)</label>
              <input
                type="number"
                id="price"
                name="price"
                value={formData.price}
                onChange={handleChange}
                placeholder="0.00"
                className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all duration-200 text-primary placeholder:text-secondary/50 shadow-inner font-mono"
              />
            </div>

            <div className="group relative">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <label htmlFor="description" className="block text-sm font-semibold text-primary transition-colors">AI Description</label>
                  {isGuest && (
                    <div className="flex items-center gap-2 text-xs">
                      <div className="flex gap-1" title={`${aiUses} of ${MAX_GUEST_AI_USES} free AI tries used`}>
                        {Array.from({ length: MAX_GUEST_AI_USES }).map((_, i) => (
                          <div 
                            key={i} 
                            className={`w-2.5 h-2.5 rounded-full border transition-all duration-200 ${
                              i < aiUses 
                                ? (limitReached ? 'bg-error-border border-error-border' : 'bg-primary border-primary')
                                : 'border-primary/40 bg-transparent'
                            }`} 
                          />
                        ))}
                      </div>
                      <span className={`font-medium tracking-tight ${limitReached ? 'text-error-text' : 'text-primary'}`}>
                        {limitReached 
                          ? '0 tries left'
                          : aiUses === 0 
                            ? `${MAX_GUEST_AI_USES} AI tries`
                            : `${MAX_GUEST_AI_USES - aiUses} ${MAX_GUEST_AI_USES - aiUses === 1 ? 'try' : 'tries'} left`
                        }
                      </span>
                    </div>
                  )}
                </div>
                {isGenerating ? (
                  <span className="text-xs text-primary font-medium animate-pulse">Generating...</span>
                ) : lastImage ? (
                  <button
                    type="button"
                    onClick={() => runGeneration(lastImage)}
                    className="px-2 py-2 text-xs font-medium text-primary hover:text-primary-hover transition-colors"
                  >
                    ↻ Regenerate
                  </button>
                ) : null}
              </div>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={6}
                placeholder="Description will be generated here once you upload an image..."
                className={`w-full px-4 py-3 rounded-xl bg-background border ${isGenerating ? 'border-primary shadow-lg shadow-primary/20' : 'border-border focus:border-primary'} focus:ring-2 focus:ring-primary/20 outline-none transition-all duration-300 text-primary placeholder:text-secondary/50 shadow-inner resize-none leading-relaxed`}
              />
              {genError && (
                <p className="mt-2 text-xs font-medium text-error-text">{genError}</p>
              )}
            </div>

            {/* Guest AI limit prompt */}
            {isGuest && limitReached && (
              <div className="p-4 rounded-xl bg-primary/4 border border-primary/10">
                <div className="flex justify-center">
                  <Link
                    href="/login"
                    className="shine-button inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold rounded-lg text-white transition-all shadow-sm"
                  >
                    Create a free account to unlock AI generations
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </Link>
                </div>
              </div>
            )}

            <div className="pt-4 mt-2 border-t border-border/50">
              <button
                onClick={handleCopy}
                disabled={!formData.title && !formData.price && !formData.description}
                className={`relative w-full rounded-xl font-bold text-white transition-all duration-300 ${
                  !formData.title && !formData.price && !formData.description
                  ? "bg-primary/50 cursor-not-allowed"
                  : "shine-button"
                }`}
              >
                <div className="px-6 py-4 flex items-center justify-center gap-3">
                  {copied ? (
                    <>
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Copied to clipboard
                    </>
                  ) : (
                    <>
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span>Copy listing</span>
                    </>
                  )}
                </div>
              </button>
              <p className="text-center text-xs text-secondary mt-3">Copies the title, price, and description so you can paste them anywhere.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
