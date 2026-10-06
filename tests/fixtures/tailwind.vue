<template>
  <button id="save" class="text-white p-4 custom-button hover:bg-blue-700 flex bg-blue-500 font-semibold rounded" :class="active ? 'text-lg px-6 font-bold py-3' : 'text-sm px-4 font-normal py-2'">
    Save
  </button>
  <div v-bind:class="['justify-center flex', { 'text-white bg-black': active }]" data-label="text-white bg-black">Preview</div>
</template>

<script setup>
const active=true
</script>

<style scoped>
.custom-button { @apply text-white p-4 flex bg-blue-500 rounded; }
</style>
