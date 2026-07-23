"use client";

import { motion } from "framer-motion";

const items = [
  { n: "01", title: "Recovery Guidance", desc: "Post-session cool-down, rest day recommendations, sleep advice." },
  { n: "02", title: "Nutrition Basics", desc: "Pre/post-workout meals, hydration, general food timing guidance." },
  { n: "03", title: "Member Essentials", desc: "Support tools available during coaching. Ask during consultation." },
];

export default function MemberSupport() {
  return (
    <section className="bg-[#FAF6F0] py-20 md:py-28 border-t border-[#E6DDD4]">
      <div className="mx-auto max-w-7xl px-6 md:px-14 lg:px-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-4">
            <div className="flex items-center gap-4 mb-5">
              <span className="block w-6 h-px bg-[#E8722A]" />
              <span className="text-[#9A9088] text-[10px] tracking-[0.3em] uppercase">06 — Support</span>
            </div>
            <h2 className="font-display text-[clamp(2.2rem,4vw,3.5rem)] text-[#131110] leading-[1.08] mb-5" style={{ fontWeight: 400 }}>
              Beyond the<br /><em style={{ fontWeight: 300 }}>session.</em>
            </h2>
            <p className="text-[#9A9088] text-sm leading-relaxed mb-8" style={{ fontWeight: 300 }}>
              What happens between classes matters just as much as what happens during them.
            </p>
            <div className="p-5 border border-[#E6DDD4] bg-[#F0E9DF]">
              <span className="block text-[10px] tracking-[0.28em] uppercase text-[#E8722A] mb-2" style={{ fontWeight: 400 }}>Note</span>
              <p className="text-[#6B6258] text-xs leading-relaxed" style={{ fontWeight: 300 }}>
                We don&apos;t partner with any brand or supplement company. Everything shared is based on what your body actually needs.
              </p>
            </div>
          </div>

          <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-3 gap-px bg-[#E6DDD4]">
            {items.map((item, i) => (
              <motion.div
                key={item.n}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: i * 0.09 }}
                className="bg-[#FAF6F0] p-8 flex flex-col"
              >
                <div className="w-4 h-px bg-[#E8722A] mb-5" />
                <h3 className="text-sm tracking-[0.1em] text-[#131110] mb-6" style={{ fontWeight: 500 }}>{item.title}</h3>
                <p className="text-[#9A9088] text-sm leading-relaxed mt-auto" style={{ fontWeight: 300 }}>{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
