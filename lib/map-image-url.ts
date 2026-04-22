import { type Block } from 'notion-types'

import { defaultPageCover, defaultPageIcon } from './config'

export const mapImageUrl = (url: string | undefined, block: Block) => {
  if (!url) {
    return undefined
  }

  if (url === defaultPageCover || url === defaultPageIcon) {
    return url
  }

  if (url.startsWith('data:')) {
    return url
  }

  // more logic ...
  if (url.startsWith('/images/page-config/')) {
    return `https://www.notion.so${url}`
  }

  if (url.startsWith('/')) {
    return `https://www.notion.so${url}`
  }

  if (
    url.includes('amazonaws.com') ||
    url.includes('notion-static.s3') ||
    url.includes('notion.so')
  ) {
    const table =
      block.parent_table === 'space' ||
      block.parent_table === 'collection' ||
      block.parent_table === 'team'
        ? block.parent_table
        : 'block'

    const proxyUrl = `https://www.notion.so/image/${encodeURIComponent(
      url
    )}?table=${table}&id=${block.id}&cache=v2`

    return proxyUrl
  }

  return url
}
