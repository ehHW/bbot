<template>
    <a-layout-content class="main">
        <router-view />
    </a-layout-content>
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<style scoped>
.main {
    height: var(--app-main-height);
    min-height: 0;
    padding: 5px 5px 0;
    overflow: hidden;
}
</style>
