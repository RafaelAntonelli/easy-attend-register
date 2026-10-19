export type EstadoPush = 'ativo' | 'pendente' | 'negado' | 'nova-aba' | 'indisponivel';

/** Estado atual da permissão de notificações neste aparelho, sem pedir nada ao usuário. */
export function estadoPushInicial(): EstadoPush {
 if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) return 'indisponivel';
 if (window.top !== window.self) return 'nova-aba';
 if (Notification.permission === 'denied') return 'negado';
 return 'pendente';
}

let ouvinte: ((titulo: string) => void) | null = null;
let ouvindo = false;

/** Recebe avisos que chegam com o app aberto, para atualizar a lista na tela. */
export function aoReceberAviso(fn: ((titulo: string) => void) | null) { ouvinte = fn; }

export async function ativarPushPortal() {
 if(window.top!==window.self)throw new Error('Abra o app em uma aba própria ou use o app publicado para permitir notificações.');
 const appId=import.meta.env['VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_APP_ID'];
 const vapidKey=import.meta.env['VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY'];
 const config={apiKey:import.meta.env['VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY'],projectId:import.meta.env['VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_PROJECT_ID'],appId,messagingSenderId:appId?.split(':')[1]??''};
 if(!config.apiKey||!config.projectId||!appId||!vapidKey||!config.messagingSenderId)throw new Error('Notificações ainda não configuradas.');
 const {getMessaging,getToken,isSupported,onMessage}=await import('firebase/messaging');if(!('Notification' in window)||!await isSupported())throw new Error('Este navegador não oferece notificações.');
 const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();if(permission!=='granted')throw new Error('Permita notificações nas configurações deste site para receber avisos.');
 const {initializeApp,getApps}=await import('firebase/app');const app=getApps().find(a=>a.name==='portal-aluno')??initializeApp(config,'portal-aluno');
 const registration=await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${new URLSearchParams(config).toString()}`);
 await navigator.serviceWorker.ready;
 const messaging=getMessaging(app);const token=await getToken(messaging,{vapidKey,serviceWorkerRegistration:registration});if(!token)throw new Error('Não foi possível registrar o aparelho.');
 if(!ouvindo){ouvindo=true;onMessage(messaging,payload=>{const titulo=payload.notification?.title??'Arena Aquática LF';void registration.showNotification(titulo,{body:payload.notification?.body??'Você recebeu um aviso.',icon:'/icons/icon-192x192.png',badge:'/icons/icon-192x192.png',data:{url:'/area-aluno'}});ouvinte?.(titulo);});}
 return token;
}
