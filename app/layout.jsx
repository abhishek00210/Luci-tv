import './globals.css';

export const metadata = {
  title: 'Luci-TV',
  description: 'Luci-TV movie and series browser',
  icons: {
    icon: '/favicon.svg',
  },
};

export const viewport = {
  themeColor: '#09090b',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
