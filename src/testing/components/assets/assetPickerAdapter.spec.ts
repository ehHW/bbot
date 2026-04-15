import { describe, expect, it } from 'vitest'
import { buildAssetPickerSelection } from '@/components/assets/assetPickerAdapter'

describe('assetPickerAdapter', () => {
    it('normalizes a regular resource entry into a picker selection', () => {
        const selection = buildAssetPickerSelection({
            id: 7,
            display_name: '季度复盘.pdf',
            stored_name: 'stored.pdf',
            is_dir: false,
            parent_id: null,
            file_size: 4096,
            file_md5: 'md5',
            relative_path: 'users/demo/季度复盘.pdf',
            url: '/uploads/users/demo/季度复盘.pdf',
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:00:00Z',
            is_system: false,
            is_recycle_bin: false,
            recycled_at: null,
            expires_at: null,
            remaining_days: null,
            recycle_original_parent_id: null,
            asset_reference_id: 31,
            asset_reference: null,
            asset: {
                id: 9,
                file_md5: 'md5',
                sha256: null,
                storage_backend: 'local',
                storage_key: 'users/demo/季度复盘.pdf',
                mime_type: 'application/pdf',
                media_type: 'file',
                file_size: 4096,
                original_name: '季度复盘.pdf',
                extension: '.pdf',
                width: null,
                height: null,
                duration_seconds: null,
                extra_metadata: {},
                url: '/uploads/users/demo/季度复盘.pdf',
            },
        })

        expect(selection).toMatchObject({
            entryId: 7,
            assetReferenceId: 31,
            displayName: '季度复盘.pdf',
            mediaType: 'file',
            mimeType: 'application/pdf',
            fileSize: 4096,
            url: '/uploads/users/demo/季度复盘.pdf',
            streamUrl: '',
            thumbnailUrl: '',
            processingStatus: '',
        })
    })

    it('reads video processing metadata when available', () => {
        const selection = buildAssetPickerSelection({
            id: 8,
            display_name: '发布会.mp4',
            stored_name: 'release.mp4',
            is_dir: false,
            parent_id: null,
            file_size: 8192,
            file_md5: 'md5',
            relative_path: 'users/demo/发布会.mp4',
            url: '/uploads/users/demo/发布会.mp4',
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:00:00Z',
            is_system: false,
            is_recycle_bin: false,
            recycled_at: null,
            expires_at: null,
            remaining_days: null,
            recycle_original_parent_id: null,
            asset_reference_id: 32,
            asset_reference: null,
            asset: {
                id: 10,
                file_md5: 'md5',
                sha256: null,
                storage_backend: 'local',
                storage_key: 'users/demo/发布会.mp4',
                mime_type: 'video/mp4',
                media_type: 'video',
                file_size: 8192,
                original_name: '发布会.mp4',
                extension: '.mp4',
                width: null,
                height: null,
                duration_seconds: null,
                extra_metadata: {
                    video_processing: {
                        playlist_url: '/media/demo/release.m3u8',
                        thumbnail_url: '/media/demo/release.jpg',
                        status: 'ready',
                    },
                },
                url: '/uploads/users/demo/发布会.mp4',
            },
        })

        expect(selection).toMatchObject({
            entryId: 8,
            assetReferenceId: 32,
            mediaType: 'video',
            streamUrl: '/media/demo/release.m3u8',
            thumbnailUrl: '/media/demo/release.jpg',
            processingStatus: 'ready',
        })
    })

    it('throws when the file entry has no asset reference', () => {
        expect(() => buildAssetPickerSelection({
            id: 9,
            display_name: '孤立文件.txt',
            stored_name: 'orphan.txt',
            is_dir: false,
            parent_id: null,
            file_size: 128,
            file_md5: 'md5',
            relative_path: 'users/demo/orphan.txt',
            url: '/uploads/users/demo/orphan.txt',
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-01T00:00:00Z',
            is_system: false,
            is_recycle_bin: false,
            recycled_at: null,
            expires_at: null,
            remaining_days: null,
            recycle_original_parent_id: null,
            asset_reference_id: null,
            asset_reference: null,
            asset: null,
        })).toThrow('该文件缺少资产引用，暂时无法选择')
    })
})