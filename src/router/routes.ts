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
                },
            },
            // {
            //     path: '/roles',
            //     name: 'RoleList',
            //     component: () => import('@/views/RoleList/index.vue'),
            //     meta: {
            //         title: '角色列表',
            //         requiresAuth: true,
            //     },
            // },
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
                },
            },
            // {
            //     path: '/permissions',
            //     name: 'PermissionList',
            //     component: () => import('@/views/PermissionList/index.vue'),
            //     meta: {
            //         title: '权限列表',
            //         requiresAuth: true,
            //     },
            // },
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
                },
            },
            {
                path: '/realtime-center',
                name: 'RealtimeCenter',
                component: () => import('@/views/Console/index.vue'),
                meta: {
                    title: '实时消息',
                    requiresAuth: true,
                    menu: true,
                    menuTitle: '实时消息',
                    menuIcon: 'message',
                    menuSettingKey: 'showRealtimeMenu',
                    permissionCode: 'user.view_user',
                },
            },
            {
                path: '/ws-test',
                redirect: '/realtime-center',
                meta: {
                    requiresAuth: true,
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
                    menuTitle: '设置',
                    menuIcon: 'tool',
                },
            },
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
                },
            },
            {
                path: '/file-manage',
                name: 'FileManage',
                component: () => import('@/views/FileManage/index.vue'),
                meta: {
                    title: '文件管理',
                    requiresAuth: true,
                    menu: true,
                    menuTitle: '文件管理',
                    menuIcon: 'api',
                    permissionCode: 'user.view_user',
                },
            },
            {
                path: '/upload-center',
                name: 'UploadCenter',
                component: () => import('@/views/Upload/index.vue'),
                meta: {
                    title: '上传任务',
                    requiresAuth: true,
                    menu: true,
                    menuTitle: '上传任务',
                    menuIcon: 'upload',
                    permissionCode: 'user.view_user',
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
