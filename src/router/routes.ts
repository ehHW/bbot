import type { RouteRecordRaw } from 'vue-router'

export const routes: RouteRecordRaw[] = [
    {
        path: '/',
        redirect: '/home',
    },
    {
        path: '/login',
        name: 'Login',
        component: () => import('@/views/Login/index.vue'),
        meta: {
            title: '登录',
            requiresAuth: false,
        },
    },
    {
        path: '/layout',
        name: 'Layout',
        component: () => import('@/Layout/index.vue'),
        redirect: '/home',
        meta: {
            requiresAuth: true,
        },
        children: [
            {
                path: '/home',
                name: 'Home',
                component: () => import('@/views/Home/index.vue'),
                meta: {
                    title: '首页',
                    requiresAuth: true,
                    menu: true,
                    menuTitle: '首页',
                    menuIcon: 'home',
                    menuOrder: 1,
                },
            },
            // {
            //     path: '/users',
            //     name: 'UserList',
            //     component: () => import('@/views/UserList/index.vue'),
            //     meta: {
            //         title: '用户列表',
            //         requiresAuth: true,
            //     },
            // },
            {
                path: '/file-manage',
                name: 'FileManage',
                component: () => import('@/views/FileManage/index.vue'),
                meta: {
                    title: '资源中心',
                    requiresAuth: true,
                    menu: true,
                    menuTitle: '资源中心',
                    menuIcon: 'file',
                    permissionCode: 'user.view_user',
                    menuOrder: 2,
                },
            },
            {
                path: '/upload-center',
                name: 'UploadCenter',
                redirect: () => ({ path: '/file-manage', query: { tab: 'upload' } }),
                meta: {
                    title: '文件上传',
                    requiresAuth: true,
                },
            },
            {
                path: '/chat-center',
                name: 'ChatCenter',
                component: () => import('@/views/Chat/index.vue'),
                redirect: { name: 'ChatMessages' },
                meta: {
                    title: '聊天室',
                    requiresAuth: true,
                    disableProgress: true,
                    menu: true,
                    menuTitle: '聊天室',
                    menuIcon: 'chat',
                    menuOrder: 3,
                },
                children: [
                    {
                        path: 'messages',
                        name: 'ChatMessages',
                        components: {
                            default: () => import('@/views/Chat/components/MessageWorkspace.vue'),
                            list: () => import('@/views/Chat/components/MessageListPanel.vue'),
                        },
                        meta: {
                            title: '聊天室',
                            requiresAuth: true,
                            disableProgress: true,
                        },
                    },
                    {
                        path: 'contacts/friends',
                        name: 'ChatContactsFriends',
                        components: {
                            default: () => import('@/views/Chat/components/ContactEmptyWorkspace.vue'),
                            list: () => import('@/views/Chat/components/ContactListPanel.vue'),
                        },
                        meta: {
                            title: '好友列表',
                            requiresAuth: true,
                            disableProgress: true,
                        },
                    },
                    {
                        path: 'contacts/requests',
                        name: 'ChatContactsRequests',
                        components: {
                            default: () => import('@/views/Chat/components/ContactRequestsWorkspace.vue'),
                            list: () => import('@/views/Chat/components/ContactListPanel.vue'),
                        },
                        meta: {
                            title: '新朋友',
                            requiresAuth: true,
                            disableProgress: true,
                        },
                    },
                    {
                        path: 'contacts/notices',
                        name: 'ChatContactsNotices',
                        components: {
                            default: () => import('@/views/Chat/components/ContactGroupNoticesWorkspace.vue'),
                            list: () => import('@/views/Chat/components/ContactListPanel.vue'),
                        },
                        meta: {
                            title: '群通知',
                            requiresAuth: true,
                            disableProgress: true,
                        },
                    },
                    {
                        path: 'contacts/friend-notices',
                        name: 'ChatContactsFriendNotices',
                        components: {
                            default: () => import('@/views/Chat/components/ContactFriendNoticesWorkspace.vue'),
                            list: () => import('@/views/Chat/components/ContactListPanel.vue'),
                        },
                        meta: {
                            title: '好友通知',
                            requiresAuth: true,
                            disableProgress: true,
                        },
                    },
                    {
                        path: 'audit',
                        name: 'ChatAudit',
                        components: {
                            default: () => import('@/views/Chat/components/AuditWorkspace.vue'),
                            list: () => import('@/views/Chat/components/AuditListPanel.vue'),
                        },
                        meta: {
                            title: '聊天巡检',
                            requiresAuth: true,
                            requiresStealthInspect: true,
                            disableProgress: true,
                            permissionCode: 'chat.review_all_messages',
                        },
                    },
                    {
                        path: 'settings/shortcuts',
                        name: 'ChatSettingsShortcuts',
                        components: {
                            default: () => import('@/views/Chat/components/ChatShortcutSettingsWorkspace.vue'),
                            list: () => import('@/views/Chat/components/ChatSettingsPanel.vue'),
                        },
                        meta: {
                            title: '聊天室设置',
                            requiresAuth: true,
                            disableProgress: true,
                        },
                    },
                ],
            },
            {
                path: '/access-control',
                name: 'AccessControlCenter',
                component: () => import('@/components/common/RouteOutlet.vue'),
                redirect: '/user-manage',
                meta: {
                    requiresAuth: true,
                    menu: true,
                    menuGroup: true,
                    menuTitle: '权限中心',
                    menuIcon: 'lock',
                    menuOrder: 4,
                },
                children: [
                    {
                        path: '/user-manage',
                        name: 'UserManage',
                        component: () => import('@/views/UserManage/index.vue'),
                        meta: {
                            title: '用户管理',
                            requiresAuth: true,
                            menu: true,
                            menuTitle: '用户管理',
                            menuIcon: 'user',
                            permissionCode: 'user.view_user',
                            menuOrder: 1,
                        },
                    },
                    {
                        path: '/role-manage',
                        name: 'RoleManage',
                        component: () => import('@/views/RoleManage/index.vue'),
                        meta: {
                            title: '角色管理',
                            requiresAuth: true,
                            menu: true,
                            menuTitle: '角色管理',
                            menuIcon: 'team',
                            permissionCode: 'user.view_role',
                            menuOrder: 2,
                        },
                    },
                    {
                        path: '/permission-manage',
                        name: 'PermissionManage',
                        component: () => import('@/views/PermissionManage/index.vue'),
                        meta: {
                            title: '权限管理',
                            requiresAuth: true,
                            menu: true,
                            menuTitle: '权限管理',
                            menuIcon: 'safety',
                            permissionCode: 'user.view_permission',
                            menuOrder: 3,
                        },
                    },
                ],
            },
            {
                path: '/entertainment',
                name: 'Entertainment',
                component: () => import('@/views/Entertainment/index.vue'),
                redirect: '/entertainment/game',
                meta: {
                    title: '娱乐中心',
                    requiresAuth: true,
                    menu: true,
                    menuTitle: '娱乐中心',
                    menuIcon: 'trophy',
                    menuOrder: 5,
                },
                children: [
                    {
                        path: 'game',
                        name: 'EntertainmentGame',
                        component: () => import('@/views/Entertainment/Game/index.vue'),
                        redirect: '/entertainment/game/2048',
                        meta: {
                            title: '游戏',
                            requiresAuth: true,
                            menu: true,
                            menuTitle: '游戏',
                            menuIcon: 'appstore',
                            menuOrder: 1,
                        },
                        children: [
                            {
                                path: '2048',
                                name: 'EntertainmentGame2048',
                                component: () => import('@/views/Entertainment/Game/Game2048View.vue'),
                                meta: {
                                    title: '2048',
                                    requiresAuth: true,
                                    menu: true,
                                    menuTitle: '2048',
                                    menuIcon: 'trophy',
                                    menuOrder: 1,
                                },
                            },
                        ],
                    },
                    {
                        path: 'music',
                        name: 'EntertainmentMusic',
                        component: () => import('@/views/Entertainment/Music/index.vue'),
                        meta: {
                            title: '音乐',
                            requiresAuth: true,
                            menu: true,
                            menuTitle: '音乐',
                            menuIcon: 'music',
                            menuOrder: 2,
                        },
                    },
                    {
                        path: 'video',
                        name: 'EntertainmentVideo',
                        component: () => import('@/views/Entertainment/Video/index.vue'),
                        meta: {
                            title: '视频',
                            requiresAuth: true,
                            menu: true,
                            menuTitle: '视频',
                            menuIcon: 'video',
                            menuOrder: 3,
                        },
                    },
                ],
            },
            {
                path: '/account',
                name: 'AccountCenter',
                component: () => import('@/components/common/RouteOutlet.vue'),
                redirect: '/profile-center',
                meta: {
                    requiresAuth: true,
                    menu: true,
                    menuGroup: true,
                    menuTitle: '账号设置',
                    menuIcon: 'setting',
                    menuOrder: 6,
                },
                children: [
                    {
                        path: '/profile-center',
                        name: 'ProfileCenter',
                        component: () => import('@/views/Profile/index.vue'),
                        meta: {
                            title: '个人中心',
                            requiresAuth: true,
                            menu: true,
                            menuTitle: '个人中心',
                            menuIcon: 'user',
                            menuOrder: 1,
                        },
                    },
                    {
                        path: '/settings',
                        name: 'Settings',
                        component: () => import('@/views/Settings/index.vue'),
                        meta: {
                            title: '设置',
                            requiresAuth: true,
                            menu: true,
                            menuTitle: '系统设置',
                            menuIcon: 'tool',
                            menuOrder: 2,
                        },
                    },
                ],
            },
            {
                path: '/ws-test',
                redirect: { name: 'ChatMessages' },
                meta: {
                    requiresAuth: true,
                },
            },
        ],
    },
    {
        path: '/404',
        component: () => import('@/views/Error/index.vue'),
    },
    {
        path: '/:pathMatch(.*)*',
        redirect: '/404',
    },
]
