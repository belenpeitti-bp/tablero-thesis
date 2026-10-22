import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="page narrow">
      <h1 className="page-title">Esta página no existe</h1>
      <p>
        <Link href="/">Volver al índice de la tesis</Link>
      </p>
    </div>
  );
}
