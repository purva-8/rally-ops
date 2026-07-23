"use client";

import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { useState } from "react";

export default function Navigation() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useMotionValueEvent(scrollY, "change", (y) => {
    setScrolled(y > 60);
  });

  return (
    <motion.nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-[#FAF6F0]/95 backdrop-blur-sm border-b border-[#E6DDD4]"
          : "bg-transparent"
      }`}
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
    >
      <div className="mx-auto max-w-7xl px-6 py-5 flex items-center justify-between">
        <a
          href="#"
          className={`font-display text-2xl tracking-[0.12em] transition-colors duration-300`}
          style={{
            fontWeight: 500,
            color: scrolled ? "#131110" : "#FAF6F0",
          }}
        >
          Just Fitness Club
        </a>

        <div className="hidden md:flex items-center gap-10">
          {["About", "Batches", "Services", "Community"].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              className="text-xs tracking-[0.18em] uppercase transition-colors duration-300 hover:text-[#E8722A]"
              style={{
                fontWeight: 400,
                color: scrolled ? "#6B6258" : "rgba(250,246,240,0.75)",
              }}
            >
              {item}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <a
            href="#batches"
            className="hidden md:flex items-center gap-2 px-5 py-2.5 text-xs tracking-[0.15em] uppercase transition-all duration-300"
            style={{
              border: scrolled ? "1px solid #131110" : "1px solid rgba(250,246,240,0.5)",
              color: scrolled ? "#131110" : "#FAF6F0",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#E8722A";
              e.currentTarget.style.borderColor = "#E8722A";
              e.currentTarget.style.color = "#FAF6F0";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = scrolled ? "#131110" : "rgba(250,246,240,0.5)";
              e.currentTarget.style.color = scrolled ? "#131110" : "#FAF6F0";
            }}
          >
            Book Trial
          </a>

          <button
            className="md:hidden flex flex-col gap-1.5 p-1"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`block h-px w-6 transition-all duration-300`}
                style={{ background: scrolled ? "#131110" : "#FAF6F0" }}
              />
            ))}
          </button>
        </div>
      </div>

      <motion.div
        initial={false}
        animate={menuOpen ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="md:hidden overflow-hidden bg-[#FAF6F0] border-t border-[#E6DDD4]"
      >
        <div className="px-6 py-6 flex flex-col gap-6">
          {["About", "Batches", "Services", "Community"].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              onClick={() => setMenuOpen(false)}
              className="text-sm tracking-[0.18em] uppercase text-[#6B6258] hover:text-[#E8722A] transition-colors"
            >
              {item}
            </a>
          ))}
          <a
            href="#batches"
            onClick={() => setMenuOpen(false)}
            className="self-start px-5 py-2.5 text-xs tracking-[0.15em] uppercase bg-[#E8722A] text-[#FAF6F0]"
          >
            Book Trial
          </a>
        </div>
      </motion.div>
    </motion.nav>
  );
}
