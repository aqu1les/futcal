<script setup lang="ts">
import { computed, ref } from 'vue';

interface Team {
  id: number;
  name: string;
  logo: string | null;
  country: string | null;
}

const props = defineProps<{
  teams: Team[];
  calToken: string;
  host: string;
}>();

const teams = ref<Team[]>([...props.teams]);
const removing = ref<number | null>(null);
const copied = ref(false);

const feedUrl = computed(() => `https://${props.host}/cal/${props.calToken}.ics`);
const webcalUrl = computed(() => `webcal://${props.host}/cal/${props.calToken}.ics`);
const googleUrl = computed(
  () => `https://calendar.google.com/calendar/r?cid=${webcalUrl.value}`,
);

async function remove(team: Team) {
  removing.value = team.id;
  try {
    const res = await fetch(`/api/subscriptions/${team.id}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) throw new Error('falhou');
    teams.value = teams.value.filter((t) => t.id !== team.id);
  } catch {
    // deixa na lista; usuário pode tentar de novo
  } finally {
    removing.value = null;
  }
}

async function copy() {
  try {
    await navigator.clipboard.writeText(feedUrl.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  } catch {
    copied.value = false;
  }
}
</script>

<template>
  <div>
    <ul v-if="teams.length" class="space-y-2">
      <li
        v-for="team in teams"
        :key="team.id"
        class="card flex items-center gap-3 p-3"
      >
        <img
          v-if="team.logo"
          :src="team.logo"
          alt=""
          class="h-9 w-9 shrink-0 object-contain"
          width="36"
          height="36"
        />
        <span
          v-else
          class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-pitch-800 text-chalk-dim"
          aria-hidden="true"
          >⚽</span
        >
        <span class="min-w-0 flex-1 truncate font-medium text-chalk">{{
          team.name
        }}</span>
        <button
          class="btn btn-ghost text-xs"
          :disabled="removing === team.id"
          @click="remove(team)"
        >
          {{ removing === team.id ? '…' : 'Remover' }}
        </button>
      </li>
    </ul>

    <div v-else class="card p-6 text-center text-chalk-dim">
      Você ainda não segue nenhum time.<br />
      <a href="/" class="font-semibold text-flood underline">Buscar um time</a>
    </div>

    <!-- Conectar agenda -->
    <div v-if="teams.length" class="mt-8">
      <p class="eyebrow mb-4">Conectar agenda</p>

      <div class="card p-4">
        <label class="mb-2 block text-xs text-chalk-dim">Link do calendário</label>
        <div class="flex gap-2">
          <input
            :value="feedUrl"
            readonly
            class="min-w-0 flex-1 rounded-lg border border-line bg-pitch-900 px-3 py-2 font-mono text-xs text-chalk-dim"
            @focus="($event.target as HTMLInputElement).select()"
          />
          <button class="btn btn-flood text-xs whitespace-nowrap" @click="copy">
            {{ copied ? '✓ Copiado' : 'Copiar' }}
          </button>
        </div>

        <a
          :href="googleUrl"
          target="_blank"
          rel="noopener"
          class="btn btn-ghost mt-3 w-full text-sm"
        >
          Adicionar no Google Calendar
        </a>

        <p class="mt-4 text-xs leading-relaxed text-chalk-dim">
          <span class="text-chalk">Apple Calendar:</span> Arquivo → Nova assinatura
          de calendário e cole o link acima. No iPhone: Ajustes → Calendário →
          Contas → Adicionar assinatura.
        </p>
      </div>
    </div>
  </div>
</template>
