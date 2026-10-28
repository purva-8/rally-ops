'use client';

import { useParams } from 'next/navigation';
import ResultsView from './ResultsView';

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  return <ResultsView id={id} />;
}
