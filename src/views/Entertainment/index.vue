<template>
    <a-card class="entertainment-card">
        <router-view />
    </a-card>
</template>

<style scoped>
.entertainment-card {
    height: 100%;
}

:deep(.ant-card-body) {
    height: 100%;
    padding: 0;
}
</style>