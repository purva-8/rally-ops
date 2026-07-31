import PlayerNav from '@/components/PlayerNav';

export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 pb-20">{children}</div>
      <PlayerNav />
    </div>
  );
}
