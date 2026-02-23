<script setup lang="ts">
const currentYear = new Date().getFullYear();
</script>

<template>
  <footer class="bg-surface-subtle border-t border-default mt-auto">
    <div class="container mx-auto px-4 py-6">
      <div class="flex flex-col md:flex-row items-center justify-between gap-4">
        <p class="text-secondary text-sm">
          &copy; {{ currentYear }} Kijker Labs, LLC
        </p>
        <nav class="flex items-center gap-4 text-sm">
          <a
            href="https://openpanopticon.org"
            target="_blank"
            rel="noopener noreferrer"
            class="text-secondary hover:text-primary no-underline"
          >
            About
          </a>
        </nav>
      </div>
    </div>
  </footer>
</template>
