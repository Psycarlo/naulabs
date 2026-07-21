<template>
  <a
    v-if="safeSrc"
    class="inline-flex items-center gap-1 text-sm underline text-muted-foreground"
    :href="safeSrc"
    rel="noopener noreferrer"
    target="_blank"
  >
    🖼️ {{ alt || 'image' }} (click to load)
  </a>
  <span v-else class="text-sm text-muted-foreground">
    🖼️ {{ alt || 'image' }} (blocked)
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// SECURITY: never auto-load remote images. A `![](http://attacker/x.png)` in a
// malicious email/doc is a tracking + exfil beacon, so we render a click-to-load
// link instead of an <img> that fires a request on render. Non-http(s) sources
// (javascript:, data:) don't even get the link.
const SAFE_PROTOCOL = /^https?:/iu

const props = defineProps<{ alt?: string; src?: string }>()

const safeSrc = computed(() =>
  props.src && SAFE_PROTOCOL.test(props.src) ? props.src : undefined
)
</script>
