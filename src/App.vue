<script setup>
import { computed, onMounted, ref } from 'vue';
import { languages, manifestoRows } from './content';
import { submitVote, subscribeVoteTotals, voteOptions } from './firebase';

const currentLanguage = ref('uk');
const totals = ref({ I: 0, II: 0, III: 0, IV: 0, V: 0 });
const pendingVote = ref('I');
const statusMessage = ref('');
const statusType = ref('');

const voterKey = 'manifest-voter-id';

function getVoterId() {
  let id = localStorage.getItem(voterKey);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(voterKey, id);
  }
  return id;
}

const totalVotes = computed(() => Object.values(totals.value).reduce((sum, value) => sum + value, 0));

const rankedVotes = computed(() => {
  const rows = manifestoRows[currentLanguage.value];
  return voteOptions
    .map((option) => {
      const row = rows.find((item) => item[0] === option);
      const count = totals.value[option] ?? 0;
      const percent = totalVotes.value === 0 ? 0 : Math.round((count / totalVotes.value) * 100);
      return {
        option,
        reform: row?.[1] || option,
        count,
        percent
      };
    })
    .sort((a, b) => b.count - a.count);
});

async function vote() {
  const locale = languages[currentLanguage.value];
  statusMessage.value = '';
  statusType.value = '';

  try {
    await submitVote(pendingVote.value, getVoterId());
    statusMessage.value = locale.voteDone;
    statusType.value = 'ok';
  } catch (error) {
    if (error.message.includes('already voted')) {
      statusMessage.value = locale.alreadyVoted;
      statusType.value = 'warn';
      return;
    }

    statusMessage.value = `${locale.errorPrefix}${error.message}`;
    statusType.value = 'error';
  }
}

onMounted(() => {
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith('ru')) {
    currentLanguage.value = 'ru';
  } else if (browserLang.startsWith('en')) {
    currentLanguage.value = 'en';
  }

  subscribeVoteTotals((nextTotals) => {
    totals.value = nextTotals;
  });
});
</script>

<template>
  <main class="page">
    <header class="card">
      <div class="lang-switcher">
        <button
          v-for="(value, key) in languages"
          :key="key"
          :class="['lang-btn', { active: key === currentLanguage }]"
          @click="currentLanguage = key"
        >
          {{ value.label }}
        </button>
      </div>
      <h1>{{ languages[currentLanguage].title }}</h1>
      <p class="intro">{{ languages[currentLanguage].intro }}</p>
    </header>

    <section class="card">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th v-for="header in languages[currentLanguage].tableHeaders" :key="header">{{ header }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in manifestoRows[currentLanguage]" :key="row[0]">
              <td v-for="cell in row" :key="cell">{{ cell }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>{{ languages[currentLanguage].flowTitle }}</h2>
      <ol>
        <li v-for="step in languages[currentLanguage].flow" :key="step">{{ step }}</li>
      </ol>
      <p class="question">{{ languages[currentLanguage].endQuestion }}</p>
    </section>

    <section class="card">
      <h2>{{ languages[currentLanguage].importantQuestion }}</h2>
      <div class="vote-controls">
        <select v-model="pendingVote">
          <option v-for="row in manifestoRows[currentLanguage]" :key="row[0]" :value="row[0]">
            {{ row[0] }} — {{ row[1] }}
          </option>
        </select>
        <button @click="vote">{{ languages[currentLanguage].voteCta }}</button>
      </div>
      <p v-if="statusMessage" :class="['status', statusType]">{{ statusMessage }}</p>

      <h3>{{ languages[currentLanguage].rankingTitle }}</h3>
      <p class="total">Total votes: {{ totalVotes }}</p>
      <ul class="ranking">
        <li v-for="item in rankedVotes" :key="item.option">
          <div class="rank-head">
            <span>{{ item.option }} — {{ item.reform }}</span>
            <strong>{{ item.count }} ({{ item.percent }}%)</strong>
          </div>
          <div class="bar">
            <div class="bar-fill" :style="{ width: `${item.percent}%` }"></div>
          </div>
        </li>
      </ul>
    </section>
  </main>
</template>
