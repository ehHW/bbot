import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import RichMessageComposer from './RichMessageComposer.vue'

describe('RichMessageComposer', () => {
    it('emits pasted generic files as attachments', async () => {
        const wrapper = mount(RichMessageComposer, {
            props: {
                placeholder: '输入消息',
                sendHotkey: 'enter',
            },
        })

        const file = new File(['demo'], 'notes.txt', {
            type: 'text/plain',
            lastModified: 1710000000000,
        })

        await wrapper.find('.composer-surface__editor').trigger('paste', {
            clipboardData: {
                files: [file],
                items: [
                    {
                        kind: 'file',
                        getAsFile: () => file,
                    },
                ],
                getData: vi.fn(() => ''),
            },
        })

        expect(wrapper.emitted('paste-files')).toEqual([[[file]]])
    })
})