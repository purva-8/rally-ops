"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback } from "react";

const testimonials = [
  {
    quote: "I joined thinking I'd try it for a month. That was eight months ago. The coach notices if you're not moving right, and fixes it there and then.",
    name: "Priya R.",
    detail: "8 months · 5:45 AM batch",
  },
  {
    quote: "I've had gym memberships my whole life and never actually used them. The batch format changed something — you have a time, people are expecting you. It works.",
    name: "Meera S.",
    detail: "6 months · 8:20 AM batch",
  },
  {
    quote: "I hadn't worked out in years. Within two weeks the nervousness went away. Everyone here is just trying to show up for themselves.",
    name: "Divya K.",
    detail: "4 months · 5:45 AM batch",
  },
  {
    quote: "I didn't expect to actually enjoy it. The morning batch sets the tone for the whole day. I've been more consistent here than anywhere else.",
    name: "Ananya M.",
    detail: "5 months · 8:20 AM batch",
  },
];

export default function Testimonials() {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);

  const easeOut: [number, number, number, number] = [0.16, 1, 0.3, 1];
  const easeIn: [number, number, number, number] = [0.4, 0, 1, 1];

  const next = useCallback(() => {
    setDirection(1);
    setCurrent((c) => (c + 1) % testimonials.length);
  }, []);

  const goTo = useCallback((i: number) => {
    setDirection(i > current ? 1 : -1);
    setCurrent(i);
  }, [current]);

  useEffect(() => {
    const t = setInterval(next, 5500);
    return () => clearInterval(t);
  }, [next]);

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? 40 : -40, opacity: 0 }),
    center: { x: 0, opacity: 1, transition: { duration: 0.7, ease: easeOut } },
    exit: (d: number) => ({ x: d > 0 ? -40 : 40, opacity: 0, transition: { duration: 0.35, ease: easeIn } }),
  };

  const t = testimonials[current];

  return (
    <section id="community" className="bg-[#F0E9DF] py-20 md:py-32">
      <div className="mx-auto max-w-7xl px-6 md:px-14 lg:px-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">

          <div className="lg:col-span-4">
            <div className="flex items-center gap-4 mb-5">
              <span className="block w-6 h-px bg-[#E8722A]" />
              <span className="text-[#9A9088] text-[10px] tracking-[0.3em] uppercase">04 — Community</span>
            </div>
            <h2 className="font-display text-[clamp(2.2rem,4vw,3.5rem)] text-[#131110] leading-[1.08] mb-6" style={{ fontWeight: 400 }}>
              From the<br /><em style={{ fontWeight: 300 }}>people here.</em>
            </h2>
            <p className="text-[#9A9088] text-sm leading-relaxed" style={{ fontWeight: 300 }}>
              Things people said — in the group, after class, when asked.
            </p>

            <div className="flex gap-2 mt-10">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className="relative h-0.5 flex-1 max-w-[44px] bg-[#D4C8BC] overflow-hidden"
                >
                  {i === current && (
                    <motion.div layoutId="bar" className="absolute inset-0 bg-[#E8722A]" transition={{ duration: 0.3 }} />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-8 relative min-h-[260px]">
            <AnimatePresence custom={direction} mode="wait">
              <motion.div
                key={current}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                className="bg-[#FAF6F0] p-10 md:p-12"
              >
                <span className="font-display text-[5rem] leading-none text-[#E6DDD4] block mb-1" style={{ fontWeight: 300, lineHeight: 0.65 }} aria-hidden>&ldquo;</span>

                <blockquote className="font-display text-[clamp(1.25rem,2.4vw,1.75rem)] leading-[1.5] text-[#131110] mb-9 italic" style={{ fontWeight: 300 }}>
                  {t.quote}
                </blockquote>

                <div className="flex items-center gap-5 border-t border-[#E6DDD4] pt-7">
                  <div className="w-8 h-8 rounded-full bg-[#E6DDD4] flex items-center justify-center shrink-0">
                    <span className="font-display text-sm text-[#9A9088]" style={{ fontWeight: 400 }}>{t.name[0]}</span>
                  </div>
                  <div>
                    <span className="block text-sm text-[#131110] mb-0.5" style={{ fontWeight: 500 }}>{t.name}</span>
                    <span className="text-[#9A9088] text-xs" style={{ fontWeight: 300 }}>{t.detail}</span>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="flex gap-3 mt-5 justify-end">
              {[
                { label: "←", fn: () => goTo((current - 1 + testimonials.length) % testimonials.length) },
                { label: "→", fn: () => goTo((current + 1) % testimonials.length) },
              ].map((btn) => (
                <button
                  key={btn.label}
                  onClick={btn.fn}
                  className="w-10 h-10 border border-[#D4C8BC] flex items-center justify-center text-[#9A9088] hover:border-[#E8722A] hover:text-[#E8722A] transition-colors duration-300 text-sm"
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
