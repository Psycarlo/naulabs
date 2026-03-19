<script lang="ts" setup>
interface Props {
  name: string
  link?: string
}

defineProps<Props>()
</script>

<template>
  <a
    v-if="link"
    :href="link"
    target="_blank"
    rel="noopener"
    class="inline-flex items-center px-4 py-2 text-sm font-bold uppercase text-muted-foreground transition-colors duration-300 hover:text-foreground"
  >
    {{ name }}
  </a>
  <span
    v-else
    class="inline-flex items-center px-4 py-2 text-sm font-bold uppercase text-muted-foreground transition-colors duration-300 hover:text-foreground"
  >
    {{ name }}
  </span>
</template>
