"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

interface Slide {
    id: number;
    title: string;
    description: string;
    imagePath?: string;
    splashPool: string[]; // Context-specific Minecraft-style splashes
}

const DEFAULT_SLIDES: Slide[] = [
    {
        id: 1,
        title: "Unified Dashboard for Seller Management",
        description: "Your unified dashboard for managing multi-store eBay integrations. Seamlessly sync inventory and monitor performance.",
        imagePath: "/tutorial/slide1.png",
        splashPool: [
            "99% Bug Free!",
            "Margins for days",
            "Business, at scale",
        ]
    },
    {
        id: 2,
        title: "AI Workflows and Integrations",
        description: "Modern AI tools to help automate sales and analytics. Optimize language-dependent labor and context-switching toil.",
        imagePath: "/tutorial/slide2.png",
        splashPool: [
            "Now with 200% more AI!",
            "Automating the automated",
            "Powered by vector math"
        ]
    },
];

export default function TutorialSlideshow({ fabOnly = false, isVisible = true }: { fabOnly?: boolean, isVisible?: boolean }) {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [currentSplash, setCurrentSplash] = useState("");

    useEffect(() => {
        // Pick a random splash from the CURRENT slide's specific pool
        const pool = DEFAULT_SLIDES[currentSlide].splashPool;
        const randomSplash = pool[Math.floor(Math.random() * pool.length)];
        setCurrentSplash(randomSplash);
    }, [currentSlide]);

    const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % DEFAULT_SLIDES.length);
    const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + DEFAULT_SLIDES.length) % DEFAULT_SLIDES.length);

    useEffect(() => {
        const timer = setInterval(nextSlide, 10000);
        return () => clearInterval(timer);
    }, [currentSlide]);

    // If it's a FAB-only instance (for the main page to show the button), we skip the content rendering
    if (fabOnly) {
        if (!isVisible) return null;

        return (
            <div className="@[950px]:hidden">
                {/* Floating Button - Slot 3 in the stack */}
                <button
                    onClick={() => setIsMenuOpen(true)}
                    className="fixed bottom-36 right-4 z-[600] w-14 h-14 bg-primary text-white shadow-2xl hover:scale-110 active:scale-95 transition-all duration-300 flex items-center justify-center rounded-full group overflow-hidden"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
                    </svg>
                    <span className="max-w-0 overflow-hidden group-hover:max-w-xs group-hover:ml-2 transition-all duration-300 font-bold uppercase text-[10px] tracking-widest px-0 group-hover:px-1 whitespace-nowrap">Steps</span>
                </button>

                {/* Drawer Overlay */}
                {isMenuOpen && (
                    <div className="fixed inset-0 z-[610] bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setIsMenuOpen(false)} />
                )}

                {/* Drawer Menu */}
                <div className={`fixed right-0 top-0 h-full w-72 bg-surface shadow-2xl z-[620] transform transition-transform duration-300 ease-in-out border-l border-border ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                    <div className="p-6 h-full flex flex-col">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-sm font-bold text-primary uppercase tracking-widest font-heading">Tutorial</h3>
                            <button onClick={() => setIsMenuOpen(false)} className="p-2 text-text-secondary hover:text-primary transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <nav className="flex-1 overflow-y-auto space-y-3">
                            {DEFAULT_SLIDES.map((slide, index) => (
                                <button
                                    key={slide.id}
                                    onClick={() => { setCurrentSlide(index); setIsMenuOpen(false); }}
                                    className={`w-full text-left p-4 rounded-xl transition-all duration-200 border ${currentSlide === index
                                        ? "bg-primary/10 border-primary/30 text-primary"
                                        : "bg-background-start/30 border-transparent text-text-secondary hover:text-text-primary"
                                        }`}
                                >
                                    <div className="text-[9px] font-mono opacity-50 mb-1">STEP 0{index + 1}</div>
                                    <div className="text-sm font-bold uppercase tracking-wider">{slide.title}</div>
                                </button>
                            ))}
                        </nav>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col gap-4 p-4 lg:p-8 lg:pt-0 relative overflow-visible">
            {/* Vertical Step Picker (Top TOC) */}
            <div className={`hidden @[800px]:flex flex-col space-y-2 w-full border-b border-border/50 pb-2 ${fabOnly ? 'hidden' : ''}`}>
                <div className="flex items-center justify-between px-2">
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-secondary/50">Tutorial Navigation</h3>
                    <div className="text-[10px] font-mono text-primary/60 uppercase tracking-widest">
                        {currentSlide + 1} / {DEFAULT_SLIDES.length}
                    </div>
                </div>
                <div className="flex flex-col space-y-1">
                    {DEFAULT_SLIDES.map((slide, index) => (
                        <button
                            key={slide.id}
                            onClick={() => setCurrentSlide(index)}
                            className={`text-left px-4 py-3 rounded-xl transition-all duration-300 group relative border flex items-center justify-between ${currentSlide === index
                                ? "bg-primary/15 border-primary/40 text-primary shadow-[0_0_20px_rgba(var(--primary-rgb),0.1)]"
                                : "bg-transparent text-text-secondary/40 hover:text-text-secondary hover:bg-surface/10 border-transparent"
                                }`}
                        >
                            <div className="flex items-center gap-4">
                                <span className={`text-[10px] font-mono transition-colors ${currentSlide === index ? "text-primary opacity-100" : "opacity-40"}`}>
                                    0{index + 1}
                                </span>
                                <span className={`text-[11px] text-primary uppercase tracking-widest transition-all ${currentSlide === index ? "translate-x-1" : ""}`}>
                                    {slide.title}
                                </span>
                            </div>
                            {currentSlide === index && (
                                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary rounded-r-full shadow-[2px_0_10px_rgba(var(--primary-rgb),0.4)]" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content - Tighter vertical stacking for Mobile Zero-Scroll */}
            <div className="flex-1 flex flex-col justify-start w-full mx-auto pt-2">
                <div
                    key={DEFAULT_SLIDES[currentSlide].id}
                    className="animate-fade-in animate-slide-in-up space-y-3 sm:space-y-6 text-center"
                >
                    {/* Giant Image Section - Flatter on mobile to save vertical space */}
                    <div className="relative aspect-[2/1] sm:aspect-video w-full rounded-2xl overflow-hidden bg-surface/20 border border-border flex items-center justify-center shadow-2xl group">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none z-10" />
                        {DEFAULT_SLIDES[currentSlide].imagePath ? (
                            <Image
                                src={DEFAULT_SLIDES[currentSlide].imagePath}
                                alt={DEFAULT_SLIDES[currentSlide].title}
                                fill
                                priority
                                unoptimized={true}
                                className="object-cover opacity-95 group-hover:opacity-100 transition-opacity duration-700"
                            />
                        ) : (
                            <div className="text-text-secondary/20 text-[10px] font-bold uppercase tracking-[0.3em]">
                                No Image Resource: {DEFAULT_SLIDES[currentSlide].imagePath}
                            </div>
                        )}
                    </div>

                    {/* Text Section - Fixed Heights to ensure constant window size across slides */}
                    <div className="space-y-4 px-2 h-[220px] sm:h-[280px] flex flex-col justify-between py-2">
                        {/* Title - Fixed height for 2 lines */}
                        <div className="h-12 sm:h-16 flex items-center justify-center">
                            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-primary tracking-tight leading-tight px-2 line-clamp-2">
                                {DEFAULT_SLIDES[currentSlide].title}
                            </h2>
                        </div>

                        {/* Description - Fixed height for 3-4 lines */}
                        <div className="h-20 sm:h-24 flex items-center justify-center">
                            <p className="text-text-secondary text-xs sm:text-sm lg:text-lg leading-relaxed opacity-80 max-w-2xl mx-auto px-4 line-clamp-3 sm:line-clamp-4">
                                {DEFAULT_SLIDES[currentSlide].description}
                            </p>
                        </div>

                        {/* Caption Area - Fixed height to keep layout stable */}
                        <div className="h-12 sm:h-16 flex items-center justify-center">
                            {currentSplash ? (
                                <div className="px-5 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary italic text-[11px] sm:text-sm lg:text-md tracking-wider max-w-[90%] mx-auto line-clamp-2">
                                    {currentSplash}
                                </div>
                            ) : (
                                <div className="h-full w-full" />
                            )}
                        </div>
                    </div>

                    {/* Controls Section - Compact spacing */}
                    <div className="flex items-center justify-center gap-4 pt-1 sm:pt-2 px-2 h-12 sm:h-14">
                        <div className="flex gap-2.5 mr-6 items-center">
                            {DEFAULT_SLIDES.map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => setCurrentSlide(i)}
                                    className={`h-1.5 rounded-full transition-all duration-500 shadow-sm ${currentSlide === i ? "w-10 bg-primary" : "w-5 bg-surface-lighter hover:bg-surface-light border border-border/50"}`}
                                />
                            ))}
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={prevSlide}
                                className="p-3 rounded-xl border border-border bg-surface/20 text-text-secondary hover:text-primary transition-all"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                            </button>
                            <button
                                onClick={nextSlide}
                                className="p-3 rounded-xl bg-primary text-white hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
