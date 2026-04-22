<template>
    <a-layout-footer class="footer">
        <span>ICP备案/许可证号：</span>
        <a
            href="https://beian.miit.gov.cn/"
            target="_blank"
            rel="noopener noreferrer"
            class="footer-link"
            >鄂ICP备2026019376号</a
        >
    </a-layout-footer>
</template>

<script setup lang="ts"></script>

<style scoped>
.footer {
    height: var(--app-footer-height);
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 0;
    font-size: 12px;
}

.footer-link {
    color: inherit;
}
</style>
