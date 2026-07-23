"use client";

import { motion } from "framer-motion";
import { useState } from "react";

const clips = [
  { label: "Morning warm-up" },
  { label: "Group class" },
  { label: "Movement drill" },
  { label: "Community moment" },
  { label: "Coaching cue" },
  { label: "Post-class" },
];

const tones = [
  "linear-gradient(135deg, #1E1A14 0%, #2A2218 60%, #151210 100%)",
  "linear-gradient(160deg, #251C14 0%, #181410 50%, #201A14 100%)",
  "linear-gradient(120deg, #1C1814 0%, #2E2418 60%, #151210 100%)",
  "linear-gradient(145deg, #201A14 0%, #28201A 50%, #151210 100%)",
  "linear-gradient(130deg, #151210 0%, #2C2018 70%, #1E1814 100%)",
  "linear-gradient(150deg, #221C14 0%, #151210 50%, #2A2018 100%)",
];

function Tile({ index, label }: { index: number; label: string }) {
  const [hovered, setHovered] = useState(false);
  const isWide = index === 1 || index === 4;

  return (
    <motion.div
      className={`relative overflow-hidden ${isWide ? "col-span-2" : "col-span-1"}`}
      style={{ aspectRatio: isWide ? "16/9" : "3/4" }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      initial={{ opacity: 0, scale: 0.97 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: (index % 3) * 0.09 }}
    >
      <motion.div
        className="absolute inset-0"
        style={{ background: tones[index % tones.length] }}
        animate={{ scale: hovered ? 1.05 : 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      />

      {/* Saffron glow on hover */}
      <div
        className="absolute inset-0 transition-opacity duration-500"
        style={{
          background: "radial-gradient(ellipse 55% 55% at 50% 50%, rgba(232,114,42,0.1) 0%, transparent 70%)",
          opacity: hovered ? 1 : 0,
        }}
      />

      {/* Play button */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        animate={{ opacity: hovered ? 1 : 0.25 }}
        transition={{ duration: 0.3 }}
      >
        <div className="w-11 h-11 rounded-full border border-[#FAF6F0]/30 flex items-center justify-center">
          <div className="w-0 h-0 ml-1" style={{
            borderTop: "5px solid transparent",
            borderBottom: "5px solid transparent",
            borderLeft: "9px solid rgba(249,246,240,0.7)",
          }} />
        </div>
      </motion.div>

      {/* Label */}
      <motion.div
        className="absolute inset-x-0 bottom-0 p-4 pt-8"
        style={{ background: "linear-gradient(to top, rgba(10,8,6,0.75) 0%, transparent 100%)" }}
        animate={{ opacity: hovered ? 1 : 0 }}
        transition={{ duration: 0.3 }}
      >
        <span className="text-[#FAF6F0]/75 text-[10px] tracking-[0.2em] uppercase">{label}</span>
      </motion.div>

      {/* Index */}
      <div className="absolute top-3 left-4">
        <span className="text-[#FAF6F0]/20 text-[9px] tracking-[0.2em]">{String(index + 1).padStart(2, "0")}</span>
      </div>
    </motion.div>
  );
}

export default function VideoGallery() {
  return (
    <section className="bg-[#0A0806] py-20 md:py-28 grain relative overflow-hidden">
      <div className="relative z-10 mx-auto max-w-7xl px-6 md:px-14 lg:px-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-end justify-between gap-6 mb-10"
        >
          <div>
            <div className="flex items-center gap-4 mb-4">
              <span className="block w-6 h-px bg-[#E8722A]" />
              <span className="text-[#3A3228] text-[10px] tracking-[0.3em] uppercase">05 — In session</span>
            </div>
            <h2 className="font-display text-[clamp(2rem,4vw,3.5rem)] text-[#FAF6F0] leading-[1.08]" style={{ fontWeight: 300 }}>
              What it looks like<br /><em>from inside.</em>
            </h2>
          </div>
          <p className="text-[#3A3228] text-sm max-w-[180px] text-right hidden md:block" style={{ fontWeight: 300 }}>
            Real moments.<br />No staging.
          </p>
        </motion.div>

        <div className="grid grid-cols-3 gap-3">
          {clips.map((c, i) => <Tile key={i} index={i} label={c.label} />)}
        </div>
      </div>
    </section>
  );
}
