"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

interface Slide {
    id: number;
    title: string;
    description: string;
    imagePath?: string;
    caption?: string;
}

const DEFAULT_SLIDES: Slide[] = [
    {
        id: 1,
        title: "Welcome to Sealift",
        description: "Your unified dashboard for managing multi-store eBay integrations. Seamlessly sync inventory and monitor performance.",
        imagePath: "/placeholder-1.png",
        caption: "Streamline your multi-channel sales operations."
    },
    {
        id: 2,
        title: "Real-time Notifications",
        description: "Stay updated with instant alerts for sales, inquiries, and inventory changes across all your connected stores.",
        imagePath: "/placeholder-2.png",
        caption: "Never miss a critical update again."
    },
    {
        id: 3,
        title: "Developer Setup",
        description: "Configure your eBay Developer keys to enable secure API access. We encrypt all sensitive data for your protection.",
        imagePath: "/placeholder-3.png",
        caption: "Secure and encrypted integration."
    }
];

export default function TutorialSlideshow() {
    const [slides, setSlides] = useState<Slide[]>(DEFAULT_SLIDES);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [loading, setLoading] = useState(false);

    // Integration Example: Fetch from a remote JSON (e.g., GitHub Gist or S3)
    // To update without repushing: 
    // 1. Host a JSON file on a public URL.
    // 2. Set the URL here.
    // 3. The app will fetch the latest content on mount.
    /*
    useEffect(() => {
        const fetchRemoteDocs = async () => {
            try {
                const response = await fetch('https://raw.githubusercontent.com/user/repo/main/tutorial.json');
                const data = await response.json();
                setSlides(data.slides);
            } catch (err) {
                console.error("Failed to fetch remote docs", err);
            }
        };
        fetchRemoteDocs();
    }, []);
    */

    const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % slides.length);
    const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);

    useEffect(() => {
        const timer = setInterval(nextSlide, 10000);
        return () => clearInterval(timer);
    }, [currentSlide, slides.length]);

    if (loading) return <div className="h-full flex items-center justify-center text-[var(--color-primary)]">Loading documentation...</div>;

    return (
        <div className="h-full flex flex-col lg:flex-row gap-8 lg:gap-12 p-4 lg:p-8">
            {/* Table of Contents */}
            <div className="w-full lg:w-1/3 flex flex-row lg:flex-col overflow-x-auto lg:overflow-x-visible space-x-2 lg:space-x-0 lg:space-y-2 border-b lg:border-b-0 lg:border-r border-[var(--color-border)]/50 pb-4 lg:pb-0 lg:pr-8 scrollbar-hide">
                <div className="hidden lg:block mb-6">
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-text-secondary)]/50">Tutorial Steps</h3>
                </div>
                {slides.map((slide, index) => (
                    <button
                        key={slide.id}
                        onClick={() => setCurrentSlide(index)}
                        className={`flex-shrink-0 text-left p-3 lg:p-4 rounded-xl transition-all duration-300 group relative ${
                            currentSlide === index 
                            ? "bg-[var(--color-primary)]/10 text-white border border-[var(--color-primary)]/20 lg:border-0 lg:translate-x-1" 
                            : "text-[var(--color-text-secondary)]/60 hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)]/20 border border-transparent"
                        }`}
                    >
                        {currentSlide === index && (
                            <div className="hidden lg:block absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1/2 bg-[var(--color-primary)] rounded-full" />
                        )}
                        <span className="hidden lg:block text-[10px] font-mono opacity-40 mb-1">STEP 0{index + 1}</span>
                        <span className="text-[10px] lg:text-xs font-bold uppercase tracking-wider">{slide.title}</span>
                    </button>
                ))}
            </div>

            {/* Main Content (Symmetric Slide) */}
            <div className="flex-1 flex flex-col justify-center max-w-2xl mx-auto">
                <div 
                    key={slides[currentSlide].id}
                    className="animate-fade-in animate-slide-in-right space-y-8"
                >
                    {/* Symmetric Image Section */}
                    <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-[var(--color-surface)]/20 border border-[var(--color-border)] flex items-center justify-center shadow-2xl group">
                        <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-primary)]/10 to-transparent pointer-events-none" />
                        <div className="text-[var(--color-text-secondary)]/20 text-[10px] font-bold uppercase tracking-[0.3em] group-hover:scale-105 transition-transform duration-700">
                            Remote Resource: {slides[currentSlide].imagePath}
                        </div>
                    </div>

                    {/* Symmetric Text Section */}
                    <div className="space-y-6 text-center lg:text-left">
                        <div className="space-y-2">
                            <h2 className="text-3xl font-bold text-white tracking-tight leading-tight">
                                {slides[currentSlide].title}
                            </h2>
                            <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed max-w-md mx-auto lg:mx-0 opacity-80">
                                {slides[currentSlide].description}
                            </p>
                        </div>
                        
                        {slides[currentSlide].caption && (
                            <div className="inline-block px-4 py-2 rounded-lg bg-[var(--color-surface)]/30 border border-[var(--color-border)] text-[var(--color-text-secondary)] text-[11px] italic">
                                {slides[currentSlide].caption}
                            </div>
                        )}
                    </div>
                </div>

                {/* Progress Mini-Controls */}
                <div className="flex items-center justify-between mt-12 pt-8 border-t border-[var(--color-border)]/30">
                    <button onClick={prevSlide} className="p-2 text-[var(--color-text-secondary)] hover:text-white transition-colors">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
                    </button>
                    <div className="text-[10px] font-mono text-[var(--color-primary)]/60 uppercase tracking-widest">
                        {currentSlide + 1} / {slides.length}
                    </div>
                    <button onClick={nextSlide} className="p-2 text-[var(--color-text-secondary)] hover:text-white transition-colors">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
                    </button>
                </div>
            </div>
        </div>
    );

}
