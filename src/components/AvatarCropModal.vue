<template>
    <a-modal
        :open="open"
        title="裁剪头像"
        width="900px"
        :confirm-loading="confirmLoading"
        ok-text="确认上传"
        cancel-text="取消"
        @ok="handleConfirm"
        @cancel="handleCancel"
    >
        <div class="cropper-layout" v-if="option.img">
            <div class="cropper-stage">
                <VueCropper
                    ref="cropperRef"
                    :img="option.img"
                    :output-size="option.size"
                    :output-type="option.outputType"
                    :info="true"
                    :full="option.full"
                    :can-move="option.canMove"
                    :can-move-box="option.canMoveBox"
                    :original="option.original"
                    :auto-crop="option.autoCrop"
                    :fixed="true"
                    :fixed-number="[1, 1]"
                    :center-box="true"
                    :auto-crop-width="option.autoCropWidth"
                    :auto-crop-height="option.autoCropHeight"
                    @realTime="handleRealTime"
                    class="cropper-canvas"
                />
            </div>

            <div class="preview-panel">
                <div class="preview-card">
                    <div class="preview-card__title">裁剪预览</div>
                    <div class="img-preview radian" :style="previewStyle" v-html="previewHtml || previewFallbackHtml"></div>
                </div>
                <div class="preview-tip">拖动图片并缩放，选择头像显示区域</div>
            </div>
        </div>
    </a-modal>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import 'vue-cropper/next/dist/index.css'
import { VueCropper } from 'vue-cropper/next'

const props = defineProps<{
    open: boolean
    imageUrl: string
    confirmLoading?: boolean
}>()

const emit = defineEmits<{
    (event: 'cancel'): void
    (event: 'confirm', file: File): void
}>()

type CropperExpose = {
    getCropBlob: (callback: (blob: Blob) => void) => void
    scale?: number
    showPreview?: () => void
}

type RealTimePreviewData = {
    html?: string
    img?: {
        transform?: string
    }
}

const cropperRef = ref<CropperExpose | null>(null)
const previewHtml = ref('')
const previewDiameter = 180
const baseScale = ref<number | null>(null)
const maxZoomRatio = 3
const option = reactive({
    img: '',
    size: 1,
    outputType: 'png',
    autoCrop: true,
    canMove: true,
    canMoveBox: false,
    original: false,
    full: true,
    autoCropWidth: 280,
    autoCropHeight: 280,
})

const previewStyle = computed(() => {
    const cropDiameter = Math.max(1, Math.min(option.autoCropWidth, option.autoCropHeight))
    const scale = Math.min(1, previewDiameter / cropDiameter)
    return {
        '--preview-scale': String(scale),
    }
})

const previewFallbackHtml = computed(() => '<div class="preview-empty">预览区</div>')

watch(
    () => props.imageUrl,
    (url) => {
        option.img = props.open ? url : ''
        previewHtml.value = ''
        baseScale.value = null
    },
)

watch(
    () => props.open,
    (open) => {
        option.img = open ? props.imageUrl : ''
        if (!open) {
            previewHtml.value = ''
            baseScale.value = null
        }
    },
)

const handleRealTime = (data: RealTimePreviewData) => {
    const transform = data?.img?.transform || ''
    const scaleMatch = transform.match(/scale\(([-\d.]+)\)/)
    const currentScale = scaleMatch ? Number(scaleMatch[1]) : NaN

    if (Number.isFinite(currentScale) && currentScale > 0) {
        if (baseScale.value === null) {
            baseScale.value = currentScale
        }

        const maxScale = (baseScale.value || currentScale) * maxZoomRatio
        if (currentScale > maxScale && cropperRef.value) {
            cropperRef.value.scale = maxScale
            cropperRef.value.showPreview?.()
        }
    }

    previewHtml.value = data?.html || ''
}

const handleCancel = () => {
    emit('cancel')
}

const toCircleAvatarFile = async (): Promise<File> => {
    if (!cropperRef.value) {
        throw new Error('裁剪器未初始化')
    }

    const sourceBlob = await new Promise<Blob>((resolve, reject) => {
        cropperRef.value?.getCropBlob((blob: Blob) => {
            if (!blob) {
                reject(new Error('裁剪结果为空'))
                return
            }
            resolve(blob)
        })
    })

    const squareBitmap = await createImageBitmap(sourceBlob)

    const circleCanvas = document.createElement('canvas')
    circleCanvas.width = 512
    circleCanvas.height = 512

    const ctx = circleCanvas.getContext('2d')
    if (!ctx) {
        throw new Error('浏览器不支持 Canvas')
    }

    ctx.clearRect(0, 0, 512, 512)
    ctx.save()
    ctx.beginPath()
    ctx.arc(256, 256, 256, 0, Math.PI * 2)
    ctx.closePath()
    ctx.clip()
    ctx.drawImage(squareBitmap, 0, 0, 512, 512)
    ctx.restore()

    const blob = await new Promise<Blob | null>((resolve) => {
        circleCanvas.toBlob((value) => resolve(value), 'image/png', 0.95)
    })

    if (!blob) {
        throw new Error('头像生成失败')
    }

    return new File([blob], `avatar-${Date.now()}.png`, { type: 'image/png' })
}

const handleConfirm = async () => {
    const file = await toCircleAvatarFile()
    emit('confirm', file)
}
</script>

<style scoped>
.cropper-layout {
    min-height: 460px;
    width: 100%;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 240px;
    gap: 20px;
}

.cropper-stage {
    min-width: 0;
    height: 460px;
    padding: 12px;
    border: 1px solid var(--border-color);
    border-radius: 18px;
    background: var(--surface-content);
}

.preview-panel {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 14px;
}

.preview-card {
    padding: 16px;
    border: 1px solid var(--border-color);
    border-radius: 18px;
    background: var(--surface-content);
}

.preview-card__title {
    margin-bottom: 14px;
    color: var(--text-secondary);
    text-align: center;
    font-size: 13px;
}

.preview-tip {
    color: var(--text-secondary);
    font-size: 12px;
    line-height: 1.6;
    text-align: center;
}

.img-preview {
    width: 180px;
    height: 180px;
    margin: 0 auto;
    overflow: hidden;
    position: relative;
    border: 1px solid var(--border-color);
    background: rgba(0, 0, 0, 0.03);
    display: flex;
    justify-content: center;
    align-items: center;
    border-radius: 50%;
    clip-path: circle(50% at 50% 50%);
}

.radian {
    border-radius: 50%;
}

:deep(.radian .show-preview) {
    width: 100% !important;
    height: 100% !important;
    display: flex;
    align-items: center;
    justify-content: center;
}

:deep(.img-preview .show-preview > div),
:deep(.img-preview .show-preview img),
:deep(.img-preview .show-preview canvas) {
    transform: scale(var(--preview-scale, 1));
    transform-origin: center center;
}

:deep(.preview-empty) {
    color: var(--text-secondary);
    font-size: 12px;
}

:deep(.cropper-crop-box),
:deep(.cropper-view-box),
:deep(.cropper-face),
:deep(.cropper-line),
:deep(.cropper-point) {
    border-radius: 50% !important;
}

:deep(.cropper-face) {
    background-color: transparent !important;
}

:deep(.cropper-dashed) {
    display: none;
}

:deep(.cropper-line),
:deep(.cropper-point),
:deep(.crop-info) {
    display: none !important;
}

:deep(.cropper-canvas) {
    width: 100%;
    height: 100%;
}

@media (max-width: 900px) {
    .cropper-layout {
        grid-template-columns: 1fr;
    }

    .cropper-stage {
        height: 380px;
    }

    .preview-panel {
        align-items: center;
    }
}
</style>
