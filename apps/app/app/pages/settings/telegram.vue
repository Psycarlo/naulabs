<template>
  <section class="container-narrow py-12 flex flex-col gap-6 max-w-2xl">
    <h1 class="text-2xl font-bold tracking-tight">Telegram</h1>

    <UiCard>
      <UiCardHeader>
        <UiCardTitle>Connect Telegram</UiCardTitle>
        <UiCardDescription>
          Chat with your agent from Telegram. Same agent, same files — your
          messages route into the same persistent box as web chat.
        </UiCardDescription>
      </UiCardHeader>
      <UiCardContent class="flex flex-col gap-4 text-sm">
        <p v-if="link?.linked" class="text-green-600">
          ✅ Your Telegram is connected. Message the bot anytime.
        </p>

        <template v-else>
          <p class="text-muted-foreground">
            Generate a one-time link code, then open the bot to connect this
            chat to your account.
          </p>
          <UiButton :disabled="pending" class="self-start" @click="onConnect">
            Generate link
          </UiButton>

          <div v-if="deepLink" class="flex flex-col gap-2">
            <a
              :href="deepLink"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary underline break-all"
            >
              {{ deepLink }}
            </a>
            <p class="text-xs text-muted-foreground">
              Opens Telegram and sends
              <code>/start {{ code }}</code
              >. Code expires in 10 minutes.
            </p>
          </div>

          <p v-else-if="manualCode" class="text-xs text-muted-foreground">
            No bot link configured. Send
            <code>/start {{ code }}</code> to your bot manually.
          </p>
        </template>

        <p v-if="errorMessage" class="text-destructive">{{ errorMessage }}</p>
      </UiCardContent>
    </UiCard>
  </section>
</template>

<script setup lang="ts">
import { api } from '@naulabs/backend'
import { computed, ref } from 'vue'

definePageMeta({ convexAuth: true })

const { data: link } = await useConvexQuery(api.telegram.myLink, {})
const { execute: create, pending } = useConvexMutation(
  api.telegram.createLinkCode
)

const code = ref('')
const botUsername = ref<string | null>(null)
const errorMessage = ref('')

const deepLink = computed(() =>
  botUsername.value && code.value
    ? `https://t.me/${botUsername.value}?start=${code.value}`
    : ''
)
const manualCode = computed(() => Boolean(code.value) && !botUsername.value)

const onConnect = async () => {
  errorMessage.value = ''
  try {
    const result = await create({})
    if (result) {
      code.value = result.code
      botUsername.value = result.botUsername
    }
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Could not generate link'
  }
}
</script>
