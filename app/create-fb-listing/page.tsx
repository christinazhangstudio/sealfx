"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import Image from "next/image";
import { generateListingDescription } from "./actions";

export default function CreateFBListing() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  const [formData, setFormData] = useState({
    title: "",
    price: "",
    description: ""
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

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
    
    // Convert to base64 for the API
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64String = reader.result as string;
      // Strip off the data:image/xxx;base64, prefix
      const base64Data = base64String.split(',')[1];
      
      setIsGenerating(true);
      try {
        const generatedDesc = await generateListingDescription(base64Data, file.type);
        setFormData(prev => ({ ...prev, description: generatedDesc }));
      } catch (err) {
        console.error("Failed to generate description", err);
      } finally {
        setIsGenerating(false);
      }
    };
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleApprove = () => {
    setIsSending(true);
    
    // Communicate with the extension bridge
    window.postMessage({
      type: "SEALIFT_CROSSLIST_REQUEST",
      payload: {
        title: formData.title,
        price: formData.price,
        description: formData.description
      }
    }, "*");

    // Reset generating button state after briefly showing success
    setTimeout(() => {
      setIsSending(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen p-8 @container">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-extrabold tracking-tight text-primary drop-shadow-sm">Create FB Listing</h1>
          <p className="text-secondary text-lg">Upload an image to magically generate a detailed listing description using Vision AI, then post it directly to Marketplace.</p>
        </div>

        <div className="grid @4xl:grid-cols-2 gap-8 items-start">
          {/* Left Column: Image Upload Area */}
          <div 
            className={`relative flex items-center justify-center w-full min-h-[400px] h-full rounded-3xl border-2 border-dashed transition-all duration-300 overflow-hidden cursor-pointer group ${
              isDragging ? "border-blue-500 bg-blue-500/10 shadow-[0_0_40px_rgba(59,130,246,0.5)]" : "border-border hover:border-hover-content bg-surface hover:bg-hover"
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
                <div className="w-20 h-20 mb-4 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
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
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
                <p className="mt-6 text-lg font-medium text-primary animate-pulse w-full text-center tracking-wide">AI is analyzing image...</p>
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
                className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all duration-200 text-primary placeholder:text-secondary/50 shadow-inner"
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
                className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all duration-200 text-primary placeholder:text-secondary/50 shadow-inner font-mono"
              />
            </div>

            <div className="group relative">
              <div className="flex justify-between items-end mb-2">
                <label htmlFor="description" className="block text-sm font-semibold text-primary transition-colors">AI Description</label>
                {isGenerating && <span className="text-xs text-blue-500 font-medium animate-pulse">Generating...</span>}
              </div>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={6}
                placeholder="Description will be magically generated here once you upload an image..."
                className={`w-full px-4 py-3 rounded-xl bg-background border ${isGenerating ? 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'border-border focus:border-blue-500'} focus:ring-2 focus:ring-blue-500/20 outline-none transition-all duration-300 text-primary placeholder:text-secondary/50 shadow-inner resize-none leading-relaxed`}
              />
            </div>

            <div className="pt-4 mt-2 border-t border-border/50">
              <button
                onClick={handleApprove}
                disabled={isSending || (!formData.title && !formData.price && !formData.description)}
                className={`group relative w-full overflow-hidden rounded-xl font-bold text-white transition-all duration-300 transform ${
                  isSending || (!formData.title && !formData.price && !formData.description)
                  ? "bg-primary/50 cursor-not-allowed scale-100"
                  : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 hover:scale-[1.02] shadow-lg shadow-blue-500/30"
                }`}
              >
                <div className="absolute inset-0 w-full h-full bg-white/20 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out skew-x-12"></div>
                <div className="px-6 py-4 flex items-center justify-center gap-3 relative z-10">
                  {isSending ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Crosslisting...
                    </>
                  ) : (
                    <>
                      <span>Approve & Crosslist to FB</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </>
                  )}
                </div>
              </button>
              <p className="text-center text-xs text-secondary mt-3">Clicking approve will trigger the Sealift Chrome Extension.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
