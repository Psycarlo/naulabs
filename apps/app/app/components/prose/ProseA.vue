<template>
  <a v-if="safeHref" :href="safeHref" rel="noopener noreferrer" target="_blank">
    <slot />
  </a>
  <span v-else><slot /></span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// Untrusted agent/account output: only http(s)/mailto links render as anchors
// (a markdown `[x](javascript:...)` degrades to plain text), and every link is
// forced through rel="noopener noreferrer" so it can't reach window.opener.
const SAFE_PROTOCOL = /^(?:https?|mailto):/iu

const props = defineProps<{ href?: string }>()

const safeHref = computed(() =>
  props.href && SAFE_PROTOCOL.test(props.href) ? props.href : undefined
)
</script>
