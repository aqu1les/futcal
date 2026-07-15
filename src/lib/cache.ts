// `caches.default` é uma extensão do Cloudflare Workers; o tipo global (lib.dom)
// não a conhece, então acessamos com um cast tipado num único lugar.
export const workerCache = (caches as unknown as { default: Cache }).default;
