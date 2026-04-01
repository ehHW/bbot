<template>
    <div class="entertainment-layout">
        <aside class="entertainment-menu" :class="{ collapsed }" :style="{ width: menuWidth }">
            <div class="menu-toolbar">
                <a-button type="text" :title="collapsed ? '展开菜单' : '收起菜单'" @click="toggleCollapse">
                    <template #icon>
                        <MenuUnfoldOutlined v-if="collapsed" />
                        <MenuFoldOutlined v-else />
                    </template>
                </a-button>

                <a-tooltip v-if="collapsed" title="搜索娱乐功能">
                    <a-button type="text" @click="handleSearchClick">
                        <template #icon>
                            <SearchOutlined />
                        </template>
                    </a-button>
                </a-tooltip>
            </div>

            <a-input ref="searchInputRef" v-if="!collapsed" v-model:value="searchKeyword" placeholder="搜索娱乐功能" allow-clear />

            <a-menu
                v-model:selectedKeys="selectedKeys"
                v-model:openKeys="openKeys"
                :theme="menuTheme"
                mode="inline"
                :inline-collapsed="collapsed"
                @click="onMenuClick"
            >
                <template v-for="item in filteredMenuItems" :key="item.key">
                    <a-sub-menu v-if="item.children?.length" :key="item.key">
                        <template #icon>
                            <component :is="item.icon" />
                        </template>
                        <template #title>{{ item.title }}</template>

                        <a-menu-item v-for="child in item.children" :key="child.path">
                            <template #icon>
                                <component :is="child.icon" />
                            </template>
                            {{ child.title }}
                        </a-menu-item>
                    </a-sub-menu>

                    <a-menu-item v-else :key="item.path">
                        <template #icon>
                            <component :is="item.icon" />
                        </template>
                        {{ item.title }}
                    </a-menu-item>
                </template>
            </a-menu>
        </aside>
        <section class="entertainment-content">
            <router-view />
        </section>
    </div>
</template>

<script setup lang="ts">
import { AppstoreOutlined, CustomerServiceOutlined, MenuFoldOutlined, MenuUnfoldOutlined, SearchOutlined, TrophyOutlined } from '@ant-design/icons-vue'
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'

const route = useRoute()
const router = useRouter()
const settingsStore = useSettingsStore()
const searchKeyword = ref('')
const selectedKeys = ref<string[]>([])
const openKeys = ref<string[]>([])
const collapsed = ref(false)
const searchInputRef = ref<{ focus?: () => void } | null>(null)

const menuWidth = computed(() => (collapsed.value ? '50px' : '200px'))
const menuTheme = computed<'light' | 'dark'>(() => (settingsStore.themeMode === 'dark' ? 'dark' : 'light'))

type MenuNode = {
    key: string
    path?: string
    title: string
    icon: typeof TrophyOutlined
    children?: Array<{
        path: string
        title: string
        icon: typeof AppstoreOutlined
    }>
}

const menuItems: MenuNode[] = [
    {
        key: '/entertainment/game',
        title: '游戏',
        icon: TrophyOutlined,
        children: [
            { path: '/entertainment/game/2048', title: '2048', icon: AppstoreOutlined },
        ],
    },
    { key: '/entertainment/music', path: '/entertainment/music', title: '音乐', icon: CustomerServiceOutlined },
]

const filteredMenuItems = computed(() => {
    const keyword = searchKeyword.value.trim().toLowerCase()
    if (!keyword) {
        return menuItems
    }
    return menuItems
        .map((item) => {
            if (!item.children?.length) {
                return item.title.toLowerCase().includes(keyword) ? item : null
            }

            const matchedChildren = item.children.filter((child) => child.title.toLowerCase().includes(keyword))
            if (item.title.toLowerCase().includes(keyword) || matchedChildren.length > 0) {
                return {
                    ...item,
                    children: matchedChildren.length > 0 ? matchedChildren : item.children,
                }
            }
            return null
        })
        .filter((item): item is MenuNode => item !== null)
})

watch(
    () => route.path,
    (path) => {
        const matchedParent = menuItems.find((item) => item.children?.some((child) => path.startsWith(child.path)) || item.path === path)
        const matchedChild = matchedParent?.children?.find((child) => path.startsWith(child.path))

        selectedKeys.value = matchedChild ? [matchedChild.path] : matchedParent?.path ? [matchedParent.path] : []
        openKeys.value = !collapsed.value && matchedParent?.children?.length ? [matchedParent.key] : []
    },
    { immediate: true },
)

function onMenuClick({ key }: { key: string }) {
    router.push(key)
}

function toggleCollapse() {
    collapsed.value = !collapsed.value
    if (collapsed.value) {
        searchKeyword.value = ''
        openKeys.value = []
    } else if (route.path.startsWith('/entertainment/game')) {
        openKeys.value = ['/entertainment/game']
    }
}

async function handleSearchClick() {
    if (collapsed.value) {
        collapsed.value = false
        await nextTick()
    }
    searchInputRef.value?.focus?.()
}
</script>

<style scoped>
.entertainment-layout {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 16px;
    height: calc(100vh - 115px);
}

.entertainment-menu {
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-sizing: border-box;
    padding: 16px;
    background: var(--surface-sidebar);
    border-radius: 12px;
    transition: width 0.24s ease;
    overflow: hidden;
}

.entertainment-menu.collapsed {
    align-items: center;
}

.menu-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.entertainment-menu.collapsed .menu-toolbar {
    width: 100%;
    justify-content: center;
    gap: 4px;
}

.entertainment-menu :deep(.ant-menu-inline),
.entertainment-menu :deep(.ant-menu-vertical) {
    border-inline-end: none;
}

.entertainment-menu :deep(.ant-menu) {
    background: transparent;
}

.entertainment-menu :deep(.ant-menu-sub),
.entertainment-menu :deep(.ant-menu-inline .ant-menu-sub.ant-menu-inline) {
    background: transparent;
}

.entertainment-menu :deep(.ant-menu-submenu-title) {
    border-radius: 8px;
}

.entertainment-menu :deep(.ant-menu-item),
.entertainment-menu :deep(.ant-menu-submenu-title) {
    margin-inline: 0;
}

.entertainment-menu :deep(.ant-menu-inline-collapsed) {
    width: 100%;
}

.entertainment-menu.collapsed {
    padding-inline: 4px;
}

.entertainment-content {
    min-width: 0;
    background: var(--surface-header);
    border-radius: 12px;
    overflow: auto;
}

@media (max-width: 900px) {
    .entertainment-layout {
        grid-template-columns: 1fr;
    }

    .entertainment-menu {
        width: 100% !important;
    }
}
</style>