"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

const batches = [
  {
    time: "5:45",
    period: "AM",
    label: "Early Risers",
    tagline: "Start before the city wakes up.",
    suits: "Working women, early starters",
    energy: "Focused & grounded",
    duration: "55 min",
    days: "Mon · Wed · Fri",
    slots: "Limited spots",
    detail: "Done before most people hit snooze. Calm, deliberate, and intense where it counts.",
  },
  {
    time: "8:20",
    period: "AM",
    label: "Mid-Morning",
    tagline: "The one you'll actually look forward to.",
    suits: "Homemakers, freelancers, flexible schedules",
    energy: "Energetic & social",
    duration: "55 min",
    days: "Tue · Thu · Sat",
    slots: "A few spots open",
    detail: "More warmth, more conversation between reps. Still hard work — but the kind you enjoy.",
  },
  {
    time: "TBA",
    period: "",
    label: "Third Batch",
    tagline: "Something new is coming.",
    suits: "Register your interest now",
    energy: "To be announced",
    duration: "55 min",
    days: "Days TBD",
    slots: "Waitlist open",
    detail: "We're planning a third batch based on demand. Tell us when works for you.",
  },
];

export default function BatchTimings() {
  const [active, setActive] = useState<number | null>(null);

  return (
    <section id="batches" className="bg-[#131110] py-20 md:py-32 relative overflow-hidden grain">
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, #FAF6F0 0px, #FAF6F0 1px, transparent 1px, transparent 64px), repeating-linear-gradient(90deg, #FAF6F0 0px, #FAF6F0 1px, transparent 1px, transparent 64px)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-7xl px-6 md:px-14 lg:px-20">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="mb-16"
        >
          <div className="flex items-center gap-4 mb-5">
            <span className="block w-6 h-px bg-[#E8722A]" />
            <span className="text-[#5A5048] text-[10px] tracking-[0.3em] uppercase">02 — Schedule</span>
          </div>
          <h2
            className="font-display text-[clamp(2.5rem,5.5vw,5rem)] text-[#FAF6F0] leading-[1.0]"
            style={{ fontWeight: 300 }}
          >
            Pick your batch.
            <br />
            <em>Own your morning.</em>
          </h2>
        </motion.div>

        <div className="border-t border-[#2A2520]">
          {batches.map((batch, i) => {
            const isActive = active === i;
            const isTBA = batch.time === "TBA";

            return (
              <div key={i} className="border-b border-[#2A2520] overflow-hidden">
                <motion.button
                  className="w-full text-left py-7 md:py-9 flex items-center gap-6 md:gap-10"
                  onClick={() => setActive(isActive ? null : i)}
                  whileTap={{ scale: 0.998 }}
                >
                  <span className="text-[#2A2520] text-sm w-7 shrink-0" style={{ fontWeight: 400 }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  <div className="flex items-baseline gap-2 min-w-[130px] md:min-w-[190px]">
                    <span
                      className="font-display tabular-nums text-[clamp(2.8rem,6vw,5rem)] leading-none transition-colors duration-300"
                      style={{ fontWeight: 300, color: isActive ? "#E8722A" : "#FAF6F0" }}
                    >
                      {batch.time}
                    </span>
                    {batch.period && (
                      <span className="text-[#5A5048] text-sm">{batch.period}</span>
                    )}
                  </div>

                  <div className="flex-1 hidden md:block">
                    <span
                      className="block text-xs tracking-[0.22em] uppercase mb-1 transition-colors duration-300"
                      style={{ fontWeight: 400, color: isActive ? "#E8722A" : "#5A5048" }}
                    >
                      {batch.label}
                    </span>
                    <span className="font-display text-lg text-[#FAF6F0]/35 italic" style={{ fontWeight: 300 }}>
                      {batch.tagline}
                    </span>
                  </div>

                  <div className="ml-auto flex items-center gap-3 shrink-0">
                    <span
                      className="text-[10px] tracking-[0.2em] uppercase"
                      style={{ color: isActive ? "#E8722A" : "#3A3228" }}
                    >
                      {isActive ? "Close" : "Details"}
                    </span>
                    <span
                      className="block w-7 h-px"
                      style={{ background: isActive ? "#E8722A" : "#3A3228" }}
                    />
                  </div>
                </motion.button>

                <AnimatePresence initial={false}>
                  {isActive && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="pl-14 md:pl-[calc(130px+2.5rem)] pb-9 pr-6">
                        <motion.div
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.35, delay: 0.08 }}
                          className="grid grid-cols-1 md:grid-cols-2 gap-8"
                        >
                          <div>
                            <p className="text-[#6B6258] text-sm leading-[1.75] mb-7" style={{ fontWeight: 300 }}>
                              {batch.detail}
                            </p>
                            <div className="flex flex-wrap gap-3">
                              {[
                                { k: "Duration", v: batch.duration },
                                { k: "Days", v: batch.days },
                                { k: "Slots", v: batch.slots },
                              ].map((m) => (
                                <div key={m.k} className="px-4 py-2 border border-[#2A2520]">
                                  <span className="block text-[9px] tracking-[0.25em] uppercase text-[#3A3228] mb-0.5">{m.k}</span>
                                  <span className="text-[#FAF6F0] text-xs" style={{ fontWeight: 400 }}>{m.v}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <div className="mb-5">
                              <span className="block text-[9px] tracking-[0.28em] uppercase text-[#E8722A] mb-2">Best for</span>
                              <p className="text-[#6B6258] text-sm" style={{ fontWeight: 300 }}>{batch.suits}</p>
                            </div>
                            <div className="mb-7">
                              <span className="block text-[9px] tracking-[0.28em] uppercase text-[#E8722A] mb-2">Batch energy</span>
                              <p className="text-[#6B6258] text-sm" style={{ fontWeight: 300 }}>{batch.energy}</p>
                            </div>

                            {isTBA ? (
                              <a href="#cta" className="inline-flex items-center gap-3 px-5 py-3 border border-[#E8722A] text-[#E8722A] text-xs tracking-[0.18em] uppercase hover:bg-[#E8722A] hover:text-[#131110] transition-all duration-300">
                                Join Waitlist <span className="w-4 h-px bg-current block" />
                              </a>
                            ) : (
                              <a href="#cta" className="inline-flex items-center gap-3 px-5 py-3 bg-[#E8722A] text-[#FAF6F0] text-xs tracking-[0.18em] uppercase hover:bg-[#C45E1A] transition-all duration-300">
                                Inquire Now <span className="w-4 h-px bg-current block" />
                              </a>
                            )}
                          </div>
                        </motion.div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3, duration: 1 }}
          className="mt-10 text-[#3A3228] text-xs tracking-[0.1em] text-center"
          style={{ fontWeight: 300 }}
        >
          Batch sizes are kept small on purpose.
        </motion.p>
      </div>
    </section>
  );
}
