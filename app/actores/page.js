import { Suspense } from 'react';
import ActorsView from '@/components/ActorsView';

export const metadata = { title: 'Actores' };

export default function ActoresPage() {
  return (
    <Suspense fallback={null}>
      <ActorsView />
    </Suspense>
  );
}
