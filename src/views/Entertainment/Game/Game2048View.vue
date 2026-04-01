<template>
    <div class="game-2048-view">
        <Game2048 />
    </div>
</template>

<script setup lang="ts">
import Game2048 from './Game2048.vue'
</script>

<style scoped>
.game-2048-view {
    min-height: 100%;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: 16px;
}
</style>