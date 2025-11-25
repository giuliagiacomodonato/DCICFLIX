import './globals.css';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'DCICFLIX',
  description: 'Microservicios Movie App',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <header className="main-header">
            <div className="logo">DCICFLIX</div>
            <nav>
                <a href="#">Películas</a>
                <a href="#">Series</a>
                <a href="#">Documentales</a>
            </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
