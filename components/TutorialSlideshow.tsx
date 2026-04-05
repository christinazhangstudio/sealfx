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
        title: "Unified Dashboard for Seller Management",
        description: "Your unified dashboard for managing multi-store eBay integrations. Seamlessly sync inventory and monitor performance.",
        imagePath: "/tutorial/slide1.png",
        caption: "Streamline your multi-channel sales operations."
    },
    {
        id: 2,
        title: "AI Workflows and Integrations",
        description: "Modern AI tools to help automate sales and analytics.",
        imagePath: "/tutorial/slide2.png",
        caption: "Your business shouldn't be just a platform. Use AI across all your stores!"
    },
];

export default function TutorialSlideshow({ fabOnly = false, isVisible = true }: { fabOnly?: boolean, isVisible?: boolean }) {
    const [slides, setSlides] = useState<Slide[]>(DEFAULT_SLIDES);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [loading, setLoading] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    useEffect(() => {
        const remoteUrl = process.env.NEXT_PUBLIC_TUTORIAL_JSON_URL;
        if (!remoteUrl) {
            console.log("TutorialSlideshow: No remote URL defined, using local defaults.");
            return;
        }

        const fetchRemoteDocs = async () => {
            setLoading(true);
            try {
                const response = await fetch(remoteUrl);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                if (data && data.slides) {
                    setSlides(data.slides);
                    console.log("TutorialSlideshow: Successfully loaded remote content.");
                }
            } catch (err) {
                console.error("TutorialSlideshow: Failed to fetch remote docs, using local fallback:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchRemoteDocs();
    }, []);

    const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % slides.length);
    const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);

    useEffect(() => {
        const timer = setInterval(nextSlide, 10000);
        return () => clearInterval(timer);
    }, [currentSlide, slides.length]);

    if (loading) return <div className="h-full flex items-center justify-center text-primary">Loading documentation...</div>;

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
                            {slides.map((slide, index) => (
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
                        {currentSlide + 1} / {slides.length}
                    </div>
                </div>
                <div className="flex flex-col space-y-1">
                    {slides.map((slide, index) => (
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

            {/* Main Content (Vertically Stacked Like Mobile) */}
            <div className="flex-1 flex flex-col justify-start w-full mx-auto pt-4">
                <div
                    key={slides[currentSlide].id}
                    className="animate-fade-in animate-slide-in-up space-y-6 text-center"
                >
                    {/* Giant Image Section */}
                    <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-surface/20 border border-border flex items-center justify-center shadow-2xl group">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none z-10" />
                        {slides[currentSlide].imagePath ? (
                            <Image
                                src={slides[currentSlide].imagePath}
                                alt={slides[currentSlide].title}
                                fill
                                priority
                                unoptimized={true}
                                className="object-cover opacity-95 group-hover:opacity-100 transition-opacity duration-700"
                            />
                        ) : (
                            <div className="text-text-secondary/20 text-[10px] font-bold uppercase tracking-[0.3em]">
                                No Image Resource: {slides[currentSlide].imagePath}
                            </div>
                        )}
                    </div>

                    {/* Text Section - Stabilized Height to prevent layout shifts */}
                    <div className="space-y-4 px-2 min-h-[160px] flex flex-col justify-center">
                        <h2 className="text-3xl lg:text-3xl font-bold text-primary tracking-tight leading-tight">
                            {slides[currentSlide].title}
                        </h2>
                        <div className="min-h-[60px]">
                            <p className="text-text-secondary text-base lg:text-lg leading-relaxed opacity-80 max-w-2xl mx-auto">
                                {slides[currentSlide].description}
                            </p>
                        </div>

                        {/* Caption Area - Reserved Space to prevent shifts */}
                        <div className="h-[46px] flex items-center justify-center">
                            {slides[currentSlide].caption ? (
                                <div className="px-4 py-2 rounded-lg bg-primary/10 border border-primary/20 text-primary italic text-md tracking-wider">
                                    {slides[currentSlide].caption}
                                </div>
                            ) : (
                                <div className="h-full w-full" />
                            )}
                        </div>
                    </div>

                    {/* Controls Section - Stabilized with fixed margin */}
                    <div className="flex items-center justify-center gap-4 pt-2 px-2 h-14">
                        <div className="flex gap-2.5 mr-6 items-center">
                            {slides.map((_, i) => (
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
