"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

export default function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], ["0%", "25%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.07]);
  const easeExpo: [number, number, number, number] = [0.16, 1, 0.3, 1];

  return (
    <section ref={ref} className="relative w-full h-screen min-h-[600px] overflow-hidden grain">
      {/* Background */}
      <motion.div className="absolute inset-0 w-full h-full" style={{ scale, y }}>
        <video
          autoPlay muted loop playsInline
          className="absolute inset-0 w-full h-full object-cover"
          poster="/hero-poster.jpg"
        >
          <source src="/hero-reel.mp4" type="video/mp4" />
        </video>
        {/* Cinematic fallback */}
        <div
          className="absolute inset-0 w-full h-full"
          style={{
            background: "radial-gradient(ellipse 85% 75% at 55% 40%, #2E2318 0%, #181210 45%, #0A0806 100%)",
          }}
        />
        {/* Saffron warm glow */}
        <div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(ellipse 55% 50% at 62% 42%, rgba(232,114,42,0.13) 0%, transparent 65%)",
          }}
        />
      </motion.div>

      {/* Overlay */}
      <div
        className="absolute inset-0 z-10"
        style={{
          background: "linear-gradient(to bottom, rgba(10,8,6,0.25) 0%, rgba(10,8,6,0.1) 35%, rgba(10,8,6,0.7) 100%)",
        }}
      />

      {/* Content */}
      <motion.div
        className="absolute inset-0 z-20 flex flex-col justify-end pb-20 px-6 md:px-14 lg:px-20"
        style={{ opacity }}
      >
        {/* Pre-label */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: easeExpo, delay: 0.3 }}
          className="flex items-center gap-3 mb-6"
        >
          <span className="block w-6 h-px bg-[#E8722A]" />
          <span className="text-[#FAF6F0]/65 text-xs tracking-[0.28em] uppercase">
            Women · Group · Guided
          </span>
        </motion.div>

        {/* Headline */}
        <div className="overflow-hidden mb-5">
          <motion.h1
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 1.1, ease: easeExpo, delay: 0.5 }}
            className="font-display text-[clamp(3.8rem,10vw,9rem)] leading-[0.9] text-[#FAF6F0]"
            style={{ fontWeight: 300 }}
          >
            Show up.
            <br />
            <em>Get stronger.</em>
          </motion.h1>
        </div>

        {/* Sub */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: easeExpo, delay: 0.9 }}
          className="text-[#FAF6F0]/70 text-base md:text-lg mb-10 max-w-sm"
          style={{ fontWeight: 300 }}
        >
          3 batches. Real coaching. A community that shows up with you.
        </motion.p>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: easeExpo, delay: 1.05 }}
          className="flex items-center gap-5 flex-wrap"
        >
          <a
            href="#batches"
            className="group inline-flex items-center gap-3 px-7 py-4 bg-[#E8722A] text-[#FAF6F0] text-xs tracking-[0.2em] uppercase hover:bg-[#C45E1A] transition-colors duration-300"
          >
            Book a Trial Class
            <span className="block w-4 h-px bg-current transition-all duration-300 group-hover:w-7" />
          </a>
          <a
            href="#about"
            className="text-[#FAF6F0]/50 text-xs tracking-[0.18em] uppercase hover:text-[#FAF6F0] transition-colors border-b border-[#FAF6F0]/20 pb-px"
          >
            Learn more
          </a>
        </motion.div>
      </motion.div>

      {/* Scroll line */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8, duration: 1 }}
        className="absolute bottom-8 right-8 z-20 flex flex-col items-center gap-3"
      >
        <div className="w-px h-14 bg-[#FAF6F0]/15 relative overflow-hidden">
          <motion.div
            className="absolute top-0 left-0 w-full bg-[#E8722A]"
            animate={{ y: ["0%", "100%"] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "linear", repeatDelay: 0.3 }}
            style={{ height: "35%" }}
          />
        </div>
      </motion.div>
    </section>
  );
}
