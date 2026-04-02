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
    height: calc(100vh - 80px);
    padding: 5px 5px 0;
    overflow: hidden;
}
</style>
