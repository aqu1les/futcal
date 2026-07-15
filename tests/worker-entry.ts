// Entry mínimo só para o pool de testes instanciar um Worker.
// O código real é testado via `env` (D1) e funções importadas diretamente,
// sem depender do build do adapter Astro.
export default {
  async fetch(): Promise<Response> {
    return new Response('test worker');
  },
};
