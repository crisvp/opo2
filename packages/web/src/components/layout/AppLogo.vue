<script setup lang="ts">
defineProps<{
  size?: number | string;
}>();
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 100 100"
    :width="size"
    :height="size">
    <!-- Concentric rings - panopticon architecture -->
    <circle
      cx="50"
      cy="50"
      r="44"
      fill="none"
      stroke="currentColor"
      stroke-width="5" />
    <circle
      cx="50"
      cy="50"
      r="28"
      fill="none"
      stroke="currentColor"
      stroke-width="5" />

    <!-- Document at +15 deg angle, larger -->
    <g transform="rotate(15, 50, 50)">
      <rect
        x="28"
        y="20"
        width="44"
        height="60"
        rx="2"
        fill="var(--color-elevated)"
        stroke="currentColor"
        stroke-width="3" />
      <!-- Corner fold -->
      <path d="M54 20 L72 20 L72 38 Z" fill="currentColor" />
      <!-- Text lines -->
      <line
        x1="36"
        y1="38"
        x2="58"
        y2="38"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round" />
      <line
        x1="36"
        y1="50"
        x2="58"
        y2="50"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round" />
      <line
        x1="36"
        y1="62"
        x2="58"
        y2="62"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round" />
    </g>
  </svg>
</template>
