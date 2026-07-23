"use client";

import { motion } from "framer-motion";

const services = [
  { n: "01", title: "Guided Group Classes", desc: "Every session coached. No guessing. Clear purpose, every rep." },
  { n: "02", title: "Progress Tracking", desc: "Your baseline is recorded. You'll see how far you've come." },
  { n: "03", title: "Accountability Check-ins", desc: "Missing sessions gets noticed — in a good way." },
  { n: "04", title: "Personalised Coaching", desc: "Group setting. Your form, your pace. Addressed in class." },
  { n: "05", title: "Wellness Guidance", desc: "Sleep, recovery, daily movement. It all connects." },
  { n: "06", title: "Community Access", desc: "The group, the people, the chat. Built in, not an add-on." },
];

export default function Services() {
  return (
    <section id="services" className="bg-[#FAF6F0] py-20 md:py-32 border-t border-[#E6DDD4]">
      <div className="mx-auto max-w-7xl px-6 md:px-14 lg:px-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 mb-16">
          <div className="lg:col-span-5">
            <div className="flex items-center gap-4 mb-5">
              <span className="block w-6 h-px bg-[#E8722A]" />
              <span className="text-[#9A9088] text-[10px] tracking-[0.3em] uppercase">03 — What you get</span>
            </div>
            <h2
              className="font-display text-[clamp(2.5rem,4.5vw,4rem)] text-[#131110] leading-[1.08]"
              style={{ fontWeight: 400 }}
            >
              More than
              <br />
              <em style={{ fontWeight: 300 }}>a workout.</em>
            </h2>
          </div>
          <div className="lg:col-span-7 flex items-end">
            <p className="text-[#6B6258] text-base leading-[1.75] max-w-lg" style={{ fontWeight: 300 }}>
              Everything that makes coming back feel worthwhile — not just the hour you&apos;re here.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-[#E6DDD4]">
          {services.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: (i % 3) * 0.07 }}
              whileHover={{ y: -2 }}
              className="bg-[#FAF6F0] p-8 flex flex-col gap-4 group cursor-default"
            >
              <div className="flex items-start justify-between">
                <span className="font-display text-[2.5rem] leading-none text-[#E6DDD4] group-hover:text-[#D4C8BC] transition-colors duration-300" style={{ fontWeight: 300 }}>
                  {s.n}
                </span>
                <motion.div
                  className="w-4 h-px bg-[#E8722A] mt-3 origin-left"
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.15 + i * 0.05 }}
                />
              </div>
              <h3 className="font-display text-[1.3rem] leading-snug text-[#131110] group-hover:text-[#E8722A] transition-colors duration-300" style={{ fontWeight: 500 }}>
                {s.title}
              </h3>
              <p className="text-[#9A9088] text-sm leading-relaxed" style={{ fontWeight: 300 }}>
                {s.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
