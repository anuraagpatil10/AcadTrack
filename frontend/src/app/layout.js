import './globals.css';

export const metadata = {
  title: 'AcadTrack ERP',
  description: 'Academic ERP Web Application',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
