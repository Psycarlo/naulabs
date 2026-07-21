<template>
  <section class="container-narrow py-20 flex justify-center">
    <UiCard class="w-full max-w-sm">
      <UiCardHeader>
        <UiCardTitle class="text-xl">Sign in to Nau Labs</UiCardTitle>
        <UiCardDescription>
          Continue with Google or a magic link.
        </UiCardDescription>
      </UiCardHeader>
      <UiCardContent class="flex flex-col gap-4">
        <UiButton variant="outline" :disabled="loading" @click="signInGoogle">
          Continue with Google
        </UiButton>

        <div class="flex items-center gap-3 text-xs text-muted-foreground">
          <div class="h-px flex-1 bg-border" />
          or
          <div class="h-px flex-1 bg-border" />
        </div>

        <form class="flex flex-col gap-3" @submit.prevent="signInMagicLink">
          <UiInput
            v-model="email"
            type="email"
            placeholder="you@example.com"
            required
          />
          <UiButton type="submit" :disabled="loading || !email">
            Send magic link
          </UiButton>
        </form>

        <p v-if="sent" class="text-sm text-muted-foreground">
          Check your email for the sign-in link.
        </p>
        <p v-if="errorMessage" class="text-sm text-destructive">
          {{ errorMessage }}
        </p>
      </UiCardContent>
    </UiCard>
  </section>
</template>

<script setup lang="ts">
const auth = useAppAuthClient()
const email = ref('')
const loading = ref(false)
const sent = ref(false)
const errorMessage = ref('')

const signInGoogle = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    await auth.signIn.social({ callbackURL: '/chat', provider: 'google' })
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Sign-in failed'
  } finally {
    loading.value = false
  }
}

const signInMagicLink = async () => {
  loading.value = true
  errorMessage.value = ''
  sent.value = false
  try {
    await auth.signIn.magicLink({ callbackURL: '/chat', email: email.value })
    sent.value = true
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Could not send link'
  } finally {
    loading.value = false
  }
}
</script>
