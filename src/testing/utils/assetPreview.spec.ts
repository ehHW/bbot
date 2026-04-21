import { describe, expect, it } from 'vitest'
import {
    buildAssetPreviewFromChatMessageAssetPayload,
    buildAssetPreviewFromChatRecordEntry,
    buildAssetPreviewFromFileEntry,
    canAssetPreviewImage,
    canAssetPreviewVideo,
    formatAssetPreviewFileSize,
    getAssetPreviewPrimaryUrl,
    getAssetPreviewSourceUrl,
    getAssetPreviewStreamUrl,
    hasAssetPreviewPlaybackSource,
    isPreviewableAssetPreview,
} from '@/utils/assetPreview'

describe('assetPreview', () => {
    it('normalizes resource-center file entries into a minimal preview model', () => {
        const preview = buildAssetPreviewFromFileEntry({
            id: 18,
            display_name: '活动海报.png',
            stored_name: 'poster.png',
            is_dir: false,
            parent_id: null,
            file_size: 4096,
            file_md5: 'md5',
            relative_path: 'users/demo/活动海报.png',
            url: '/uploads/users/demo/活动海报.png',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
            is_system: false,
            is_recycle_bin: false,
            recycled_at: null,
            expires_at: null,
            remaining_days: null,
            recycle_original_parent_id: null,
            asset_reference_id: 88,
            asset_reference: null,
            asset: {
                id: 19,
                file_md5: 'md5',
                sha256: null,
                storage_backend: 'local',
                storage_key: 'users/demo/活动海报.png',
                mime_type: 'image/png',
                media_type: 'image',
                file_size: 4096,
                original_name: '活动海报.png',
                extension: '.png',
                width: 1280,
                height: 720,
                duration_seconds: null,
                extra_metadata: {},
                url: '/uploads/users/demo/活动海报.png',
            },
        })

        expect(preview).toEqual({
            displayName: '活动海报.png',
            mediaType: 'image',
            mimeType: 'image/png',
            fileSize: 4096,
            url: '/uploads/users/demo/活动海报.png',
            streamUrl: undefined,
            thumbnailUrl: undefined,
            processingStatus: undefined,
            width: 1280,
            height: 720,
            durationSeconds: undefined,
            isDirectory: false,
            isVirtual: false,
        })
    })

    it('normalizes chat attachment payloads into the same preview model', () => {
        const preview = buildAssetPreviewFromChatMessageAssetPayload(
            {
                asset_reference_id: 77,
                display_name: '课程录像.mp4',
                media_type: 'video',
                mime_type: 'video/mp4',
                file_size: 8192,
                url: '/uploads/users/demo/lesson.mp4',
                extra_metadata: {
                    video_processing: {
                        playlist_url: '/media/demo/lesson.m3u8',
                        thumbnail_url: '/media/demo/lesson.jpg',
                        status: 'ready',
                        width: 1920,
                        height: 1080,
                        duration_seconds: 35,
                    },
                },
            },
        )

        expect(preview).toEqual({
            displayName: '课程录像.mp4',
            mediaType: 'video',
            mimeType: 'video/mp4',
            fileSize: 8192,
            url: '/uploads/users/demo/lesson.mp4',
            streamUrl: '/media/demo/lesson.m3u8',
            thumbnailUrl: '/media/demo/lesson.jpg',
            processingStatus: 'ready',
            width: 1920,
            height: 1080,
            durationSeconds: 35,
            isDirectory: false,
            isVirtual: false,
        })
    })

    it('reuses the same preview model for chat record asset entries', () => {
        const preview = buildAssetPreviewFromChatRecordEntry({
            message_type: 'file',
            content: '会议录像',
            asset: {
                asset_reference_id: 91,
                display_name: '会议录像.mp4',
                media_type: 'video',
                mime_type: 'video/mp4',
                file_size: 16384,
                url: '/uploads/users/demo/meeting.mp4',
                extra_metadata: {
                    video_processing: {
                        playlist_url: '/media/demo/meeting.m3u8',
                        thumbnail_url: '/media/demo/meeting.jpg',
                        status: 'ready',
                    },
                },
            },
        })

        expect(preview).toEqual({
            displayName: '会议录像.mp4',
            mediaType: 'video',
            mimeType: 'video/mp4',
            fileSize: 16384,
            url: '/uploads/users/demo/meeting.mp4',
            streamUrl: '/media/demo/meeting.m3u8',
            thumbnailUrl: '/media/demo/meeting.jpg',
            processingStatus: 'ready',
            width: undefined,
            height: undefined,
            durationSeconds: undefined,
            isDirectory: false,
            isVirtual: false,
        })
    })

    it('formats shared size and resolves preview urls from preview contract', () => {
        const imagePreview = {
            displayName: '图片',
            mediaType: 'image',
            mimeType: 'image/png',
            fileSize: 4096,
            url: '/uploads/demo.png',
            streamUrl: undefined,
            thumbnailUrl: undefined,
            processingStatus: undefined,
            width: 1200,
            height: 800,
            durationSeconds: undefined,
            isDirectory: false,
            isVirtual: false,
        }

        expect(formatAssetPreviewFileSize(imagePreview)).toBe('4.00 KB')
        expect(getAssetPreviewSourceUrl(imagePreview)).toBe('/uploads/demo.png')
        expect(canAssetPreviewImage(imagePreview)).toBe(true)

        expect(formatAssetPreviewFileSize({
            displayName: '目录',
            mediaType: 'directory',
            mimeType: undefined,
            fileSize: undefined,
            url: undefined,
            streamUrl: undefined,
            thumbnailUrl: undefined,
            processingStatus: undefined,
            width: undefined,
            height: undefined,
            durationSeconds: undefined,
            isDirectory: true,
            isVirtual: false,
        })).toBe('-')

        const videoPreview = {
            displayName: '视频',
            mediaType: 'video',
            mimeType: 'video/mp4',
            fileSize: 8192,
            url: undefined,
            streamUrl: '/media/demo.m3u8',
            thumbnailUrl: '/media/demo.jpg',
            processingStatus: 'ready',
            width: 1920,
            height: 1080,
            durationSeconds: 35,
            isDirectory: false,
            isVirtual: false,
        }

        expect(getAssetPreviewStreamUrl(videoPreview)).toBe('/media/demo.m3u8')
        expect(getAssetPreviewPrimaryUrl(videoPreview)).toBe('/media/demo.m3u8')
        expect(hasAssetPreviewPlaybackSource(videoPreview)).toBe(true)
        expect(canAssetPreviewVideo(videoPreview)).toBe(true)

        expect(isPreviewableAssetPreview({
            displayName: '语音',
            mediaType: 'audio',
            mimeType: 'audio/mpeg',
            fileSize: 1024,
            url: '/uploads/demo.mp3',
            streamUrl: undefined,
            thumbnailUrl: undefined,
            processingStatus: undefined,
            width: undefined,
            height: undefined,
            durationSeconds: 12,
            isDirectory: false,
            isVirtual: false,
        })).toBe(true)
    })
})