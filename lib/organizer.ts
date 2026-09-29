// The person who created an event, and any admin staff member (co-organizer) who has accepted an invite.
// Works with either the browser or the server Supabase client, using the signed-in user's own session.
export async function isEventOrganizer(
  supabase: { from: (t: string) => any },
  tournamentId: string,
  userId: string,
  createdBy?: string | null,
): Promise<boolean> {
  if (createdBy && createdBy === userId) return true;
  const { data } = await supabase
    .from('tournament_staff').select('id')
    .eq('tournament_id', tournamentId).eq('user_id', userId).eq('role', 'admin').eq('status', 'active').limit(1);
  return !!data?.length;
}
