/// <reference lib="webworker" />

import SparkMD5 from 'spark-md5'

interface CalculatePayload {
    file: File
    chunkSize: number
}

self.onmessage = async (event: MessageEvent<{ type: 'calculate'; payload: CalculatePayload }>) => {
    if (event.data?.type !== 'calculate') {
        return
    }

    const { file, chunkSize } = event.data.payload
    const totalChunks = Math.ceil(file.size / chunkSize)
    const fullHasher = new SparkMD5.ArrayBuffer()
    const chunkMd5List: string[] = []

    for (let index = 0; index < totalChunks; index += 1) {
        const start = index * chunkSize
        const end = Math.min(file.size, start + chunkSize)
        const chunk = file.slice(start, end)
        const buffer = await chunk.arrayBuffer()

        fullHasher.append(buffer)
        const chunkHasher = new SparkMD5.ArrayBuffer()
        chunkHasher.append(buffer)
        chunkMd5List.push(chunkHasher.end())

            ; (self as DedicatedWorkerGlobalScope).postMessage({
                type: 'progress',
                progress: Math.floor(((index + 1) / totalChunks) * 100),
            })
    }

    ; (self as DedicatedWorkerGlobalScope).postMessage({
        type: 'done',
        fileMd5: fullHasher.end(),
        chunkMd5List,
        totalChunks,
    })
}
