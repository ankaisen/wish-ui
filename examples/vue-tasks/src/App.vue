<script setup lang="ts">
import { computed } from "vue";
import { taskListRef } from "./store";
import { wish } from "./wish";

const all = taskListRef();
const open = computed(() => all.value.filter((task) => !task.done).length);
</script>

<template>
  <div class="app">
    <header class="top-bar">
      <h1>Tasks</h1>
    </header>
    <aside class="sidebar">
      <p>{{ open }} open · {{ all.length - open }} done</p>
    </aside>
    <main class="content">
      <wish.Root />
      <wish.Panel />
    </main>
  </div>
</template>
