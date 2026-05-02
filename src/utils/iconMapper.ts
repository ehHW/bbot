/**
 * 根据文件后缀名映射图标
 * 使用 Material Icon Theme 图标库
 */

type ExtensionIconMap = Record<string, string>

// 文件扩展名到图标名称的映射表
const EXTENSION_ICON_MAP: ExtensionIconMap = {
    // Web 开发
    js: 'javascript',
    ts: 'typescript',
    jsx: 'javascript',
    tsx: 'typescript',
    vue: 'vue',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'sass',
    sass: 'sass',
    less: 'less',
    json: 'json',
    jsonc: 'json',

    // Python
    py: 'python',
    pyx: 'python',
    pyi: 'python',

    // Java 生态
    java: 'java',
    jar: 'jar',
    class: 'javaclass',
    gradle: 'gradle',
    maven: 'maven',
    kt: 'kotlin',
    scala: 'scala',

    // C/C++/C#
    c: 'c',
    h: 'h',
    cc: 'cpp',
    cpp: 'cpp',
    cxx: 'cpp',
    hpp: 'hpp',
    cs: 'csharp',

    // 其他编程语言
    go: 'go',
    rs: 'rust',
    php: 'php',
    rb: 'ruby',
    swift: 'swift',
    lua: 'lua',
    pl: 'perl',
    r: 'r',

    // 配置文件
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    ini: 'code-climate',
    conf: 'code-climate',
    config: 'code-climate',
    xml: 'xml',
    env: 'database',
    properties: 'code-climate',

    // 文档
    md: 'markdown',
    markdown: 'markdown',
    rst: 'document',
    txt: 'document',
    doc: 'document',
    docx: 'document',
    pdf: 'pdf',

    // 数据文件
    csv: 'table',
    xls: 'excel',
    xlsx: 'excel',
    sql: 'database',
    db: 'database',

    // 图片
    png: 'image',
    jpg: 'image',
    jpeg: 'image',
    gif: 'image',
    svg: 'svg',
    webp: 'image',
    ico: 'favicon',

    // 视频
    mp4: 'video',
    avi: 'video',
    mov: 'video',
    mkv: 'video',
    webm: 'video',
    flv: 'video',

    // 音频
    mp3: 'audio',
    wav: 'audio',
    flac: 'audio',
    aac: 'audio',
    ogg: 'audio',
    m4a: 'audio',

    // 压缩文件
    zip: 'zip',
    rar: 'zip',
    tar: 'zip',
    gz: 'zip',
    '7z': 'zip',
    bz2: 'zip',

    // 构建工具
    webpack: 'webpack',
    vite: 'vite',
    rollup: 'rollup',
    gulp: 'gulp',
    grunt: 'grunt',
    parcel: 'parcel',

    // 包管理
    packagejson: 'nodejs',
    packagelock: 'nodejs',
    pnpmlock: 'pnpm',
    yarnlock: 'yarn',
    gemlock: 'gemfile',
    cargolock: 'rust',

    // Git 相关
    gitignore: 'git',
    gitattributes: 'git',

    // Docker
    dockerfile: 'docker',

    // 默认
    default: 'document'
}

/**
 * 根据完整文件名获取扩展名
 */
function getFileExtension(filename: string): string {
    const match = filename.match(/\.([^.]+)$/)
    return match && match[1] ? match[1].toLowerCase() : ''
}

/** 图标资源根路径，由后端 /api1/uploads/icons/ 提供 */
const ICON_BASE = '/api1/uploads/icons'

/**
 * 根据文件名获取对应的图标路径
 * @param filename - 文件名（包含扩展名）
 * @param isDirectory - 是否为目录
 * @returns 图标的 URL
 */
export function getFileIcon(filename: string, isDirectory: boolean = false): string {
    if (isDirectory) {
        return `${ICON_BASE}/folder-base.svg`
    }

    const ext = getFileExtension(filename)

    // 特殊文件名处理
    const specialFiles: Record<string, string> = {
        'dockerfile': 'docker',
        'docker-compose.yml': 'docker',
        'docker-compose.yaml': 'docker',
        'makefile': 'makefile',
        'readme.md': 'readme',
        'license': 'license',
        'package.json': 'packagejson',
        'package-lock.json': 'packagelock',
        'pnpm-lock.yaml': 'pnpmlock',
        'yarn.lock': 'yarnlock',
        'gemfile': 'gemfile',
        'gemfile.lock': 'gemfile',
        'cargo.lock': 'cargolock',
        '.gitignore': 'gitignore',
        '.gitattributes': 'gitattributes',
        'webpack.config.js': 'webpack',
        'vite.config.js': 'vite',
        'vite.config.ts': 'vite',
        'rollup.config.js': 'rollup',
        'gulpfile.js': 'gulp',
        'gruntfile.js': 'grunt',
    }

    const lowerFilename = filename.toLowerCase()
    if (specialFiles[lowerFilename]) {
        return `${ICON_BASE}/${specialFiles[lowerFilename]}.svg`
    }

    // 根据扩展名查找图标
    const iconName = EXTENSION_ICON_MAP[ext] || EXTENSION_ICON_MAP['default']
    return `${ICON_BASE}/${iconName}.svg`
}

/**
 * 根据文件名获取图标 URL 和备用 CSS 类名
 * @param filename - 文件名
 * @param isDirectory - 是否为目录
 * @returns { url: string; fallback?: string }
 */
export function getFileIconData(filename: string, isDirectory: boolean = false): { url: string; fallback?: string } {
    const url = getFileIcon(filename, isDirectory)
    const ext = isDirectory ? 'folder' : getFileExtension(filename)

    return {
        url,
        fallback: `file-${ext}` // CSS 类名备用方案
    }
}

/**
 * 获取图标URL（直接用于 img src）
 */
export function getIconUrl(filename: string, isDirectory: boolean = false): string {
    return getFileIcon(filename, isDirectory)
}
