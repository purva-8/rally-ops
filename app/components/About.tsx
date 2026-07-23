"use client";

import { motion } from "framer-motion";

const pillars = [
  { label: "Consistency", desc: "3x a week builds everything." },
  { label: "Community", desc: "The room is half the reason you return." },
  { label: "Coaching", desc: "Guided reps. Corrected form. Real attention." },
];

export default function About() {
  return (
    <section id="about" className="bg-[#FAF6F0] py-20 md:py-32 overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 md:px-14 lg:px-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-start">

          {/* Left — photo */}
          <div className="lg:col-span-5">
            <div className="flex items-start gap-5 mb-8">
              <span className="font-display text-[5rem] leading-none text-[#E6DDD4] select-none" style={{ fontWeight: 300 }}>01</span>
              <div className="pt-5">
                <span className="block w-5 h-px bg-[#E8722A] mb-3" />
                <span className="text-[10px] tracking-[0.28em] uppercase text-[#9A9088]">About</span>
              </div>
            </div>

            {/* Photo placeholder */}
            <div className="relative overflow-hidden" style={{ aspectRatio: "4/5" }}>
              <div
                className="w-full h-full"
                style={{
                  background: "linear-gradient(155deg, #2C2218 0%, #1A1310 45%, #3D2D20 100%)",
                }}
              />
              <div
                className="absolute inset-0"
                style={{
                  background: "radial-gradient(ellipse 65% 55% at 42% 52%, rgba(232,114,42,0.1) 0%, transparent 65%)",
                }}
              />
              <div className="absolute bottom-5 left-5">
                <span className="text-[#FAF6F0]/35 text-[10px] tracking-[0.22em] uppercase">Place photo here</span>
              </div>
            </div>
          </div>

          {/* Right — copy */}
          <div className="lg:col-span-7 lg:pt-20">
            <motion.h2
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="font-display text-[clamp(2.4rem,4.5vw,4rem)] leading-[1.08] text-[#131110] mb-8"
              style={{ fontWeight: 400 }}
            >
              Not a gym.
              <br />
              <em style={{ fontWeight: 300 }}>A community that trains.</em>
            </motion.h2>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
              className="space-y-4 text-[#6B6258] text-base leading-[1.75]"
              style={{ fontWeight: 300 }}
            >
              <p>
                Every session is coached. You know exactly what you&apos;re doing and why. Batches are small — you get seen, your form is corrected, your progress is tracked.
              </p>
              <p>
                Whether you&apos;re starting out or coming back after a gap — this space is built for real women. You&apos;ll be challenged, supported, and celebrated just for showing up.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="mt-8 flex items-center gap-4"
            >
              <span className="block w-6 h-px bg-[#E8722A]" />
              <span className="text-[#E8722A] text-xs tracking-[0.2em] uppercase" style={{ fontWeight: 400 }}>
                Beginner-friendly · All levels welcome
              </span>
            </motion.div>

            {/* Pillars */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.25 }}
              className="mt-12 grid grid-cols-3 gap-6 border-t border-[#E6DDD4] pt-10"
            >
              {pillars.map((p, i) => (
                <motion.div
                  key={p.label}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.1 + i * 0.08 }}
                >
                  <div className="w-4 h-px bg-[#E8722A] mb-3" />
                  <h3 className="font-display text-lg text-[#131110] mb-1" style={{ fontWeight: 500 }}>{p.label}</h3>
                  <p className="text-[#9A9088] text-xs leading-relaxed" style={{ fontWeight: 300 }}>{p.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
