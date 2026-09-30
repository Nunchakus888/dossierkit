// Retire the old standalone Cowork note, including its previously cached URL.
export const onRequest = () =>
  new Response(null, {
    status: 410,
    headers: {
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
