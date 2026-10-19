importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');
firebase.initializeApp(Object.fromEntries(new URL(self.location).searchParams));
firebase.messaging();

// Notificações mostradas pelo próprio app (com ele aberto) abrem a área do aluno ao tocar.
self.addEventListener('notificationclick', (event) => {
  const dados = event.notification.data || {};
  if (dados.FCM_MSG || !dados.url) return;
  event.notification.close();
  event.waitUntil((async () => {
    const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const aberta = janelas.find((j) => new URL(j.url).pathname.startsWith('/area-aluno'));
    if (aberta) return aberta.focus();
    return self.clients.openWindow(dados.url);
  })());
});
