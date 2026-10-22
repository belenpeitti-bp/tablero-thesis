import './globals.css';
import { StoreProvider } from '@/components/StoreProvider';
import AppFrame from '@/components/AppFrame';

export const metadata = {
  title: 'Tablero de tesis',
  description: 'Índice de trabajo de la tesis doctoral',
  robots: { index: false, follow: false },
};

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#EDF1EA' },
    { media: '(prefers-color-scheme: dark)', color: '#141B20' },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&family=Spectral:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap"
        />
      </head>
      <body>
        <StoreProvider>
          <AppFrame>{children}</AppFrame>
        </StoreProvider>
      </body>
    </html>
  );
}
