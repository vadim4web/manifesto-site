<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { languages, manifestoRows } from './content';
import {
  ensureSignedIn,
  firebaseConfigError,
  signInWithGoogle,
  submitVote,
  subscribeAuth,
  subscribeVoteTotals,
  voteOptions
} from './firebase';

const currentLanguage = ref('uk');
const totals = ref({ I: 0, II: 0, III: 0, IV: 0, V: 0 });
const pendingVote = ref('I');
const statusMessage = ref('');
const statusType = ref('');
const authUser = ref(null);
const authReady = ref(false);
const authError = ref('');
const languageStorageKey = 'manifest-language';
const splitEmojiPattern =
  /((?:\p{Regional_Indicator}{2})|(?:\p{Extended_Pictographic}(?:\uFE0F)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F)?)*))/gu;
const exactEmojiPattern =
  /^(?:\p{Regional_Indicator}{2}|(?:\p{Extended_Pictographic}(?:\uFE0F)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F)?)*))$/u;

const locale = computed(() => languages[currentLanguage.value]);
const totalVotes = computed(() => Object.values(totals.value).reduce((sum, value) => sum + value, 0));
const canVote = computed(() => authReady.value && !!authUser.value);
const needsAccountUpgrade = computed(() => authReady.value && !!authUser.value?.isAnonymous);
const authLabel = computed(() => {
  if (!authReady.value) {
    return locale.value.authConnecting;
  }

  if (!authUser.value) {
    return locale.value.authUnavailable;
  }

  if (authUser.value.isAnonymous) {
    return locale.value.authAnonymous;
  }

  return `${locale.value.authSignedInAs} ${authUser.value.displayName || authUser.value.email || authUser.value.phoneNumber}.`;
});

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

function setLanguage(language) {
  currentLanguage.value = language;
}

function splitEmojiText(text) {
  return String(text)
    .split(splitEmojiPattern)
    .filter(Boolean)
    .map((part) => ({
      text: part,
      isEmoji: exactEmojiPattern.test(part)
    }));
}

async function vote() {
  statusMessage.value = '';
  statusType.value = '';

  try {
    await submitVote(pendingVote.value);
    statusMessage.value = locale.value.voteDone;
    statusType.value = 'ok';
  } catch (error) {
    if (error.message.includes('already voted')) {
      statusMessage.value = locale.value.alreadyVoted;
      statusType.value = 'warn';
      return;
    }

    statusMessage.value = `${locale.value.errorPrefix}${error.message}`;
    statusType.value = 'error';
  }
}

async function upgradeAuth() {
  authError.value = '';

  try {
    const user = await signInWithGoogle();
    authUser.value = user;
  } catch (error) {
    console.error('Google account link failed:', error?.code, error?.message, error);
    authError.value = [error?.code, error?.message].filter(Boolean).join(': ') || 'Google sign-in failed.';
  }
}

onMounted(() => {
  const savedLanguage = localStorage.getItem(languageStorageKey);

  if (savedLanguage && languages[savedLanguage]) {
    currentLanguage.value = savedLanguage;
  } else {
    const browserLang = navigator.language.toLowerCase();
    if (browserLang.startsWith('ru')) {
      currentLanguage.value = 'ru';
    } else if (browserLang.startsWith('en')) {
      currentLanguage.value = 'en';
    }
  }

  subscribeVoteTotals((nextTotals) => {
    totals.value = nextTotals;
  });

  subscribeAuth((user) => {
    authUser.value = user;
    authReady.value = true;
    if (user) {
      authError.value = '';
    }
  });

  ensureSignedIn().catch((error) => {
    console.error('Anonymous sign-in failed:', error?.code, error?.message, error);
    authReady.value = true;
    authError.value = [error?.code, error?.message].filter(Boolean).join(': ') || 'Anonymous sign-in failed.';
  });

  if (firebaseConfigError) {
    authReady.value = true;
    authError.value = firebaseConfigError;
  }
});

watch(currentLanguage, (language) => {
  localStorage.setItem(languageStorageKey, language);
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
          @click="setLanguage(key)"
        >
          {{ value.label }}
        </button>
      </div>
      <h1>
        <span
          v-for="(part, partIndex) in splitEmojiText(locale.title)"
          :key="`title-${partIndex}`"
          :class="{ 'emoji-glyph': part.isEmoji }"
        >
          {{ part.text }}
        </span>
      </h1>
      <p class="intro">{{ locale.intro }}</p>
    </header>

    <section class="card">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th v-for="header in locale.tableHeaders" :key="header">{{ header }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in manifestoRows[currentLanguage]" :key="row[0]">
              <td v-for="(cell, cellIndex) in row" :key="`${row[0]}-${cellIndex}`">
                <template v-if="cellIndex === 1 || cellIndex === row.length - 1">
                  <span
                    v-for="(part, partIndex) in splitEmojiText(cell)"
                    :key="`${row[0]}-${cellIndex}-${partIndex}`"
                    :class="{ 'emoji-glyph': part.isEmoji }"
                  >
                    {{ part.text }}
                  </span>
                </template>
                <template v-else>{{ cell }}</template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>{{ locale.flowTitle }}</h2>
      <ol>
        <li v-for="step in locale.flow" :key="step">{{ step }}</li>
      </ol>
      <p class="question">{{ locale.endQuestion }}</p>
    </section>

    <section class="card">
      <div class="auth-panel">
        <p class="auth-status">{{ authLabel }}</p>
        <button v-if="needsAccountUpgrade" @click="upgradeAuth">{{ locale.linkGoogle }}</button>
        <p v-if="needsAccountUpgrade" class="auth-hint">{{ locale.linkAccountHint }}</p>
        <p v-if="authError" :class="['status', 'error']">{{ authError }}</p>
      </div>

      <h2>{{ locale.importantQuestion }}</h2>
      <div class="vote-controls">
        <select v-model="pendingVote">
          <option v-for="row in manifestoRows[currentLanguage]" :key="row[0]" :value="row[0]">
            {{ row[0] }} - {{ row[1] }}
          </option>
        </select>
        <button :disabled="!canVote" @click="vote">{{ locale.voteCta }}</button>
      </div>
      <p v-if="statusMessage" :class="['status', statusType]">{{ statusMessage }}</p>

      <h3>{{ locale.rankingTitle }}</h3>
      <p class="total">{{ locale.totalVotesLabel }}: {{ totalVotes }}</p>
      <ul class="ranking">
        <li v-for="item in rankedVotes" :key="item.option">
          <div class="rank-head">
            <span>{{ item.option }} - {{ item.reform }}</span>
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
