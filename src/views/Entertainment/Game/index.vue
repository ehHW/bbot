<template>
    <div class="game-layout">
        <section class="game-content">
            <router-view />
        </section>
    </div>
</template>

<script setup lang="ts"></script>

<style scoped>
.game-layout {
    min-height: 100%;
    padding: 16px;
    background: transparent;
}

.game-content {
    min-width: 0;
}
</style>