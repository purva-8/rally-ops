"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

export default function FinalCTA() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "-12%"]);

  return (
    <section id="cta" ref={ref} className="relative overflow-hidden grain" style={{ minHeight: "80vh", display: "flex", alignItems: "center" }}>
      <motion.div className="absolute inset-0 w-full h-[130%]" style={{ y: bgY }}>
        <div
          className="w-full h-full"
          style={{ background: "radial-gradient(ellipse 90% 80% at 30% 55%, #281C10 0%, #151008 40%, #0A0806 100%)" }}
        />
        {/* Saffron warm glow */}
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(ellipse 50% 45% at 32% 58%, rgba(232,114,42,0.1) 0%, transparent 60%)" }}
        />
      </motion.div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 md:px-14 lg:px-20 w-full py-28">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">

          <div className="lg:col-span-7">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex items-center gap-4 mb-7">
                <span className="block w-6 h-px bg-[#E8722A]" />
                <span className="text-[#5A5048] text-[10px] tracking-[0.3em] uppercase">07 — Join us</span>
              </div>

              <h2 className="font-display text-[clamp(3rem,7.5vw,7rem)] text-[#FAF6F0] leading-[0.93] mb-7" style={{ fontWeight: 300 }}>
                Ready to<br /><em>show up?</em>
              </h2>

              <p className="text-[#5A5048] text-base leading-[1.75] max-w-sm" style={{ fontWeight: 300 }}>
                A trial class costs nothing but an hour. You&apos;ll know by the end whether this is for you.
              </p>
            </motion.div>
          </div>

          <div className="lg:col-span-5">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.12 }}
              className="border border-[#2A2520] p-9"
            >
              <h3 className="font-display text-2xl text-[#FAF6F0] mb-1" style={{ fontWeight: 400 }}>Book a trial class</h3>
              <p className="text-[#5A5048] text-sm mb-8" style={{ fontWeight: 300 }}>Tell us which batch. We&apos;ll take it from there.</p>

              <div className="space-y-3 mb-8">
                <a
                  href="tel:+91XXXXXXXXXX"
                  className="group w-full flex items-center justify-between px-6 py-4 bg-[#E8722A] text-[#FAF6F0] text-xs tracking-[0.2em] uppercase hover:bg-[#C45E1A] transition-colors duration-300"
                >
                  Book a Trial
                  <span className="block w-4 h-px bg-current transition-all duration-300 group-hover:w-7" />
                </a>
                <a
                  href="https://wa.me/91XXXXXXXXXX"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group w-full flex items-center justify-between px-6 py-4 border border-[#2A2520] text-[#FAF6F0]/60 text-xs tracking-[0.2em] uppercase hover:border-[#E8722A] hover:text-[#E8722A] transition-all duration-300"
                >
                  WhatsApp Us
                  <span className="block w-4 h-px bg-current transition-all duration-300 group-hover:w-7" />
                </a>
              </div>

              <div className="pt-7 border-t border-[#2A2520]">
                <span className="block text-[9px] tracking-[0.28em] uppercase text-[#3A3228] mb-3">Interested in</span>
                <div className="flex flex-wrap gap-2">
                  {["5:45 AM", "8:20 AM", "Third batch"].map((b) => (
                    <span
                      key={b}
                      className="px-3 py-1.5 border border-[#2A2520] text-[#5A5048] text-[11px] tracking-[0.1em] hover:border-[#E8722A] hover:text-[#E8722A] cursor-pointer transition-colors duration-300 tabular-nums"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 1 }}
          className="mt-20 pt-7 border-t border-[#181510] flex flex-col md:flex-row items-start md:items-center justify-between gap-5"
        >
          <span className="font-display text-xl tracking-[0.1em] text-[#FAF6F0]/25" style={{ fontWeight: 500 }}>
            Just Fitness Club
          </span>
          <div className="flex flex-wrap gap-7">
            {["About", "Batches", "Services", "Community"].map((l) => (
              <a key={l} href={`#${l.toLowerCase()}`} className="text-[10px] tracking-[0.25em] uppercase text-[#2A2520] hover:text-[#5A5048] transition-colors">
                {l}
              </a>
            ))}
          </div>
          <span className="text-[#1E1A14] text-[10px]" style={{ fontWeight: 300 }}>
            © {new Date().getFullYear()} Just Fitness Club
          </span>
        </motion.div>
      </div>
    </section>
  );
}
