<template>
    <a-card class="profile-page">
        <a-row :gutter="24">
            <a-col :xs="24" :lg="16">
                <a-form layout="vertical">
                    <a-form-item label="用户名">
                        <a-input :value="userStore.user?.username || ''" disabled />
                    </a-form-item>
                    <a-form-item label="昵称">
                        <a-input v-model:value="formState.display_name" placeholder="请输入昵称" />
                    </a-form-item>
                    <a-form-item label="邮箱">
                        <a-input v-model:value="formState.email" placeholder="请输入邮箱" />
                    </a-form-item>
                    <a-form-item label="电话号码">
                        <a-input v-model:value="formState.phone_number" placeholder="请输入电话号码" />
                    </a-form-item>
                    <a-form-item label="头像">
                        <div class="avatar-panel">
                            <div class="avatar-preview">
                                <a-avatar :size="180" :src="formState.avatar || undefined">
                                    {{ avatarText }}
                                </a-avatar>
                            </div>
                            <div class="avatar-panel__action">
                                <a-upload :before-upload="handleAvatarUpload" :show-upload-list="false" accept="image/*">
                                    <a-button :loading="avatarUploading">上传头像</a-button>
                                </a-upload>
                            </div>
                        </div>
                    </a-form-item>
                    <a-space>
                        <a-button type="primary" :loading="saving" @click="submitProfile">保存资料</a-button>
                        <a-button @click="fillFormFromUser">重置</a-button>
                    </a-space>
                </a-form>
            </a-col>

            <a-col :xs="24" :lg="8">
                <a-descriptions bordered :column="1" size="small" title="账户信息">
                    <a-descriptions-item label="角色">
                        {{ roleNames }}
                    </a-descriptions-item>
                    <a-descriptions-item label="创建时间">
                        {{ formatDateTime(userStore.user?.created_at || '') }}
                    </a-descriptions-item>
                    <a-descriptions-item label="更新时间">
                        {{ formatDateTime(userStore.user?.updated_at || '') }}
                    </a-descriptions-item>
                </a-descriptions>
            </a-col>
        </a-row>
    </a-card>

    <AvatarCropModal
        :open="avatarCropOpen"
        :image-url="avatarCropImageUrl"
        :confirm-loading="avatarUploading"
        @cancel="handleAvatarCropCancel"
        @confirm="handleAvatarCropConfirm"
    />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import type { UploadProps } from 'ant-design-vue'
import AvatarCropModal from '@/components/AvatarCropModal.vue'
import { updateProfileApi } from '@/api/user'
import { useAuthStore } from '@/stores/auth'
import { useUserStore } from '@/stores/user'
import { getErrorMessage } from '@/utils/error'
import { uploadFileWithCategory } from '@/utils/fileUploader'
import { formatDateTime } from '@/utils/timeFormatter'
import { isValidEmail, isValidPhoneNumber, trimText, validateAvatarFile } from '@/validators/common'

const authStore = useAuthStore()
const userStore = useUserStore()
const saving = ref(false)
const avatarUploading = ref(false)
const avatarCropOpen = ref(false)
const avatarCropImageUrl = ref('')
let avatarTempObjectUrl = ''

const formState = reactive({
    display_name: '',
    email: '',
    phone_number: '',
    avatar: '',
})

const roleNames = computed(() => userStore.user?.roles.map((item) => item.name).join('、') || '-')
const avatarText = computed(() => (formState.display_name || userStore.user?.username || '?').slice(0, 1))

const fillFormFromUser = () => {
    formState.display_name = userStore.user?.display_name || ''
    formState.email = userStore.user?.email || ''
    formState.phone_number = userStore.user?.phone_number || ''
    formState.avatar = userStore.user?.avatar || ''
}

const handleAvatarUpload: UploadProps['beforeUpload'] = async (file) => {
    const warning = validateAvatarFile(file as File)
    if (warning) {
        message.warning(warning)
        return false
    }

    if (avatarTempObjectUrl) {
        URL.revokeObjectURL(avatarTempObjectUrl)
        avatarTempObjectUrl = ''
    }

    avatarTempObjectUrl = URL.createObjectURL(file as File)
    avatarCropImageUrl.value = avatarTempObjectUrl
    avatarCropOpen.value = true

    return false
}

const clearCropState = () => {
    avatarCropOpen.value = false
    avatarCropImageUrl.value = ''
    if (avatarTempObjectUrl) {
        URL.revokeObjectURL(avatarTempObjectUrl)
        avatarTempObjectUrl = ''
    }
}

const handleAvatarCropCancel = () => {
    clearCropState()
}

const handleAvatarCropConfirm = async (avatarFile: File) => {
    if (!authStore.accessToken) {
        message.error('登录状态无效，无法上传头像')
        return
    }

    avatarUploading.value = true
    try {
        const result = await uploadFileWithCategory({
            file: avatarFile,
            category: 'profile',
            token: authStore.accessToken,
        })
        await updateProfileApi({ avatar: result.url })
        await authStore.fetchProfile()
        fillFormFromUser()
        message.success('头像上传成功')
        clearCropState()
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '头像上传失败'))
    } finally {
        avatarUploading.value = false
    }
}

const submitProfile = async () => {
    formState.display_name = trimText(formState.display_name)
    formState.email = trimText(formState.email)
    formState.phone_number = trimText(formState.phone_number)

    if (!isValidEmail(formState.email)) {
        message.warning('邮箱格式不正确')
        return
    }
    if (!isValidPhoneNumber(formState.phone_number)) {
        message.warning('电话号码格式不正确，应为 11 位手机号')
        return
    }

    saving.value = true
    try {
        await updateProfileApi({
            display_name: formState.display_name,
            email: formState.email,
            phone_number: formState.phone_number,
            avatar: formState.avatar,
        })
        await authStore.fetchProfile()
        fillFormFromUser()
        message.success('个人资料更新成功')
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '个人资料更新失败'))
    } finally {
        saving.value = false
    }
}

onMounted(fillFormFromUser)

onBeforeUnmount(() => {
    if (avatarTempObjectUrl) {
        URL.revokeObjectURL(avatarTempObjectUrl)
        avatarTempObjectUrl = ''
    }
})
</script>

<style scoped>
.profile-page {
    height: 100%;
}

:deep(.ant-card-body) {
    height: 100%;
    overflow: auto;
}

.avatar-preview {
    width: 180px;
    height: 180px;
    border: 1px solid var(--border-color);
    border-radius: 16px;
    background: var(--surface-content);
    display: flex;
    justify-content: center;
    align-items: center;
}

.avatar-panel {
    width: 180px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
}

.avatar-panel__action {
    display: flex;
    justify-content: center;
    width: 100%;
}

:deep(.avatar-preview .ant-avatar) {
    font-size: 64px;
    font-weight: 600;
}
</style>