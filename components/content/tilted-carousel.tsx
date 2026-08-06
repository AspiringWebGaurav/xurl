"use client";

import { useState, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { cn } from "@/lib/utils";

interface TiltedCarouselProps {
    images?: string[];
    className?: string;
    rowClassName?: string;
    imageClassName?: string;
    speed?: number;
    rows?: number;
    multiplier?: number;
    direction?: "left" | "right" | "alternate";
    pauseOnHover?: boolean;
    preset?: "default" | "isometric" | "cinematic";
}

const PRESETS = {
    default: {
        rotateX: 25,
        rotateZ: -15,
        rotateY: 0,
        scale: 1.2,
    },
    isometric: {
        rotateX: 45,
        rotateZ: -45,
        rotateY: 0,
        scale: 1.5,
    },
    cinematic: {
        rotateX: 10,
        rotateZ: 0,
        rotateY: 20,
        scale: 1.1,
    }
};

export function TiltedCarousel({
    images = [],
    className,
    rowClassName,
    imageClassName,
    speed = 50,
    rows = 4,
    multiplier = 6,
    direction = "alternate",
    pauseOnHover = false,
    preset = "default",
}: TiltedCarouselProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const isInView = useInView(containerRef, { once: false, margin: "200px" });
    const config = PRESETS[preset] || PRESETS.default;
    
    // Duplicate images to create infinite effect
    const extendedImages = Array.from({ length: multiplier }).flatMap(() => images);

    // Split into rows
    const imagesPerRow = Math.ceil(extendedImages.length / rows);
    const rowData = Array.from({ length: rows }).map((_, i) => {
        return extendedImages.slice(i * imagesPerRow, (i + 1) * imagesPerRow);
    });

    const [isHovered, setIsHovered] = useState(false);

    return (
        <div 
            ref={containerRef}
            className={cn("relative overflow-hidden w-full h-full flex items-center justify-center", className)}
            style={{ perspective: "1000px" }}
            onMouseEnter={() => pauseOnHover && setIsHovered(true)}
            onMouseLeave={() => pauseOnHover && setIsHovered(false)}
        >
            <motion.div
                className="flex flex-col gap-4 absolute w-[150%] h-[150%] items-center justify-center pointer-events-none"
                initial={{ rotateX: config.rotateX, rotateZ: config.rotateZ, rotateY: config.rotateY, scale: config.scale }}
                animate={{ rotateX: config.rotateX, rotateZ: config.rotateZ, rotateY: config.rotateY, scale: config.scale }}
                transition={{ duration: 0 }}
                style={{ transformStyle: "preserve-3d" }}
            >
                {rowData.map((rowImages, rowIndex) => {
                    // Determine direction for this row
                    let rowDirection = direction === "left" ? -1 : 1;
                    if (direction === "alternate") {
                        rowDirection = rowIndex % 2 === 0 ? -1 : 1;
                    }

                    return (
                        <div key={rowIndex} className={cn("flex gap-4", rowClassName)}>
                            <motion.div
                                className="flex gap-4"
                                animate={{
                                    x: isInView && !isHovered ? [rowDirection === -1 ? 0 : -1000, rowDirection === -1 ? -1000 : 0] : undefined,
                                }}
                                transition={{
                                    repeat: Infinity,
                                    repeatType: "loop",
                                    duration: speed,
                                    ease: "linear",
                                }}
                            >
                                {rowImages.map((src, imgIndex) => (
                                    <div 
                                        key={`${rowIndex}-${imgIndex}`}
                                        className={cn(
                                            "relative flex-shrink-0 w-[280px] h-[200px] md:w-[400px] md:h-[280px] rounded-2xl overflow-hidden shadow-2xl",
                                            imageClassName
                                        )}
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img 
                                            src={src} 
                                            alt="Carousel image" 
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                        />
                                    </div>
                                ))}
                            </motion.div>
                        </div>
                    );
                })}
            </motion.div>
        </div>
    );
}
