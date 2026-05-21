export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);

  if (url.hostname === 'erikov.me' || url.hostname === 'www.erikov.me') {
    url.hostname = 'by.erikov.me';
    return Response.redirect(url.toString(), 301);
  }

  return context.next();
};
