<template>
  <div class="app-root" id="root">
    <es-router-view></es-router-view>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'App',
})
</script>

<style>
html,
body {
  margin: 0;
  padding: 0;
  background: #0b1220;
  overflow: hidden;
}

.app-root {
  width: 100%;
  height: 100%;
}
</style>
