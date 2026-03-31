export interface HashResult {
    fileMd5: string
    chunkMd5List: string[]
    totalChunks: number
}

export const calculateFileHashes = (file: File, chunkSize: number, onProgress?: (progress: number) => void): Promise<HashResult> => {
    return new Promise((resolve, reject) => {
        const worker = new Worker(new URL('../workers/fileHashWorker.ts', import.meta.url), { type: 'module' })

        worker.onmessage = (event) => {
            const payload = event.data
            if (payload?.type === 'progress') {
                onProgress?.(Number(payload.progress || 0))
                return
            }
            if (payload?.type === 'done') {
                resolve({
                    fileMd5: String(payload.fileMd5 || ''),
                    chunkMd5List: Array.isArray(payload.chunkMd5List) ? payload.chunkMd5List : [],
                    totalChunks: Number(payload.totalChunks || 0),
                })
                worker.terminate()
            }
        }

        worker.onerror = (error) => {
            reject(error)
            worker.terminate()
        }

        worker.postMessage({
            type: 'calculate',
            payload: {
                file,
                chunkSize,
            },
        })
    })
}
