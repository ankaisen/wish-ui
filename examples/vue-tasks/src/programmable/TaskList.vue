<script setup lang="ts">
import { ref } from "vue";
import { tasks } from "./capabilities";

const title = ref("");

function onSubmit() {
  tasks.add(title.value);
  title.value = "";
}
</script>

<template>
  <section class="task-list">
    <h2>Tasks</h2>
    <ul>
      <li v-for="task in tasks.all.value" :key="task.id" :class="{ done: task.done }">
        <label>
          <input type="checkbox" :checked="task.done" @change="tasks.toggle(task.id)" />
          <span>{{ task.title }}</span>
        </label>
        <button type="button" :aria-label="`Delete ${task.title}`" @click="tasks.remove(task.id)">×</button>
      </li>
    </ul>
    <form @submit.prevent="onSubmit">
      <input v-model="title" aria-label="New task" placeholder="Add a task" />
      <button type="submit">Add</button>
    </form>
  </section>
</template>
