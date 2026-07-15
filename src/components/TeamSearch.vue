<script setup lang="ts">
import { ref, watch } from 'vue';

interface Team {
  id: number;
  name: string;
  logo: string | null;
  country: string | null;
}

const query = ref('');
const results = ref<Team[]>([]);
const loading = ref(false);
const error = ref('');
const searched = ref(false);
const following = ref<number | null>(null);
const followed = ref<Set<number>>(new Set());

let timer: ReturnType<typeof setTimeout> | undefined;

watch(query, (q) => {
  clearTimeout(timer);
  error.value = '';
  if (q.trim().length < 2) {
    results.value = [];
    searched.value = false;
    return;
  }
  timer = setTimeout(() => runSearch(q.trim()), 300);
});

async function runSearch(q: string) {
  loading.value = true;
  try {
    const res = await fetch('/api/teams/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ q }),
    });
    if (!res.ok) throw new Error('falhou');
    results.value = (await res.json()) as Team[];
    searched.value = true;
  } catch {
    error.value = 'Não deu pra buscar agora. Tente de novo.';
  } finally {
    loading.value = false;
  }
}

async function follow(team: Team) {
  following.value = team.id;
  try {
    const res = await fetch('/api/subscriptions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ team }),
    });
    if (!res.ok) throw new Error('falhou');
    followed.value = new Set(followed.value).add(team.id);
  } catch {
    error.value = 'Não deu pra seguir agora. Tente de novo.';
  } finally {
    following.value = null;
  }
}
</script>

<template>
  <div>
    <label class="relative block">
      <span class="sr-only">Buscar time</span>
      <input
        v-model="query"
        type="search"
        inputmode="search"
        autocomplete="off"
        placeholder="Buscar um time — ex.: Fluminense"
        class="w-full rounded-xl border border-line bg-pitch-850 px-4 py-3.5 text-chalk placeholder:text-chalk-dim focus:border-flood focus:outline-none"
      />
      <span
        v-if="loading"
        class="absolute top-1/2 right-4 -translate-y-1/2 text-xs text-chalk-dim"
        >buscando…</span
      >
    </label>

    <p v-if="error" class="mt-3 text-sm text-flood">{{ error }}</p>

    <ul v-if="results.length" class="mt-4 space-y-2">
      <li
        v-for="team in results"
        :key="team.id"
        class="card flex items-center gap-3 p-3"
      >
        <img
          v-if="team.logo"
          :src="team.logo"
          :alt="''"
          class="h-9 w-9 shrink-0 object-contain"
          loading="lazy"
          width="36"
          height="36"
        />
        <span
          v-else
          class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-pitch-800 text-chalk-dim"
          aria-hidden="true"
          >⚽</span
        >
        <span class="min-w-0 flex-1">
          <span class="block truncate font-medium text-chalk">{{ team.name }}</span>
          <span v-if="team.country" class="block truncate text-xs text-chalk-dim">{{
            team.country
          }}</span>
        </span>
        <button
          v-if="followed.has(team.id)"
          class="btn btn-ghost text-xs"
          disabled
        >
          ✓ Seguindo
        </button>
        <button
          v-else
          class="btn btn-flood text-xs"
          :disabled="following === team.id"
          @click="follow(team)"
        >
          {{ following === team.id ? '…' : 'Seguir' }}
        </button>
      </li>
    </ul>

    <p
      v-else-if="searched && !loading"
      class="mt-4 text-sm text-chalk-dim"
    >
      Nenhum time encontrado pra “{{ query }}”.
    </p>

    <div
      v-if="followed.size"
      class="mt-6 rounded-xl border border-flood/40 bg-flood/5 p-4 text-sm"
    >
      Pronto! Agora conecte sua agenda em
      <a href="/meus-times" class="font-semibold text-flood underline">Meus times</a>.
    </div>
  </div>
</template>
