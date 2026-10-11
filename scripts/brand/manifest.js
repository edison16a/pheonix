/**
 * Web app manifest as a JSON string. Icon srcs carry ?v=3 because browsers cache tab and app icons
 * hard: bump it whenever the artwork changes.
 */
export function manifestJson() {
  return (
    JSON.stringify(
      {
        name: 'Pheonix',
        short_name: 'Pheonix',
        description: 'An immersive 3D globe for exploring public cameras.',
        start_url: '/',
        display: 'standalone',
        theme_color: '#0a0809',
        background_color: '#0a0809',
        icons: [
          {
            src: '/brand/icon-192.png?v=3',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/brand/icon-512.png?v=3',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/brand/icon-maskable-512.png?v=3',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/brand/favicon.svg?v=3',
            sizes: 'any',
            type: 'image/svg+xml',
          },
        ],
      },
      null,
      2,
    ) + '\n'
  );
}
