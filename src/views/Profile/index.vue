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
                            <button type="button" class="avatar-preview avatar-preview--button" @click="openAvatarPicker">
                                <a-avatar :size="180" :src="formState.avatar || undefined">
                                    {{ avatarText }}
                                </a-avatar>
                            </button>
                            <input
                                ref="avatarInputRef"
                                type="file"
                                accept="image/*"
                                class="avatar-input"
                                hidden
                                tabindex="-1"
                                aria-hidden="true"
                                @change="handleAvatarInputChange"
                            />
                        </div>
                    </a-form-item>
                    <a-space>
                        <a-button type="primary" :loading="saving" @click="submitProfile">保存资料</a-button>
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

                <a-card size="small" class="profile-password-card" title="修改密码">
                    <a-form layout="vertical">
                        <a-form-item label="当前密码">
                            <a-input-password v-model:value="passwordState.current_password" placeholder="请输入当前密码" />
                        </a-form-item>
                        <a-form-item label="新密码">
                            <a-input-password v-model:value="passwordState.new_password" placeholder="请输入新密码" />
                        </a-form-item>
                        <a-form-item label="确认新密码">
                            <a-input-password v-model:value="passwordState.confirm_password" placeholder="请再次输入新密码" />
                        </a-form-item>
                        <a-button type="primary" block :loading="passwordSaving" @click="submitPasswordChange">
                            更新密码
                        </a-button>
                    </a-form>
                </a-card>
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
import AvatarCropModal from '@/components/AvatarCropModal.vue'
import { changePasswordApi, updateProfileApi } from '@/api/user'
import { useAuthStore } from '@/stores/auth'
import { useUserStore } from '@/stores/user'
import { getErrorMessage } from '@/utils/error'
import { uploadFileWithCategory } from '@/utils/fileUploader'
import { formatDateTime } from '@/utils/timeFormatter'
import { isValidEmail, isValidPhoneNumber, trimText, validateAvatarFile } from '@/validators/common'

const authStore = useAuthStore()
const userStore = useUserStore()
const saving = ref(false)
const passwordSaving = ref(false)
const avatarUploading = ref(false)
const avatarCropOpen = ref(false)
const avatarCropImageUrl = ref('')
const avatarInputRef = ref<HTMLInputElement | null>(null)
let avatarTempObjectUrl = ''

const formState = reactive({
    display_name: '',
    email: '',
    phone_number: '',
    avatar: '',
})

const passwordState = reactive({
    current_password: '',
    new_password: '',
    confirm_password: '',
})

const roleNames = computed(() => userStore.user?.roles.map((item) => item.name).join('、') || '-')
const avatarText = computed(() => (formState.display_name || userStore.user?.username || '?').slice(0, 1))

const fillFormFromUser = () => {
    formState.display_name = userStore.user?.display_name || ''
    formState.email = userStore.user?.email || ''
    formState.phone_number = userStore.user?.phone_number || ''
    formState.avatar = userStore.user?.avatar || ''
}

const resetPasswordForm = () => {
    passwordState.current_password = ''
    passwordState.new_password = ''
    passwordState.confirm_password = ''
}

const prepareAvatarCrop = (file: File) => {
    const warning = validateAvatarFile(file)
    if (warning) {
        message.warning(warning)
        return
    }

    if (avatarTempObjectUrl) {
        URL.revokeObjectURL(avatarTempObjectUrl)
        avatarTempObjectUrl = ''
    }

    avatarTempObjectUrl = URL.createObjectURL(file as File)
    avatarCropImageUrl.value = avatarTempObjectUrl
    avatarCropOpen.value = true
}

const openAvatarPicker = () => {
    avatarInputRef.value?.click()
}

const handleAvatarInputChange = (event: Event) => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (file) {
        prepareAvatarCrop(file)
    }
    input.value = ''
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

const submitPasswordChange = async () => {
    if (!passwordState.current_password || !passwordState.new_password || !passwordState.confirm_password) {
        message.warning('请完整填写密码信息')
        return
    }
    if (passwordState.new_password !== passwordState.confirm_password) {
        message.warning('两次输入的新密码不一致')
        return
    }

    passwordSaving.value = true
    try {
        const { data } = await changePasswordApi({
            current_password: passwordState.current_password,
            new_password: passwordState.new_password,
            confirm_password: passwordState.confirm_password,
        })
        resetPasswordForm()
        message.success(data.detail || '密码修改成功')
    } catch (error: unknown) {
        message.error(getErrorMessage(error, '密码修改失败'))
    } finally {
        passwordSaving.value = false
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

.avatar-preview--button {
    padding: 0;
    cursor: pointer;
    transition: border-color 0.2s ease, transform 0.2s ease;
}

.avatar-preview--button:hover {
    border-color: var(--color-primary);
    transform: translateY(-1px);
}

.avatar-panel {
    width: 180px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
}

.avatar-input {
    display: none;
}

.profile-password-card {
    margin-top: 16px;
}

:deep(.avatar-preview .ant-avatar) {
    font-size: 64px;
    font-weight: 600;
}
</style>