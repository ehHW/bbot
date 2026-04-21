import { describe, expect, it } from "vitest";
import {
    buildChatComposerAssetClipboardDataFromMessageAssetPayload,
    prepareChatComposerAssetFromMessageAssetPayload,
    prepareChatComposerAssetFromSelection,
    prepareChatComposerAssetFromUploadResult,
} from "@/modules/chat-center/utils/chatAssetPrepare";

describe("chatAssetPrepare", () => {
    it("prepares existing asset selections into send payload and composer token", () => {
        const prepared = prepareChatComposerAssetFromSelection({
            kind: "file",
            entryId: 7,
            assetReferenceId: 31,
            displayName: "季度复盘.pdf",
            mediaType: "file",
            mimeType: "application/pdf",
            fileSize: 4096,
            url: "/uploads/users/demo/季度复盘.pdf",
            streamUrl: "",
            thumbnailUrl: "",
            processingStatus: "",
            preview: {
                displayName: "季度复盘.pdf",
                mediaType: "file",
                mimeType: "application/pdf",
                fileSize: 4096,
                url: "/uploads/users/demo/季度复盘.pdf",
                isDirectory: false,
                isVirtual: false,
            },
            relativePath: "users/demo/季度复盘.pdf",
            parentId: null,
            ownerUserId: 1,
            isDirectory: false,
            isVirtual: false,
        });

        expect(prepared.sendPayload).toEqual({
            sourceAssetReferenceId: 31,
            displayName: "季度复盘.pdf",
            mediaType: "file",
            mimeType: "application/pdf",
            fileSize: 4096,
            url: "/uploads/users/demo/季度复盘.pdf",
            streamUrl: undefined,
            thumbnailUrl: undefined,
            processingStatus: undefined,
        });
        expect(prepared.attachmentToken).toMatchObject({
            source_asset_reference_id: 31,
            display_name: "季度复盘.pdf",
            media_type: "file",
            mime_type: "application/pdf",
            file_size: 4096,
            url: "/uploads/users/demo/季度复盘.pdf",
        });
        expect(prepared.attachmentToken.token_id).toMatch(
            /^composer_attachment_/,
        );
    });

    it("prepares uploaded assets into the same composer token contract", () => {
        const prepared = prepareChatComposerAssetFromUploadResult({
            selection: {
                kind: "file",
                entryId: 13,
                assetReferenceId: 52,
                displayName: "架构图.png",
                mediaType: "image",
                mimeType: "image/png",
                fileSize: 2048,
                url: "/uploads/users/demo/架构图.png",
                streamUrl: "",
                thumbnailUrl: "",
                processingStatus: undefined,
                preview: {
                    displayName: "架构图.png",
                    mediaType: "image",
                    mimeType: "image/png",
                    fileSize: 2048,
                    url: "/uploads/users/demo/架构图.png",
                    isDirectory: false,
                    isVirtual: false,
                },
                relativePath: "users/demo/架构图.png",
                parentId: null,
                ownerUserId: 1,
                isDirectory: false,
                isVirtual: false,
            },
            preview: {
                displayName: "架构图.png",
                mediaType: "image",
                mimeType: "image/png",
                fileSize: 2048,
                url: "/uploads/users/demo/架构图.png",
                isDirectory: false,
                isVirtual: false,
            },
        });

        expect(prepared.sendPayload.sourceAssetReferenceId).toBe(52);
        expect(prepared.attachmentToken).toMatchObject({
            source_asset_reference_id: 52,
            display_name: "架构图.png",
            media_type: "image",
            url: "/uploads/users/demo/架构图.png",
        });
    });

    it("can restore composer assets directly from message payloads", () => {
        const prepared = prepareChatComposerAssetFromMessageAssetPayload(
            {
                asset_reference_id: 88,
                display_name: "发布会.mp4",
                media_type: "video",
                mime_type: "video/mp4",
                file_size: 8192,
                url: "/uploads/users/demo/release.mp4",
                stream_url: "/media/release.m3u8",
                thumbnail_url: "/media/release.jpg",
                processing_status: "ready",
            },
            {
                tokenId: "restored_1",
            },
        );

        expect(prepared).not.toBeNull();
        expect(prepared?.sendPayload).toEqual({
            sourceAssetReferenceId: 88,
            displayName: "发布会.mp4",
            mediaType: "video",
            mimeType: "video/mp4",
            fileSize: 8192,
            url: "/uploads/users/demo/release.mp4",
            streamUrl: "/media/release.m3u8",
            thumbnailUrl: "/media/release.jpg",
            processingStatus: "ready",
        });
        expect(prepared?.attachmentToken).toMatchObject({
            token_id: "restored_1",
            source_asset_reference_id: 88,
            display_name: "发布会.mp4",
            media_type: "video",
        });
    });

    it("builds clipboard data from message asset payloads through the same prepare layer", () => {
        const clipboardData = buildChatComposerAssetClipboardDataFromMessageAssetPayload(
            {
                asset_reference_id: 66,
                display_name: "方案图.png",
                media_type: "image",
                mime_type: "image/png",
                file_size: 1024,
                url: "/uploads/users/demo/方案图.png",
            },
            {
                tokenId: "copied_66",
            },
        );

        expect(clipboardData).toEqual({
            text: "方案图.png\n/uploads/users/demo/方案图.png",
            html: expect.stringContaining('data-token-id="copied_66"'),
        });
    });
});