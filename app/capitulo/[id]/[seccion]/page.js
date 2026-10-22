import { notFound } from 'next/navigation';
import { ChapterRefs } from '@/components/RefList';

export default async function ChapterRefsPage({ params }) {
  const { id, seccion } = await params;
  if (seccion !== 'bibliografia' && seccion !== 'fuentes') notFound();
  return <ChapterRefs chapterId={id} kind={seccion} />;
}
